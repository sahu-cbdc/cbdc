/**
 * Identity & login indexes.
 *
 * Lookups stay as direct reads (loginIndex is public by design for
 * username→email login resolution; identityIndex is auth-read).
 * CLAIMS and RELEASES are compare-and-set operations and now run on the
 * server (POST /api/auth — op claim-email / claim-login) so the
 * browser no longer needs write access to the index nodes at all.
 */
import { child, get, ref } from "firebase/database";
import { getRtdb } from "./firebase";
import { apiClaimEmail, apiClaimLogin, apiReleaseLogin, apiReleaseEmailIdentity } from "./api";

export function emailIndexKey(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

const INDEX_PATH = "identityIndex/email";

export async function lookupEmailOwner(email: unknown): Promise<string | null> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  if (!db || !key) return null;
  try {
    const snap = await get(child(ref(db, INDEX_PATH), key));
    const v = snap.val();
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}

export type EmailClaim =
  | { claimed: true; ownerUid: string }
  | { claimed: false; ownerUid: string; reason: "conflict" | "unavailable" };

/** Transaction reducer: keep another owner's uid, otherwise claim `uid`. */
export function nextIdentityUid(current: unknown, uid: string): string | undefined {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return undefined;
  if (typeof current === "string" && current && current !== cleanUid) return undefined;
  return cleanUid;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Claim identityIndex/email/<key> = caller uid on the server.
 * The uid is derived from the verified ID token — never client-supplied.
 */
export async function claimEmailIdentity(email: unknown, uid: string): Promise<EmailClaim> {
  void uid;
  const address = String(email ?? "").trim();
  if (!address) return { claimed: false, ownerUid: "", reason: "unavailable" };
  let last: EmailClaim = { claimed: false, ownerUid: "", reason: "unavailable" };
  for (let i = 0; i < 3; i++) {
    try {
      const res = await apiClaimEmail(address);
      if (res.status === "claimed") return { claimed: true, ownerUid: String(uid || "") };
      if (res.status === "conflict") return { claimed: false, ownerUid: res.ownerUid || "", reason: "conflict" };
      last = { claimed: false, ownerUid: "", reason: "unavailable" };
    } catch (e) {
      console.warn("identity claim:", (e as Error)?.message);
      last = { claimed: false, ownerUid: "", reason: "unavailable" };
    }
    if (i < 2) await sleep(80 * (i + 1));
  }
  return last;
}

export async function releaseEmailIdentity(email: unknown, uid: string): Promise<boolean> {
  void uid;
  const address = String(email ?? "").trim();
  if (!address) return false;
  try {
    await apiReleaseEmailIdentity(address);
    return true;
  } catch (e) {
    console.warn("identity release:", (e as Error)?.message);
    return false;
  }
}

const LOGIN_PATH = "loginIndex";

export function loginIndexKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

export async function lookupLoginKey(
  kind: "username" | "phone",
  value: unknown,
): Promise<string | null> {
  const db = getRtdb();
  const key = loginIndexKey(value);
  if (!db || !key) return null;
  try {
    const snap = await get(child(ref(db, `${LOGIN_PATH}/${kind}`), key));
    const v = snap.val();
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}

export type LoginClaim =
  | { claimed: true }
  | { claimed: false; reason: "conflict" | "unavailable" };

/** Claim loginIndex/{kind}/<key> = caller email on the server. */
export async function claimLoginKey(
  kind: "username" | "phone",
  value: unknown,
  email: unknown,
): Promise<LoginClaim> {
  const key = loginIndexKey(value);
  const mail = String(email ?? "").trim().toLowerCase();
  if (!key || !mail) return { claimed: false, reason: "unavailable" };
  try {
    const res =
      kind === "username"
        ? await apiClaimLogin(mail, String(value ?? ""), "")
        : await apiClaimLogin(mail, "", String(value ?? ""));
    const outcome = String(res?.results?.[kind] || "unavailable");
    if (outcome === "claimed") return { claimed: true };
    if (outcome === "conflict") return { claimed: false, reason: "conflict" };
    return { claimed: false, reason: "unavailable" };
  } catch (e) {
    console.warn("login claim:", (e as Error)?.message);
    return { claimed: false, reason: "unavailable" };
  }
}

export async function releaseLoginKey(
  kind: "username" | "phone",
  value: unknown,
  email: unknown,
): Promise<boolean> {
  const key = loginIndexKey(value);
  const mail = String(email ?? "").trim().toLowerCase();
  if (!key || !mail) return false;
  try {
    await apiReleaseLogin(mail, kind === "username" ? String(value ?? "") : "", kind === "phone" ? String(value ?? "") : "");
    return true;
  } catch (e) {
    console.warn("login release:", (e as Error)?.message);
    return false;
  }
}

export async function claimLoginEntries(
  email: unknown,
  username: unknown,
  phone: unknown,
): Promise<void> {
  const mail = String(email ?? "").trim().toLowerCase();
  if (!mail) return;
  try {
    await apiClaimLogin(mail, String(username ?? ""), String(phone ?? ""));
  } catch (e) {
    console.warn("login claim:", (e as Error)?.message);
  }
}

export async function releaseLoginEntries(
  email: unknown,
  username: unknown,
  phone: unknown,
): Promise<void> {
  const mail = String(email ?? "").trim().toLowerCase();
  if (!mail) return;
  try {
    await apiReleaseLogin(mail, String(username ?? ""), String(phone ?? ""));
  } catch (e) {
    console.warn("login release:", (e as Error)?.message);
  }
}
