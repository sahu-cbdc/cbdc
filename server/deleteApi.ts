

import { emailIndexPath } from "./identityKey.ts";
import { type AuthDeleteOutcome as AuthDeleteIoOutcome } from "./authAdmin.ts";

export type DeleteScope = "account" | "donor";


/** User-facing outcome: the IO "unconfigured" state surfaces as "skipped". */
export type AuthDeleteStatus = "deleted" | "missing" | "failed" | "skipped";


function toAuthStatus(outcome: AuthDeleteIoOutcome): AuthDeleteStatus {
  return outcome === "unconfigured" ? "skipped" : outcome;
}


export type DeleteIo = {
  
  verifyToken(idToken: string): Promise<{ uid: string } | null>;
  
  get(path: string): Promise<unknown>;
  
  list(node: string): Promise<Record<string, any> | null>;
  
  apply(paths: Record<string, null>): Promise<boolean>;
  
  deleteAuthUser(uid: string): Promise<AuthDeleteIoOutcome>;
};


export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}


const AUTH_UID_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isAuthUid(value: unknown): boolean {
  return AUTH_UID_RE.test(String(value ?? "").trim());
}


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


function accountOf(row: any, uid: string): boolean {
  if (!row || typeof row !== "object") return false;
  if (ownerOf(row) === uid) return true;
  return String(row?.id ?? "").trim() === uid;
}


function donorRecordOf(row: any, uid: string, donorId: string): boolean {
  if (!row || typeof row !== "object") return false;
  if (uid && ownerOf(row) === uid) return true;
  if (String(row?.id ?? "").trim() === uid) return true;
  if (donorId && String(row?.donorId ?? "").trim() === donorId) return true;
  if (String(row?.id ?? "").trim() === donorId) return true;
  
  const short = donorId.replace(/[^A-Za-z0-9]/g, "").slice(-10);
  if (short && /^PD-/.test(String(row?.id ?? "")) && String(row?.id ?? "").includes(short)) return true;
  return false;
}

export type DeleteStepInfo = {
  id: string;
  label: string;
  ok: boolean;
  
  skipped?: boolean;
  error?: string;
};

export type ServerDeleteResult = {
  ok: boolean;
  scope: DeleteScope;
  donorId: string;
  uid: string;
  name: string;
  
  rtdb: "ok" | "failed" | "skipped";
  
  auth: AuthDeleteStatus;
  
  authUid: string;
  
  server: "ok" | "failed";
  
  removed: number;
  warnings: string[];
  
  steps?: DeleteStepInfo[];
  
  error?: string;
};

export type DeleteApiInput = {
  scope?: string;
  donorId?: string;
  uid?: string;
  name?: string;
  
  idToken?: string;
};


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

  
  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }

  
  const me = (await io.get(`admins/${caller.uid}`).catch(() => null)) as any;
  const role = String((me && me.role) || "").toLowerCase();
  const status = String((me && me.status) || "active").toLowerCase();
  if (role !== "admin" || status === "disabled") {
    throw new ApiError(403, "শুধু অ্যাডমিন এই কাজ করতে পারেন।");
  }

  
  return scope === "account"
    ? deleteAccountEntity(input, caller.uid, io)
    : deleteDonorIdEntity(input, caller.uid, io);
}


