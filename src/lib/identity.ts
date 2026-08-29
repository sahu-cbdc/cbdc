/**
 * CBDC — Identity Index: একই Account/Email কখনো দ্বিতীয়বার তৈরি হয় না
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  **Firebase UID-ই primary ID** — `users/{uid}` সবসময় Auth UID দিয়ে keyed।
 *  কিন্তু "একই ইমেইল → একটিই অ্যাকাউন্ট" নিশ্চিত করতে RTDB-তে একটি atomic
 *  claim-once সূচি ব্যবহার করা হয়:
 *
 *      identityIndex/email/<encoded-email> = <Firebase UID>
 *
 *  - Realtime Database Security Rules (database.rules.json → `identityIndex`)
 *    নিশ্চিত করে: একটি ইমেইল **প্রথম যে UID claim করে সেটিই রাখে**; অন্য কোনো
 *    UID সেটি overwrite/দাবি করতে পারে না (শুধু মালিক নিজে বা অ্যাডমিন মুছতে পারে)।
 *  - `runTransaction` ব্যবহারে দুজন একসাথে claim করলেও একজনই জেতে — race-safe।
 *  - সূচি এমন পরিবেশে (পুরোনো deployed rules) না থাকলে claim ব্যর্থ হয় — তখন
 *    signup বন্ধ হয় না (fail-open); আসল conflict (অন্য UID-এর claim) হলেই কেবল
 *    ব্লক করা হয়।
 *
 *  কী এনকোডিং: RTDB কী-তে `. # $ / [ ]` নিষিদ্ধ — ইমেইল lowercase করে এই
 *  অক্ষরগুলো `_` দিয়ে বদলানো হয় (server/deleteApi.ts-এর হুবহু একই নিয়ম)।
 */

import { ref, child, runTransaction, get, remove } from "firebase/database";
import { getRtdb } from "./firebase";

/** ইমেইল → RTDB-নিরাপদ সূচি-কী (server-side কপির সাথে হুবহু একই নিয়ম)। */
export function emailIndexKey(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

const INDEX_PATH = "identityIndex/email";

/** এই ইমেইল বর্তমানে কোন UID দাবি করে আছে (না থাকলে null)। */
export async function lookupEmailOwner(email: unknown): Promise<string | null> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  if (!db || !key) return null;
  try {
    const snap = await get(child(ref(db, INDEX_PATH), key));
    const v = snap.val();
    return typeof v === "string" && v ? v : null;
  } catch {
    return null; /* পড়া না গেলে অজানা — কেউ নয় */
  }
}

export type EmailClaim =
  | { claimed: true; ownerUid: string }
  | { claimed: false; ownerUid: string; reason: "conflict" | "unavailable" };

/**
 * ইমেইল দাবি করা (atomic) — প্রথম UID-ই পায়।
 *  - claimed:true   → এই uid-ই মালিক (নতুন claim বা আগে থেকেই নিজের)।
 *  - claimed:false, reason:"conflict"   → অন্য UID আগেই দাবি করেছে — নতুন
 *    অ্যাকাউন্ট তৈরি বন্ধ (duplicate প্রতিরোধ)।
 *  - claimed:false, reason:"unavailable" → সূচি পড়া/লেখা যায়নি (পুরোনো rules
 *    বা সংযোগ) — fail-open: signup বন্ধ হয় না।
 */
export async function claimEmailIdentity(email: unknown, uid: string): Promise<EmailClaim> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  const cleanUid = String(uid || "").trim();
  if (!db || !key || !cleanUid) return { claimed: false, ownerUid: "", reason: "unavailable" };
  try {
    const res = await runTransaction(
      ref(db, `${INDEX_PATH}/${key}`),
      (current) => {
        /* কেউ না থাকলে আমি নিই; আমারটা থাকলে অপরিবর্তিত; অন্যের থাকলে abort */
        if (typeof current === "string" && current) return undefined;
        return cleanUid;
      },
    );
    const owner = typeof res.snapshot.val() === "string" ? String(res.snapshot.val()) : "";
    if (res.committed) return { claimed: true, ownerUid: cleanUid };
    if (owner === cleanUid) return { claimed: true, ownerUid: cleanUid };
    return { claimed: false, ownerUid: owner, reason: "conflict" };
  } catch (e) {
    console.warn("identity claim:", (e as Error)?.message);
    return { claimed: false, ownerUid: "", reason: "unavailable" };
  }
}

/**
 * নিজের দাবি ছাড়া (শুধু মালিক UID বা অ্যাডমিন rules-এর অনুমতিতে মুছতে পারে)।
 * অ্যাকাউন্ট ডিলিটের সময় ইমেইলটি ভবিষ্যতে আবার ব্যবহারযোগ্য রাখতে ডাকা হয়।
 */
export async function releaseEmailIdentity(email: unknown, uid: string): Promise<boolean> {
  const db = getRtdb();
  const key = emailIndexKey(email);
  if (!db || !key) return false;
  try {
    /* মালিক যাচাই করেই মুছি — অন্যের দাবি কখনো মুছি না */
    const snap = await get(child(ref(db, INDEX_PATH), key));
    if (snap.val() !== uid) return false;
    await remove(ref(db, `${INDEX_PATH}/${key}`));
    return true;
  } catch (e) {
    console.warn("identity release:", (e as Error)?.message);
    return false;
  }
}
