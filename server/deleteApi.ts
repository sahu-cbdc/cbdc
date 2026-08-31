/**
 * CBDC — নিরাপদ সার্ভার-সাইড entity deletion (Account / Donor ID — independent)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ব্রাউজার আর নিজে কোনো ডেটা মোছে না — শুধু লগইন করা অ্যাডমিনের Firebase ID
 * token দিয়ে secure endpoint-এ (`/api/admin/delete`) অনুরোধ পাঠায়। এই মডিউলটি
 * সেই endpoint-এর একমাত্র deletion engine:
 *
 *   • Cloudflare Worker  → server/index.ts  (wrangler.jsonc → `main`)
 *   • Vite dev-middleware → vite.config.ts  (শুধু `vite dev`-এ; build-এ নেই)
 *
 * ══ নিরাপত্তা মডেল ══
 *   • **ID token যাচাই** — Firebase Identity Toolkit REST (`accounts:lookup`),
 *     শুধু public web API key দিয়ে (এটি client config-এর মতোই public)।
 *   • **অ্যাডমিন ভূমিকা যাচাই** — `admins/{uid}/role === 'admin'` (এবং status
 *     disabled নয়)। মডারেটর/সাধারণ ব্যবহারকারী কখনোই এই endpoint ব্যবহার করতে
 *     পারবে না; RTDB Security Rules দ্বিতীয় স্তরের সুরক্ষা হিসেবে থেকে যায়।
 *   • **কোনো private key / service-account / Firebase Admin SDK নেই** — সার্ভারেও
 *     নয়। এজন্যই Firebase Authentication (লগইন) অ্যাকাউন্ট মোছা সম্ভব নয়;
 *     তা রয়ে গেলে স্পষ্ট warning দেওয়া হয় (Console → Authentication)।
   *   • **দুটি স্বাধীন entity** — একটির deletion অন্যটিকে কোনোভাবেই স্পর্শ করে না:
   *       account scope → users/{uid} · admins/{uid} · accounts/*   (ডোনার আইডি অক্ষত)
   *       donor scope   → donors/{donorId} · members/* · queue/* · donations/*
   *                       (ডোনারের History) · requests/* · reports/*
 *   • ভুল/অমিল identity দিলে কিছুই মোছা হয় না; প্রতিটি path মোছার আগে
 *     আগে থেকেই read করে নিশ্চিত হওয়া হয়।
 *
 * এই মডিউলটি pure (I/O injected) — `DeleteIo` দিয়ে যেকোনো পরিবেশে (Worker,
 * dev middleware, verification harness) একই logic চালানো যায়।
 */

import { emailIndexPath } from "./identityKey.ts";

export type DeleteScope = "account" | "donor";

/** Firebase Authentication IO-এর ফলাফল (server/authAdmin.ts থেকে)। */
export type AuthDeleteIoOutcome = "deleted" | "missing" | "failed" | "unconfigured";
/** ফলাফলের auth ফিল্ড — unconfigured → skipped (আংশিক সাফল্য + warning)। */
export type AuthDeleteOutcome = "deleted" | "missing" | "failed" | "skipped";

/** IO-ফলাফল → ফলাফলের auth মান। */
function toAuthStatus(outcome: AuthDeleteIoOutcome): AuthDeleteOutcome {
  return outcome === "unconfigured" ? "skipped" : outcome;
}

/** I/O seam — Worker/dev-middleware/পরীক্ষা সবাই নিজের fetch দিয়ে inject করে। */
export type DeleteIo = {
  /** Firebase ID token যাচাই → { uid }; invalid হলে null। */
  verifyToken(idToken: string): Promise<{ uid: string } | null>;
  /** একটি path-এর মান (রেকর্ড না থাকলে null)। */
  get(path: string): Promise<unknown>;
  /** পুরো node-এর রেকর্ড { id: row } (node না থাকলে null)। */
  list(node: string): Promise<Record<string, any> | null>;
  /** multi-path apply — null মান মানে path মুছে ফেলা। সব সফল হলে true। */
  apply(paths: Record<string, null>): Promise<boolean>;
  /**
   * ঠিক এই একটি Firebase Authentication (লগইন) অ্যাকাউন্ট মোছে — শুধুই
   * server-side secret (service account) দিয়ে; ক্লায়েন্টে কোনো key থাকে না।
   * "missing" = আগেই নেই (ব্যর্থতা নয়), "unconfigured" = সার্ভারে secret নেই।
   */
  deleteAuthUser(uid: string): Promise<AuthDeleteIoOutcome>;
};