export async function handleAdminConfigCheck(
  input: { idToken?: string } | null | undefined,
  io: DeleteIo,
  config: { serviceAccountConfigured: boolean; imgbbConfigured: boolean },
): Promise<{ ok: true; serviceAccountConfigured: boolean; imgbbConfigured: boolean }> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }
  const me = (await io.get(`admins/${caller.uid}`).catch(() => null)) as any;
  const role = String((me && me.role) || "").toLowerCase();
  const status = String((me && me.status) || "active").toLowerCase();
  if (role !== "admin" || status === "disabled") {
    throw new ApiError(403, "শুধু অ্যাডমিন এই কাজ করতে পারেন।");
  }
  return {
    ok: true,
    serviceAccountConfigured: !!config.serviceAccountConfigured,
    imgbbConfigured: !!config.imgbbConfigured,
  };
}


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

  
  const userRow = (await io.get(`users/${uid}`).catch(() => null)) as any;
  const adminRow = (await io.get(`admins/${uid}`).catch(() => null)) as any;
  const accountRows = (await io.list("accounts").catch(() => null)) || {};

  const paths: Record<string, null> = {};
  if (userRow) paths[`users/${uid}`] = null;
  if (adminRow) paths[`admins/${uid}`] = null;
  for (const [id, row] of Object.entries(accountRows)) {
    if (accountOf(row, uid)) paths[`accounts/${id}`] = null;
  }
  
  
  const deletedEmail = String(userRow?.email || adminRow?.email || "").trim().toLowerCase();
  if (deletedEmail) paths[emailIndexPath(deletedEmail)] = null;

  
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
    throw new ApiError(
      503,
      "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই, তাই লগইন " +
        "অ্যাকাউন্টটি মোছা সম্ভব নয়। নিরাপত্তার জন্য **কিছুই মোছা হয়নি** (আংশিক ডিলিট প্রতিরোধ)। " +
        "ডিপ্লয়ে `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (dev-এ environment variable সেট করে) আবার চেষ্টা করুন।",
    );
  }
  steps.push(
    authOutcome === "deleted"
      ? { id: "auth", label: "লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true }
      : { id: "auth", label: "লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true, skipped: true, error: "আগেই ছিল না" },
  );

  
  if (!Object.keys(paths).length) {
    steps.push({ id: "rtdb", label: "Realtime Database রেকর্ড (users/admins/accounts)", ok: true, skipped: true });
    return {
      ok: true,
      scope: "account",
      donorId: "",
      uid,
      name: nameOf(userRow) || nameOf(adminRow) || String(input?.name ?? "").trim(),
      rtdb: "ok",
      auth: authOutcome,
      authUid: uid,
      server: "ok",
      removed: 0,
      warnings,
      steps,
    };
  }

  
  const removed = await applyPaths(io, paths);
  steps.push({ id: "rtdb", label: "Realtime Database রেকর্ড (users/admins/accounts)", ok: true, skipped: removed === 0 });

  return {
    ok: true,
    scope: "account",
    donorId: "", 
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


async function deleteDonorIdEntity(
  input: DeleteApiInput,
  callerUid: string,
  io: DeleteIo,
): Promise<ServerDeleteResult> {
  const donorId = String(input?.donorId ?? "").trim();
  if (!donorId) throw new ApiError(400, "ডোনার আইডি (Donor ID) দিতে হবে।");

  const donor = (await io.get(`donors/${donorId}`).catch(() => null)) as any;
  
  const clientUid = String(input?.uid ?? "").trim();
  let uid = ownerOf(donor);

  
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

  
  if (clientUid && uid && clientUid !== uid) {
    throw new ApiError(
      409,
      "ডোনার আইডি ও অ্যাকাউন্টের তথ্য মেলে না — নিরাপত্তার জন্য কিছুই মোছা হয়নি। " +
        "পেজটি রিফ্রেশ করে সঠিক তথ্য দেখে আবার চেষ্টা করুন।",
    );
  }

  const warnings: string[] = [];
  const steps: DeleteStepInfo[] = [];

  
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

  
  let authOutcome: AuthDeleteStatus = "missing";
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
        throw new ApiError(
          503,
          "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই, তাই সংশ্লিষ্ট " +
            "লগইন অ্যাকাউন্টটি মোছা সম্ভব নয়। নিরাপত্তার জন্য **কিছুই মোছা হয়নি** (আংশিক ডিলিট প্রতিরোধ)। " +
            "ডিপ্লয়ে `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (dev-এ environment variable সেট করে) আবার চেষ্টা করুন।",
        );
      }
      steps.push(
        authOutcome === "deleted"
          ? { id: "auth", label: "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true }
          : { id: "auth", label: "সংশ্লিষ্ট লগইন অ্যাকাউন্ট (Firebase Authentication)", ok: true, skipped: true, error: "আগেই ছিল না" },
      );

      
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


async function applyPaths(io: DeleteIo, paths: Record<string, null>): Promise<number> {
  const list = Object.keys(paths);
  if (!list.length) return 0;
  const ok = await io.apply(paths).catch(() => false);
  if (!ok) throw new ApiError(500, "Realtime Database-এর রেকর্ড মোছা যায়নি — কিছুই মোছা হয়নি।");
  return list.length;
}
