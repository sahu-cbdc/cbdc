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
 *       donor scope   → donors/{donorId} · members/* · queue/*    (অ্যাকাউন্ট অক্ষত)
 *   • ভুল/অমিল identity দিলে কিছুই মোছা হয় না; প্রতিটি path মোছার আগে
 *     আগে থেকেই read করে নিশ্চিত হওয়া হয়।
 *
 * এই মডিউলটি pure (I/O injected) — `DeleteIo` দিয়ে যেকোনো পরিবেশে (Worker,
 * dev middleware, verification harness) একই logic চালানো যায়।
 */

export type DeleteScope = "account" | "donor";

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

export type ServerDeleteResult = {
  ok: boolean;
  scope: DeleteScope;
  donorId: string;
  uid: string;
  name: string;
  /** Realtime Database অংশ */
  rtdb: "ok" | "failed" | "skipped";
  /** Authentication account — server-এ private key নেই, তাই skipped */
  auth: "skipped";
  /** সার্ভার endpoint-এর অবস্থা */
  server: "ok" | "failed";
  /** মোছা হয়েছে এমন RTDB path-এর সংখ্যা */
  removed: number;
  warnings: string[];
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
   Account entity — users/{uid} · admins/{uid} · accounts/*
   (ডোনার আইডি, members, queue, requests, reports, messages অক্ষত)
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

  const removed = await applyPaths(io, paths);
  return {
    ok: true,
    scope: "account",
    donorId: "", // ইচ্ছাকৃতভাবে — account delete donor ID জানতেও চায় না
    uid,
    name: nameOf(userRow) || nameOf(adminRow) || String(input?.name ?? "").trim(),
    rtdb: "ok",
    auth: "skipped",
    server: "ok",
    removed,
    warnings: [
      "Firebase Authentication (লগইন) অ্যাকাউন্টটি রয়ে গেছে — সার্ভারে কোনো private key নেই; " +
        "সেটি Firebase Console → Authentication থেকে মুছতে হবে। ডোনার আইডি অক্ষত আছে।",
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Donor ID entity — donors/{donorId} · members/* · queue/*
   (users / accounts / admins — অর্থাৎ অ্যাকাউন্ট — ইচ্ছাকৃতভাবে অক্ষত)
   ═══════════════════════════════════════════════════════════════════ */
async function deleteDonorIdEntity(
  input: DeleteApiInput,
  _callerUid: string,
  io: DeleteIo,
): Promise<ServerDeleteResult> {
  const donorId = String(input?.donorId ?? "").trim();
  if (!donorId) throw new ApiError(400, "ডোনার আইডি (Donor ID) দিতে হবে।");

  const donor = (await io.get(`donors/${donorId}`).catch(() => null)) as any;
  if (!donor) {
    throw new ApiError(404, "এই ডোনার আইডির কোনো রেকর্ড পাওয়া যায়নি — কিছু মোছা হয়নি।");
  }
  const uid = ownerOf(donor);

  /* ডোনার-সম্পর্কিত রেকর্ড: members (আবেদন) ও queue (অনুমোদন/যাচাই)।
     users/accounts/admins — অ্যাকাউন্ট — এখানে কোনোভাবেই স্পর্শ করা হয় না। */
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

  const removed = await applyPaths(io, paths);
  return {
    ok: true,
    scope: "donor",
    donorId,
    uid,
    name: nameOf(donor) || String(input?.name ?? "").trim(),
    rtdb: "ok",
    auth: "skipped",
    server: "ok",
    removed,
    warnings: [],
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