/** সার্ভার-সাইড ব্যর্থতা — HTTP status + বাংলা বার্তা। */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Firebase Auth UID: ২০–৬৪টি URL-safe অক্ষর। */
const AUTH_UID_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isAuthUid(value: unknown): boolean {
  return AUTH_UID_RE.test(String(value ?? "").trim());
}

/** একই রেকর্ডের মালিক UID বের করার ক্ষেত্রগুলো (পুরোনো/নতুন সব বানান)। */
const OWNER_KEYS = ["ownerUid", "uid", "userId", "ownerId", "user"] as const;

function ownerOf(row: any): string {
  if (!row || typeof row !== "object") return "";
  for (const key of OWNER_KEYS) {
    const value = String(row[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function nameOf(row: any): string {
  if (!row || typeof row !== "object") return "";
  return String(row.name ?? row.displayName ?? row.email ?? "").trim();
}

/** নির্দিষ্ট UID-এর অ্যাকাউন্ট রেকর্ড কি না (accounts node-এ)। */
function accountOf(row: any, uid: string): boolean {
  if (!row || typeof row !== "object") return false;
  if (ownerOf(row) === uid) return true;
  return String(row?.id ?? "").trim() === uid;
}

/** ডোনার-সম্পর্কিত রেকর্ড কি না — শুধু donor scope-এ ব্যবহৃত (অ্যাকাউন্ট কখনো নয়)। */
function donorRecordOf(row: any, uid: string, donorId: string): boolean {
  if (!row || typeof row !== "object") return false;
  if (uid && ownerOf(row) === uid) return true;
  if (String(row?.id ?? "").trim() === uid) return true;
  if (donorId && String(row?.donorId ?? "").trim() === donorId) return true;
  if (String(row?.id ?? "").trim() === donorId) return true;
  /* Doner panel-এর পুরোনো queue key: PD-<sanitized donorId/uid> */
  const short = donorId.replace(/[^A-Za-z0-9]/g, "").slice(-10);
  if (short && /^PD-/.test(String(row?.id ?? "")) && String(row?.id ?? "").includes(short)) return true;
  return false;
}

export type DeleteStepInfo = {
  id: string;
  label: string;
  ok: boolean;
  /** কিছুই ছিল না / প্রযোজ্য নয় — এটি ব্যর্থতা নয় */
  skipped?: boolean;
  error?: string;
};

export type ServerDeleteResult = {
  ok: boolean;
  scope: DeleteScope;
  donorId: string;
  uid: string;
  name: string;
  /** Realtime Database অংশ */
  rtdb: "ok" | "failed" | "skipped";
  /**
   * সংশ্লিষ্ট Firebase Authentication (লগইন) অ্যাকাউন্ট অংশ —
   * deleted = মুছে ফেলা হয়েছে (server-side secret দিয়ে),
   * missing = এই ব্যক্তির কোনো লগইন অ্যাকাউন্টই ছিল না,
   * failed = মোছা যায়নি (তখন কোনো RTDB ডেটাও মোছা হয় না),
   * skipped = সার্ভারে service-account secret কনফিগার করা নেই।
   */
  auth: AuthDeleteOutcome;
  /** যে uid-এর লগইন অ্যাকাউন্ট মোছা/বাদ হলো (খালি = কোনো লিংকড অ্যাকাউন্ট নেই) */
  authUid: string;
  /** সার্ভার endpoint-এর অবস্থা */
  server: "ok" | "failed";
  /** মোছা হয়েছে এমন RTDB path-এর সংখ্যা */
  removed: number;
  warnings: string[];
  /** ধাপে ধাপে ফলাফল (UI-তে দেখানোর জন্য) */
  steps?: DeleteStepInfo[];
  /** কোনো রেকর্ড মেলেনি/অনুমতি না থাকলে স্পষ্ট কারণ */
  error?: string;
};

export type DeleteApiInput = {
  scope?: string;
  donorId?: string;
  uid?: string;
  name?: string;
  /** client-এর Firebase ID token (Authorization header থেকে) */
  idToken?: string;
};

/**
 * Admin panel-এর secure deletion endpoint-এর মূল logic।
 *
 * ক্রম (order matters): token verify → admin role verify → identity resolve →
 * শুধু নির্ধারিত scope-র path collection → RTDB multi-path delete।
 */
export async function handleAdminEntityDelete(
  input: DeleteApiInput | null | undefined,
  io: DeleteIo,
): Promise<ServerDeleteResult> {
  const scope = String(input?.scope ?? "").trim() as DeleteScope;
  if (scope !== "account" && scope !== "donor") {
    throw new ApiError(400, "অজানা scope — শুধু account বা donor।");
  }
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");

  /* ১. ID token যাচাই — ভুল/মেয়াদোত্তীর্ণ টোকেনে কিছুই হয় না। */
  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }

  /* ২. অ্যাডমিন ভূমিকা যাচাই — শুধু active `admin` role-ই ডিলিট করতে পারে।
     (UI-তে `team.view` শুধু অ্যাডমিনের আছে; সার্ভারেও একই শর্ত — দ্বিগুণ সুরক্ষা।) */
  const me = (await io.get(`admins/${caller.uid}`).catch(() => null)) as any;
  const role = String((me && me.role) || "").toLowerCase();
  const status = String((me && me.status) || "active").toLowerCase();
  if (role !== "admin" || status === "disabled") {
    throw new ApiError(403, "শুধু অ্যাডমিন এই কাজ করতে পারেন।");
  }

  /* ৩. scope অনুযায়ী identity resolve + path collection + delete */
  return scope === "account"
    ? deleteAccountEntity(input, caller.uid, io)
    : deleteDonorIdEntity(input, caller.uid, io);
}

/* ═══════════════════════════════════════════════════════════════════
   Account entity — users/{uid} · admins/{uid} · accounts/* + লগইন
   (Firebase Authentication account সহ; ডোনার আইডি, members, queue,
   requests, reports, messages অক্ষত)
   ═══════════════════════════════════════════════════════════════════ */
async function deleteAccountEntity(
  input: DeleteApiInput,
  callerUid: string,
  io: DeleteIo,
): Promise<ServerDeleteResult> {
  const uid = String(input?.uid ?? "").trim();
  if (!uid) throw new ApiError(400, "UID দিতে হবে।");
  if (!isAuthUid(uid)) {
    throw new ApiError(400, "UID সঠিক নয় — ভুল তথ্য দিয়ে কিছু মোছা হবে না।");
  }
  if (uid === callerUid) {
    throw new ApiError(400, "নিজের অ্যাকাউন্ট এই endpoint দিয়ে মুছতে পারবেন না।");
  }

  /* প্রতিটি path মোছার আগে read করে নিশ্চিত হই — কোনো path অনুমান করা হয় না। */
  const userRow = (await io.get(`users/${uid}`).catch(() => null)) as any;
  const adminRow = (await io.get(`admins/${uid}`).catch(() => null)) as any;
  const accountRows = (await io.list("accounts").catch(() => null)) || {};

  const paths: Record<string, null> = {};
  if (userRow) paths[`users/${uid}`] = null;
  if (adminRow) paths[`admins/${uid}`] = null;
  for (const [id, row] of Object.entries(accountRows)) {
    if (accountOf(row, uid)) paths[`accounts/${id}`] = null;
  }
  if (!Object.keys(paths).length) {
    throw new ApiError(404, "এই UID-এর কোনো অ্যাকাউন্ট রেকর্ড পাওয়া যায়নি — কিছু মোছা হয়নি।");
  }
  /* ইমেইলের identityIndex দাবিও ছাড়া হয় — ইমেইলটি ভবিষ্যতে আবার
     নিবন্ধনযোগ্য থাকে (duplicate রোধের সূচি আটকে রাখে না)। */
  const deletedEmail = String(userRow?.email || adminRow?.email || "").trim().toLowerCase();
  if (deletedEmail) paths[emailIndexPath(deletedEmail)] = null;

  /* ১) আগে লগইন অ্যাকাউন্ট (Firebase Authentication) — ঠিক এই uid-টিই।
        ব্যর্থ হলে কিছুই মোছা হয় না (রেকর্ড ছাড়া "অগভর্নড" লগইন রেখে দেওয়া
        বিপজ্জনক — আবার লগইন করে নতুন প্রোফাইল তৈরি করতে পারে)। */
  const warnings: string[] = [];
  const authIo = await io.deleteAuthUser(uid).catch(() => "failed" as const);
  const authOutcome = toAuthStatus(authIo);
  const steps: DeleteStepInfo[] = [];
  if (authIo === "failed") {
    throw new ApiError(
      502,
      "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication) মোছা যায়নি — " +
        "নিরাপত্তার জন্য কিছুই মোছা হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    );
  }
  if (authIo === "unconfigured") {
    warnings.push(
      "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই, তাই " +
        "লগইন অ্যাকাউন্টটি মোছা যায়নি — রেকর্ডগুলো মুছে গেছে। ডিপ্লয়ে `npx wrangler secret put " +
        "FIREBASE_SERVICE_ACCOUNT` দিন; ততক্ষণ Firebase Console → Authentication থেকে ম্যানুয়ালি মুছতে হবে।",
    );
  }
  steps.push(
    authOutcome === "deleted"
      ? { id: "auth", label: "লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true }
      : { id: "auth", label: "লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: authOutcome !== "failed", skipped: authOutcome !== "failed", error: authOutcome === "missing" ? "আগেই ছিল না" : "সার্ভার কনফিগারেশন প্রয়োজন" },
  );

  /* ২) তারপর Realtime Database রেকর্ড — শুধু এই uid-এর অ্যাকাউন্ট paths। */
  const removed = await applyPaths(io, paths);
  steps.push({ id: "rtdb", label: "Realtime Database রেকর্ড (users/admins/accounts)", ok: true, skipped: removed === 0 });

  return {
    ok: true,
    scope: "account",
    donorId: "", // ইচ্ছাকৃতভাবে — account delete donor ID জানতেও চায় না
    uid,
    name: nameOf(userRow) || nameOf(adminRow) || String(input?.name ?? "").trim(),
    rtdb: "ok",
    auth: authOutcome,
    authUid: uid,
    server: "ok",
    removed,
    warnings,
    steps,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Donor ID entity — donors/{donorId} · members/* · queue/* ·
   donations/* (ডোনারের History) · requests/* · reports/*
   + **যুক্ত থাকলে** সংশ্লিষ্ট অ্যাকাউন্ট (users/{uid} · admins/{uid} ·
   accounts/*) ও তার Firebase Authentication লগইন।

   নিরাপত্তা — "Donor ID ও Account আলাদা হলে ভুল account কখনো মুছবে না":
     • লিংকড uid শুধুই সার্ভারে `donors/{donorId}` রেকর্ড থেকে পড়া হয় —
       ক্লায়েন্ট-পাঠানো uid কখনো বিশ্বাস করা হয় না;
     • ক্লায়েন্টের uid সার্ভারের owner-এর সাথে না মিললে **কিছুই মোছা হয় না**;
     • লিংকড uid বৈধ Auth UID না হলে বা ডোনার রেকর্ডেই না থাকলে কোনো
       অ্যাকাউন্ট/লগইন স্পর্শ করা হয় না (auth = "missing");
     • লিংকড uid ডিলিট-করা অ্যাডমিনের নিজের হলে লগইন/অ্যাকাউন্ট বাদ (warning)।
   ═══════════════════════════════════════════════════════════════════ */
async function deleteDonorIdEntity(
  input: DeleteApiInput,
  callerUid: string,
  io: DeleteIo,
): Promise<ServerDeleteResult> {
  const donorId = String(input?.donorId ?? "").trim();
  if (!donorId) throw new ApiError(400, "ডোনার আইডি (Donor ID) দিতে হবে।");

  const donor = (await io.get(`donors/${donorId}`).catch(() => null)) as any;
  /* মালিকানা **শুধুই সার্ভারে পড়া** রেকর্ড থেকে — ক্লায়েন্ট uid নয়। */
  const clientUid = String(input?.uid ?? "").trim();
  let uid = ownerOf(donor);

  /* ডোনার রেকর্ড না থাকলে — অরফান ডোনার আইডি (অ্যাকাউন্টে donorId লেখা আছে,
     কিন্তু ডোনার তালিকায় রেকর্ড নেই)। identity অ্যাকাউন্ট রেকর্ড দিয়েই
     সার্ভার-যাচাই করা হয়: users/{uid}/donorId অথবা accounts/…/donorId-কে
     (মালিক uid সহ) এই donorId-এর সাথে মেলাতে হবে; নইলে কিছুই মোছা হয় না। */
  if (!donor) {
    if (!clientUid || !isAuthUid(clientUid)) {
      throw new ApiError(404, "এই ডোনার আইডির কোনো রেকর্ড পাওয়া যায়নি — কিছু মোছা হয়নি।");
    }
    const orphanUser = (await io.get(`users/${clientUid}`).catch(() => null)) as any;
    const accountRows = (await io.list("accounts").catch(() => null)) || {};
    const orphanAccountMatch = Object.values(accountRows).some(
      (r) => accountOf(r, clientUid) && String((r as any)?.donorId ?? "").trim() === donorId,
    );
    const orphanUserMatch = !!orphanUser && String(orphanUser?.donorId ?? "").trim() === donorId;
    if (!orphanUserMatch && !orphanAccountMatch) {
      throw new ApiError(404, "এই ডোনার আইডির কোনো রেকর্ড পাওয়া যায়নি — কিছু মোছা হয়নি।");
    }
    uid = clientUid;
  }

  /* ক্লায়েন্ট যদি uid পাঠায় এবং তা সার্ভারের owner-এর সাথে না মেলে —
     ভুল/পুরোনো ভিউ; নিরাপত্তায় কিছুই মোছা হয় না। */
  if (clientUid && uid && clientUid !== uid) {
    throw new ApiError(
      409,
      "ডোনার আইডি ও অ্যাকাউন্টের তথ্য মেলে না — নিরাপত্তার জন্য কিছুই মোছা হয়নি। " +
        "পেজটি রিফ্রেশ করে সঠিক তথ্য দেখে আবার চেষ্টা করুন।",
    );
  }

  const warnings: string[] = [];
  const steps: DeleteStepInfo[] = [];

  /* ডোনার-সম্পর্কিত রেকর্ড: members (আবেদন) ও queue (অনুমোদন/যাচাই)। */
  const memberRows = (await io.list("members").catch(() => null)) || {};
  const queueRows = (await io.list("queue").catch(() => null)) || {};

  const paths: Record<string, null> = {};
  paths[`donors/${donorId}`] = null;
  for (const [id, row] of Object.entries(memberRows)) {
    if (donorRecordOf(row, uid, donorId)) paths[`members/${id}`] = null;
  }
  for (const [id, row] of Object.entries(queueRows)) {
    if (donorRecordOf(row, uid, donorId)) paths[`queue/${id}`] = null;
  }

  /* ── ডোনারের নিজের কাজ/History — Permanent Delete ──
     • donations/* — এই ডোনার আইডির সব অনুমোদিত রক্তদানের রেকর্ড (History)
     • requests/* — নিজের তোলা জরুরি রক্তের আবেদন
     • reports/*  — নিজের পাঠানো অভিযোগ/সমস্যা রিপোর্ট
     শুধুই এই ডোনার/uid-এর রেকর্ড; অন্য কারও তথ্য কখনো স্পর্শ করা হয় না। */
  const donationRows = (await io.list("donations").catch(() => null)) || {};
  for (const [id, row] of Object.entries(donationRows)) {
    if (row && String((row as any)?.donorId ?? "").trim() === donorId) paths[`donations/${id}`] = null;
  }
  const requestRows = (await io.list("requests").catch(() => null)) || {};
  for (const [id, row] of Object.entries(requestRows)) {
    if (donorRecordOf(row, uid, donorId)) paths[`requests/${id}`] = null;
  }
  const reportRows = (await io.list("reports").catch(() => null)) || {};
  for (const [id, row] of Object.entries(reportRows)) {
    if (donorRecordOf(row, uid, donorId)) paths[`reports/${id}`] = null;
  }

  /* ── সংশ্লিষ্ট অ্যাকাউন্ট + লগইন — শুধুমাত্র যখন ডোনার রেকর্ডেই বৈধ
        Auth UID লেখা আছে (একই ব্যক্তির প্রমাণ); নইলে কিছুই স্পর্শ হয় না। ── */
  let authOutcome: AuthDeleteOutcome = "missing";
  let authUid = "";
  const isOwnDonor = !!uid && uid === callerUid;
  if (uid && isAuthUid(uid)) {
    authUid = uid;
    if (isOwnDonor) {
      authOutcome = "skipped";
      warnings.push(
        "এটি আপনার নিজের ডোনার রেকর্ড — লগইন অ্যাকাউন্ট ও অ্যাকাউন্ট রেকর্ড অক্ষত রাখা হয়েছে (নিজের লগইন এই পদ্ধতিতে মোছা হয় না)।",
      );
      steps.push({ id: "auth", label: "লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true, skipped: true, error: "নিজের অ্যাকাউন্ট — বাদ" });
    } else {
      const userRow = (await io.get(`users/${uid}`).catch(() => null)) as any;
      const adminRow = (await io.get(`admins/${uid}`).catch(() => null)) as any;
      const accountRows = (await io.list("accounts").catch(() => null)) || {};

      /* ১) আগে লগইন অ্যাকাউন্ট — ঠিক এই লিংকড uid-টিই। ব্যর্থ হলে কিছুই মোছা হয় না। */
      const authIo = await io.deleteAuthUser(uid).catch(() => "failed" as const);
      authOutcome = toAuthStatus(authIo);
      if (authIo === "failed") {
        throw new ApiError(
          502,
          "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication) মোছা যায়নি — " +
            "নিরাপত্তার জন্য কিছুই মোছা হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
        );
      }
      if (authIo === "unconfigured") {
        warnings.push(
          "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই, তাই সংশ্লিষ্ট " +
            "লগইন অ্যাকাউন্টটি মোছা যায়নি — ডোনার ও অ্যাকাউন্ট রেকর্ড মুছে গেছে। ডিপ্লয়ে `npx wrangler secret put " +
            "FIREBASE_SERVICE_ACCOUNT` দিন; ততক্ষণ Firebase Console → Authentication থেকে ম্যানুয়ালি মুছতে হবে।",
        );
      }
      steps.push(
        authOutcome === "deleted"
          ? { id: "auth", label: "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true }
          : { id: "auth", label: "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true, skipped: true, error: authOutcome === "missing" ? "আগেই ছিল না" : "সার্ভার কনফিগারেশন প্রয়োজন" },
      );

      /* ২) লিংকড অ্যাকাউন্ট রেকর্ড — শুধু এই uid-এরগুলোই; সাথে ইমেইলের
            identityIndex দাবিও ছাড়া হয় (ইমেইল ভবিষ্যতে পুনঃব্যবহারযোগ্য)। */
      if (userRow) paths[`users/${uid}`] = null;
      if (adminRow) paths[`admins/${uid}`] = null;
      for (const [id, row] of Object.entries(accountRows)) {
        if (accountOf(row, uid)) paths[`accounts/${id}`] = null;
      }
      const linkedEmail = String(userRow?.email || adminRow?.email || "").trim().toLowerCase();
      if (linkedEmail) paths[emailIndexPath(linkedEmail)] = null;
    }
  }

  const removed = await applyPaths(io, paths);
  steps.push({ id: "rtdb", label: "Realtime Database রেকর্ড (donors/members/queue/donations/requests/reports" + (authUid && !isOwnDonor ? "/users/admins/accounts" : "") + ")", ok: true, skipped: removed === 0 });

  return {
    ok: true,
    scope: "donor",
    donorId,
    uid,
    name: nameOf(donor) || String(input?.name ?? "").trim(),
    rtdb: "ok",
    auth: authOutcome,
    authUid,
    server: "ok",
    removed,
    warnings,
    steps,
  };
}

/** atomic multi-path delete (null values); ব্যর্থ হলে একে একে DELETE (fallback)। */
async function applyPaths(io: DeleteIo, paths: Record<string, null>): Promise<number> {
  const list = Object.keys(paths);
  if (!list.length) return 0;
  const ok = await io.apply(paths).catch(() => false);
  if (!ok) throw new ApiError(500, "Realtime Database-এর রেকর্ড মোছা যায়নি — কিছুই মোছা হয়নি।");
  return list.length;
}
