

import { ApiError } from "./deleteApi.ts";
import { emailIndexPath } from "./identityKey.ts";

export type ResolveLegacyIo = {
  
  verifyCaller(idToken: string): Promise<{ uid: string; email: string } | null>;
  
  get(path: string): Promise<unknown>;
  list(node: string): Promise<Record<string, any> | null>;
  apply(paths: Record<string, unknown>): Promise<boolean>;
};

export type ResolveLegacyResult = {
  ok: boolean;
  
  merged: boolean;
  uid: string;
  email: string;
  
  profile?: Record<string, any>;
  
  donorId?: string;
  error?: string;
};


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
  
  for (const [, lrow] of legacy) {
    for (const f of FILL_FIELDS) {
      const cur = String(mine?.[f] ?? "").trim();
      const alt = String(lrow?.[f] ?? "").trim();
      if (!cur && alt) paths[`users/${uid}/${f}`] = alt;
    }
  }
  paths[`users/${uid}/email`] = email;

  
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

  
  for (const [lid, lrow] of legacy) {
    paths[`users/${lid}`] = null;
    if (normEmail(lrow?.email) === email) paths[emailIndexPath(email)] = uid;
  }

  const okApply = await io.apply(paths).catch(() => false);
  if (!okApply) throw new ApiError(500, "পুরোনো রেকর্ড মেলানো যায়নি — কিছু বদলায়নি, আবার চেষ্টা করুন।");

  
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
