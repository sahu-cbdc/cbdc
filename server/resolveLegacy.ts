/**
 * CBDC — পুরোনো (legacy) অ্যাকাউন্ট রেকর্ড বর্তমান Firebase UID-এ নিরাপদে মেলানো
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  `POST <base>api/account/resolve-legacy` — Google লগইনের সময় identityIndex
 *  বলে ইমেইলটি **অন্য কোনো UID** (পুরোনো সিস্টেমের রেকর্ড) দাবি করে আছে। তখন
 *  duplicate অ্যাকাউন্ট **না বানিয়ে** পুরোনো রেকর্ডের তথ্য এই UID-এ মিলিয়ে দেওয়া
 *  হয় (data consistency):
 *
 *    ১. caller-এর ID token যাচাই (যেকোনো লগইন করা ব্যবহারকারী — শুধু নিজের
 *       ইমেইলের রেকর্ডই মেলানো হয়, অন্য কারও নয়);
 *    ২. **privileged** RTDB read (server secret — service account) দিয়ে একই
 *       ইমেইলের অন্য রেকর্ড খোঁজা;
 *    ৩. ক্যানোনিকাল = caller-এর Auth UID — পুরোনো রেকর্ডের ফাঁকা ফিল্ড কপি হয়,
 *       donors/members/queue-এর মালিকানা (ownerUid/uid) নতুন UID-এ ঘোরে,
 *       পুরোনো users রেকর্ড মুছে যায়, identityIndex → নতুন UID;
 *    ৪. সবকিছু এক atomic multi-path write-এ — অর্ধেক মেলা অবস্থা থাকে না।
 *
 *  service-account secret কনফিগার না থাকলে স্পষ্ট বার্তাসহ ব্যর্থ হয় — তখন
 *  duplicate **তৈরিই হয় না** (ক্লায়েন্ট নতুন অ্যাকাউন্ট লেখা বন্ধ রাখে এবং
 *  অ্যাডমিনের dedupe scan-এর নির্দেশনা দেখায়)।
 */

import { ApiError } from "./deleteApi";
import { emailIndexPath } from "./identityKey";

export type ResolveLegacyIo = {
  /** caller-এর Firebase ID token যাচাই → { uid, email } */
  verifyCaller(idToken: string): Promise<{ uid: string; email: string } | null>;
  /** privileged RTDB (service account) — rules বাইপাস; secret না থাকলে ব্যর্থ */
  get(path: string): Promise<unknown>;
  list(node: string): Promise<Record<string, any> | null>;
  apply(paths: Record<string, unknown>): Promise<boolean>;
};

export type ResolveLegacyResult = {
  ok: boolean;
  /** কোনো legacy রেকর্ড ছিল ও মিলে গেছে কি না */
  merged: boolean;
  uid: string;
  email: string;
  /** মিলিত চূড়ান্ত প্রোফাইল (ক্লায়েন্ট সরাসরি প্যানেলে ঢোকার জন্য) */
  profile?: Record<string, any>;
  /** এই uid-এর ডোনার আইডি (থাকলে) */
  donorId?: string;
  error?: string;
};

/** ক্যানোনিকালে কপি-যোগ্য scalar ফিল্ড (ফাঁকা থাকলেই) */
const FILL_FIELDS = [
  "name", "username", "phone", "dob", "gender", "area", "district", "address",
  "photoURL", "provider", "bloodGroup", "donorStatus", "whatsapp", "lastDonation",
  "health", "cardTheme", "createdAt", "joined",
] as const;

function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export async function handleResolveLegacy(
  input: { idToken?: string } | null | undefined,
  io: ResolveLegacyIo,
): Promise<ResolveLegacyResult> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const caller = await io.verifyCaller(idToken).catch(() => null);
  if (!caller || !caller.uid || !caller.email) {
    throw new ApiError(401, "লগইন যাচাই ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  }
  const uid = caller.uid;
  const email = normEmail(caller.email);

  /* এই ইমেইলের সব রেকর্ড (privileged read) — সার্ভার কনফিগারেশন না থাকলে
     (৫০৩) স্পষ্টভাবেই ব্যর্থ হয়; ক্লায়েন্ট তখন duplicate না বানিয়ে
     অ্যাডমিন dedupe-এর নির্দেশনা দেখায়। */
  const userRows = (await io.list("users").catch((e) => {
    if (e instanceof ApiError) throw e;
    return null;
  })) || {};
  const mine = (userRows[uid] || null) as any;
  const legacy = Object.entries(userRows).filter(
    ([id, row]) => id !== uid && row && normEmail((row as any)?.email) === email,
  ) as Array<[string, any]>;

  if (!legacy.length) {
    return { ok: true, merged: false, uid, email };
  }

  const paths: Record<string, unknown> = {};
  /* ফাঁকা ফিল্ড পূরণ — বিদ্যমান মান কখনো overwrite হয় না */
  for (const [, lrow] of legacy) {
    for (const f of FILL_FIELDS) {
      const cur = String(mine?.[f] ?? "").trim();
      const alt = String(lrow?.[f] ?? "").trim();
      if (!cur && alt) paths[`users/${uid}/${f}`] = alt;
    }
  }
  paths[`users/${uid}/email`] = email;

  /* ডোনার/আবেদন/কিউ রেকর্ডের মালিকানা নতুন UID-এ */
  const donorIdByLegacy = new Map<string, string>();
  const donors = (await io.list("donors").catch(() => null)) || {};
  for (const [id, row] of Object.entries(donors)) {
    const owner = String((row as any)?.ownerUid || (row as any)?.uid || "").trim();
    if (legacy.some(([lid]) => lid === owner)) {
      paths[`donors/${id}/ownerUid`] = uid;
      paths[`donors/${id}/uid`] = uid;
      donorIdByLegacy.set(owner, id);
    }
  }
  const members = (await io.list("members").catch(() => null)) || {};
  for (const [id, row] of Object.entries(members)) {
    const owner = String((row as any)?.uid || (row as any)?.ownerUid || "").trim();
    if (legacy.some(([lid]) => lid === owner)) {
      paths[`members/${id}/uid`] = uid;
      paths[`members/${id}/ownerUid`] = uid;
    }
  }
  const queue = (await io.list("queue").catch(() => null)) || {};
  for (const [id, row] of Object.entries(queue)) {
    const owner = String((row as any)?.ownerUid || "").trim();
    if (legacy.some(([lid]) => lid === owner)) {
      paths[`queue/${id}/ownerUid`] = uid;
    }
  }

  /* পুরোনো users রেকর্ড মুছে যায়; ইমেইল-দাবি নতুন UID-এ ঘোরে */
  for (const [lid, lrow] of legacy) {
    paths[`users/${lid}`] = null;
    if (normEmail(lrow?.email) === email) paths[emailIndexPath(email)] = uid;
  }

  const okApply = await io.apply(paths).catch(() => false);
  if (!okApply) throw new ApiError(500, "পুরোনো রেকর্ড মেলানো যায়নি — কিছু বদলায়নি, আবার চেষ্টা করুন।");

  /* চূড়ান্ত মিলিত প্রোফাইল */
  const finalProfile = ((await io.get(`users/${uid}`).catch(() => null)) || mine || {}) as any;
  const donorId =
    String(finalProfile?.donorId || "").trim() ||
    donorIdByLegacy.get(uid) ||
    [...donorIdByLegacy.values()][0] ||
    "";

  return {
    ok: true,
    merged: true,
    uid,
    email,
    donorId: donorId || undefined,
    profile: { ...finalProfile, uid, email },
  };
}
