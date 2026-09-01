

import { ref, child, runTransaction, get, remove } from "firebase/database";
import { getRtdb } from "./firebase";


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

export async function claimEmailIdentity(email: unknown, uid: string): Promise<EmailClaim> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  const cleanUid = String(uid || "").trim();
  if (!db || !key || !cleanUid) return { claimed: false, ownerUid: "", reason: "unavailable" };

  const attempt = async (): Promise<EmailClaim> => {
    const res = await runTransaction(
      ref(db, `${INDEX_PATH}/${key}`),
      (current) => nextIdentityUid(current, cleanUid),
      { applyLocally: false },
    );
    const owner = typeof res.snapshot.val() === "string" ? String(res.snapshot.val()) : "";
    if (res.committed || owner === cleanUid) return { claimed: true, ownerUid: cleanUid };
    if (owner) return { claimed: false, ownerUid: owner, reason: "conflict" };
    return { claimed: false, ownerUid: "", reason: "unavailable" };
  };

  let last: EmailClaim = { claimed: false, ownerUid: "", reason: "unavailable" };
  for (let i = 0; i < 3; i++) {
    try {
      last = await attempt();
      if (last.claimed || last.reason === "conflict") return last;
    } catch (e) {
      console.warn("identity claim:", (e as Error)?.message);
      last = { claimed: false, ownerUid: "", reason: "unavailable" };
    }
    if (i < 2) await sleep(180 * (i + 1));
  }
  return last;
}


export async function releaseEmailIdentity(email: unknown, uid: string): Promise<boolean> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  if (!db || !key) return false;
  try {
    
    const snap = await get(child(ref(db, INDEX_PATH), key));
    if (snap.val() !== uid) return false;
    await remove(ref(db, `${INDEX_PATH}/${key}`));
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


export async function claimLoginKey(
  kind: "username" | "phone",
  value: unknown,
  email: unknown,
): Promise<LoginClaim> {
  const db = getRtdb();
  const key = loginIndexKey(value);
  const mail = String(email ?? "").trim().toLowerCase();
  if (!db || !key || !mail) return { claimed: false, reason: "unavailable" };
  try {
    const res = await runTransaction(
      ref(db, `${LOGIN_PATH}/${kind}/${key}`),
      (current) => {
        if (typeof current === "string" && current && current !== mail) return undefined;
        return mail;
      },
      { applyLocally: false },
    );
    const owner = typeof res.snapshot.val() === "string" ? String(res.snapshot.val()) : "";
    if (res.committed || owner === mail) return { claimed: true };
    return { claimed: false, reason: "conflict" };
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
  const db = getRtdb();
  const key = loginIndexKey(value);
  const mail = String(email ?? "").trim().toLowerCase();
  if (!db || !key || !mail) return false;
  try {
    const snap = await get(child(ref(db, `${LOGIN_PATH}/${kind}`), key));
    if (snap.val() !== mail) return false;
    await remove(ref(db, `${LOGIN_PATH}/${kind}/${key}`));
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
  await claimLoginKey("username", username, mail);
  await claimLoginKey("phone", phone, mail);
}


export async function releaseLoginEntries(
  email: unknown,
  username: unknown,
  phone: unknown,
): Promise<void> {
  const mail = String(email ?? "").trim().toLowerCase();
  if (!mail) return;
  await releaseLoginKey("username", username, mail);
  await releaseLoginKey("phone", phone, mail);
}
