/**
 * Account endpoints: own-profile upsert + identity/login index claims.
 *
 *   POST /api/auth {op:"profile"}  — upsert users/{caller.uid} (server merge)
 *   POST /api/auth {op:"claim-email"} — identityIndex/email claim (CAS)
 *   POST /api/auth {op:"claim-login"} — loginIndex username/phone claims
 *
 * The caller's uid/email ALWAYS come from the verified ID token; anything the
 * client sends for uid is ignored (IDOR-safe). Computed writes are re-checked
 * through the same write guard used by /api/data/write.
 */
import { ApiError } from "./deleteApi.ts";
import { emailIndexKey, emailIndexPath } from "./identityKey.ts";
import { authorizeDataWrite, callerRoleFromAdminRow, type Caller } from "./writeGuard.ts";

export type ProfileIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  getAdminRow(uid: string): Promise<any>;
  get(path: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

function loginIndexKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

async function resolveCaller(io: ProfileIo, idToken: string): Promise<{ caller: Caller; uid: string; email: string }> {
  const token = String(idToken || "").trim();
  if (!token) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const verified = await io.verifyToken(token).catch(() => null);
  if (!verified || !verified.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }
  const uid = String(verified.uid);
  const email = String(verified.email || "").trim().toLowerCase();
  const adminRow = await io.getAdminRow(uid).catch(() => null);
  return { caller: callerRoleFromAdminRow(adminRow, uid, email), uid, email };
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function keep(incoming: unknown, prev: unknown): string | undefined {
  const v = String(incoming || "").trim();
  if (v) return v;
  const p = String(prev || "").trim();
  return p || undefined;
}

/** Faithful server port of the previous client-side ensureUserProfile merge. */
export function buildProfileUpsert(
  uid: string,
  tokenEmail: string,
  user: Record<string, any>,
  existing: Record<string, any> | null,
  provider: string
): Record<string, any> {
  const now = new Date().toISOString();
  const photoURL = String(existing?.photoURL || user.photo || "").trim();
  const base: Record<string, any> = {
    uid,
    email: String(tokenEmail || user.email || existing?.email || "").toLowerCase(),
    name: user.name || existing?.name || "",
    photoURL,
    updatedAt: now,
  };
  const dob = keep(user.dob, existing?.dob);
  const phone = keep(user.phone, existing?.phone);
  const gender = keep(user.gender, existing?.gender);
  const area = keep(user.area, existing?.area);
  const district = keep(user.district, existing?.district);
  const username = keep(user.username, existing?.username);
  const address = keep(user.address, existing?.address);
  if (dob) base.dob = dob;
  if (phone) base.phone = phone;
  if (gender) base.gender = gender;
  if (area) base.area = area;
  if (district) base.district = district;
  if (username) base.username = username;
  if (address) base.address = address;

  const bloodGroup = keep(user.bloodGroup, existing?.bloodGroup);
  const donorId = keep(user.donorId, existing?.donorId);
  const donorStatus = keep(user.donorStatus, existing?.donorStatus);
  const lastDonation = keep(user.lastDonation, existing?.lastDonation);
  const whatsapp = keep(user.whatsapp, existing?.whatsapp);
  const health = keep(user.health, existing?.health);
  const appliedAt = keep(user.appliedAt, existing?.appliedAt);
  const cardTheme = keep(user.cardTheme, existing?.cardTheme);
  if (bloodGroup) base.bloodGroup = bloodGroup;
  if (donorId) base.donorId = donorId;
  if (donorStatus) base.donorStatus = donorStatus;
  if (lastDonation !== undefined) {
    if (lastDonation) base.lastDonation = lastDonation;
    else if (String(user.lastDonation ?? "") === "" && String(existing?.lastDonation ?? "") === "" && user.lastDonation === "") {
      base.lastDonation = "";
    }
  }
  if (whatsapp !== undefined) {
    if (whatsapp) base.whatsapp = whatsapp;
    else if (user.whatsapp === "") base.whatsapp = "";
  }
  if (health !== undefined) {
    if (health) base.health = health;
    else if (user.health === "") base.health = "";
  }
  if (appliedAt) base.appliedAt = appliedAt;
  if (cardTheme) base.cardTheme = cardTheme;
  if (user.available !== undefined) base.available = !!user.available;
  else if (existing?.available !== undefined) base.available = !!existing.available;
  if (provider) base.provider = provider;
  if (!existing) {
    base.role = "donor";
    base.status = "active";
    base.createdAt = now;
    if (!base.donorStatus && bloodGroup) base.donorStatus = "pending";
    return base;
  }
  if (!existing.donorStatus && bloodGroup && !base.donorStatus) base.donorStatus = "pending";
  return base;
}

export async function handleProfileUpsert(
  input: Record<string, unknown> | null | undefined,
  io: ProfileIo
): Promise<{ ok: true; created: boolean; profile: Record<string, any> }> {
  const { caller, uid, email } = await resolveCaller(io, String(input?.idToken ?? ""));
  const user = isPlainObject((input as any)?.user) ? (input as any).user : {};
  if (user.uid && String(user.uid) !== uid) {
    throw new ApiError(403, "অন্য অ্যাকাউন্টের প্রোফাইল বদলানো যাবে না।");
  }
  const mode = String((input as any)?.mode || "upsert");
  const provider = String((input as any)?.provider || "");
  const existing = (await io.get(`users/${uid}`).catch(() => null)) || null;

  let record: Record<string, any>;
  if (mode === "create" && !existing) {
    record = {
      ...user,
      uid,
      email: String(email || user.email || "").toLowerCase(),
      updatedAt: new Date().toISOString(),
    };
    if (!record.role) record.role = "donor";
    if (!record.createdAt) record.createdAt = new Date().toISOString();
  } else {
    record = buildProfileUpsert(uid, email, user, existing, provider);
  }

  const plan = await authorizeDataWrite(caller, { writes: { [`users/${uid}`]: record } }, io);
  await io.patch(plan.patch);

  const username = keep(user.username, existing?.username) || "";
  const phone = keep(user.phone, existing?.phone) || "";
  const claimEmail = String(record.email || email || "").toLowerCase();
  if (claimEmail) {
    await claimLoginIndexes(io, claimEmail, username, phone).catch(() => undefined);
  }
  return { ok: true, created: !existing, profile: record };
}

async function claimLoginIndexes(
  io: ProfileIo,
  email: string,
  username: string,
  phone: string
): Promise<void> {
  const jobs: Array<Promise<string>> = [];
  if (username) jobs.push(claimOneLoginKey(io, "username", username, email));
  if (phone) jobs.push(claimOneLoginKey(io, "phone", phone, email));
  await Promise.all(jobs);
}

async function claimOneLoginKey(
  io: ProfileIo,
  kind: "username" | "phone",
  rawValue: unknown,
  email: string
): Promise<"claimed" | "conflict" | "unavailable"> {
  const key = loginIndexKey(rawValue);
  const mail = String(email || "").trim().toLowerCase();
  if (!key || !mail || !mail.includes("@")) return "unavailable";
  const path = `loginIndex/${kind}/${key}`;
  try {
    const cur = await io.get(path).catch(() => null);
    if (typeof cur === "string" && cur && cur !== mail) return "conflict";
    await io.patch({ [path]: mail });
    const verify = await io.get(path).catch(() => null);
    if (verify === mail) return "claimed";
    if (typeof verify === "string" && verify && verify !== mail) return "conflict";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

async function releaseOneLoginKey(
  io: ProfileIo,
  kind: "username" | "phone",
  rawValue: unknown,
  email: string
): Promise<void> {
  const key = loginIndexKey(rawValue);
  const mail = String(email || "").trim().toLowerCase();
  if (!key || !mail) return;
  const path = `loginIndex/${kind}/${key}`;
  try {
    const cur = await io.get(path).catch(() => null);
    if (cur === mail) await io.patch({ [path]: null });
  } catch {
    return;
  }
}

export async function handleClaimEmail(
  input: Record<string, unknown> | null | undefined,
  io: ProfileIo
): Promise<{ ok: true; status: "claimed" | "conflict" | "unavailable" | "released"; ownerUid?: string }> {
  const { uid } = await resolveCaller(io, String(input?.idToken ?? ""));
  const email = String((input as any)?.email ?? "").trim().toLowerCase();
  const release = (input as any)?.release === true;
  if (!email || !email.includes("@")) {
    throw new ApiError(400, "সঠিক ইমেইল ঠিকানা দিন।");
  }
  const path = emailIndexPath(email);
  const keyOk = emailIndexKey(email);
  if (!keyOk) throw new ApiError(400, "সঠিক ইমেইল ঠিকানা দিন।");
  try {
    const cur = await io.get(path).catch(() => null);
    if (release) {
      if (typeof cur === "string" && cur === uid) {
        await io.patch({ [path]: null });
        return { ok: true, status: "released" };
      }
      return { ok: true, status: "released" };
    }
    if (typeof cur === "string" && cur && cur !== uid) {
      return { ok: true, status: "conflict", ownerUid: cur };
    }
    if (cur === uid) return { ok: true, status: "claimed" };
    await io.patch({ [path]: uid });
    const verify = await io.get(path).catch(() => null);
    if (verify === uid) return { ok: true, status: "claimed" };
    if (typeof verify === "string" && verify) {
      return { ok: true, status: "conflict", ownerUid: verify };
    }
    return { ok: true, status: "unavailable" };
  } catch {
    return { ok: true, status: "unavailable" };
  }
}

export async function handleClaimLogin(
  input: Record<string, unknown> | null | undefined,
  io: ProfileIo
): Promise<{ ok: true; results: Record<string, string> }> {
  const { email } = await resolveCaller(io, String(input?.idToken ?? ""));
  const body = input as any;
  const release = body?.release === true;
  const fallbackEmail = String(body?.email ?? "").trim().toLowerCase();
  const mail = (email && email.includes("@") ? email : fallbackEmail) || "";
  if (!mail || !mail.includes("@")) {
    throw new ApiError(400, "সঠিক ইমেইল ঠিকানা দিন।");
  }
  const username = String(body?.username ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const results: Record<string, string> = {};
  if (release) {
    if (username) await releaseOneLoginKey(io, "username", username, mail).catch(() => undefined);
    if (phone) await releaseOneLoginKey(io, "phone", phone, mail).catch(() => undefined);
    return { ok: true, results: { username: "released", phone: "released" } };
  }
  if (username) {
    results.username = await claimOneLoginKey(io, "username", username, mail);
  }
  if (phone) {
    results.phone = await claimOneLoginKey(io, "phone", phone, mail);
  }
  return { ok: true, results };
}
