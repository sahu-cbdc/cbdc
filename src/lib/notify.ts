/**
 * CBDC — Notification System (Realtime Database)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  প্রতিটি notification RTDB-র `notifications/{recipientUid}/{notifId}` নোডে
 *  সংরক্ষিত হয় — কোনো hardcoded/demo notification নেই। ডোনার প্যানেল সেই নোডে
 *  live listener বসায়, তাই Admin approve/reject বা জরুরি আবেদনের notification
 *  পেজ refresh ছাড়াই সাথে সাথে দেখা যায়।
 *
 *  প্রতিটি notification-এ `expiresAt` থাকে (তৈরির ২৪ ঘণ্টা পরে); ডোনার প্যানেল
 *  expired notification-গুলো RTDB থেকেও মুছে ফেলে (স্বয়ংক্রিয় cleanup)।
 *
 *  Write rule: কোনো authenticated user matching donor-কে জরুরি notification
 *  পাঠাতে পারে (toUid যাচাইসহ), staff ও recipient নিজেও লিখতে পারে — দেখুন
 *  database.rules.json → `notifications`।
 */
import { NODES } from "./firebase";
import { addRow, setRow, listOnce, nowIso } from "./rtdb";

/** Notification-এর জীবনকাল — ২৪ ঘণ্টা। */
export const NOTIF_EXPIRE_MS = 24 * 60 * 60 * 1000;

export type NotifType = "approval" | "rejected" | "emergency" | "info";

export type NotifInput = {
  toUid: string;
  title: string;
  body: string;
  type: NotifType;
  /** যে কাজ/রেকর্ডের সাথে যুক্ত (queue id / request id / donor id) */
  ref?: string;
  /** ক্লিকে কোথায় যাবে — "req:for" | "req:mine" | "req:become" | "set:donor" | "set:adddonation" */
  go?: string;
};

/** RTDB key-তে ব্যবহারযোগ্য নিরাপদ id — duplicate notification প্রতিরোধেও কাজে লাগে। */
export function sanitizeKey(s: string): string {
  return String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "n";
}

/** ২৪ ঘণ্টা পরে মেয়াদোত্তীর্ণ হওয়ার ISO timestamp। */
export function notifExpiry(): string {
  return new Date(Date.now() + NOTIF_EXPIRE_MS).toISOString();
}

/**
 * একটি notification লেখে। `key` দিলে deterministic id-তে লেখা হয় (একই
 * কাজের notification বারবার লেখা হলে duplicate হয় না — overwrite হয়)।
 */
export async function notifyUser(input: NotifInput, key?: string): Promise<string | null> {
  const uid = String(input.toUid || "").trim();
  if (!uid) return null;
  const notif = {
    toUid: uid,
    title: String(input.title || "").slice(0, 140),
    body: String(input.body || "").slice(0, 320),
    type: input.type || "info",
    ref: String(input.ref || "").slice(0, 80),
    go: String(input.go || "").slice(0, 40),
    read: false,
    createdAt: nowIso(),
    expiresAt: notifExpiry(),
  };
  const node = `${NODES.notifications}/${uid}`;
  try {
    if (key) {
      const k = sanitizeKey(key);
      await setRow(node, k, notif);
      return k;
    }
    return await addRow(node, notif);
  } catch (e) {
    console.warn("notify write:", (e as Error)?.message);
    return null;
  }
}

/** অনুমোদন-সংক্রান্ত notification (deterministic key → duplicate হয় না)। */
export function notifyApproval(
  uid: string,
  title: string,
  body: string,
  ref: string,
  go?: string
): Promise<string | null> {
  return notifyUser({ toUid: uid, title, body, type: "approval", ref, go }, "appr-" + sanitizeKey(ref || uid));
}

/** বাতিল/reject-সংক্রান্ত notification। */
export function notifyRejection(
  uid: string,
  title: string,
  body: string,
  ref: string,
  go?: string
): Promise<string | null> {
  return notifyUser({ toUid: uid, title, body, type: "rejected", ref, go }, "rej-" + sanitizeKey(ref || uid));
}

/**
 * কোনো ডোনার কি এই জরুরি আবেদনের জন্য matching? — শুধু একই blood group,
 * Availability ON, non-suspended, approved এবং ownerUid-সম্পন্ন ডোনার বিবেচিত।
 * (pure — টেস্টযোগ্য)
 */
export function donorMatchesRequest(
  d: Record<string, any>,
  group: string,
  opts: { exceptUid?: string } = {}
): boolean {
  const uid = String(d && d.ownerUid || "").trim();
  if (!uid) return false;
  if (opts.exceptUid && String(opts.exceptUid) === uid) return false;
  if (String(d.bloodGroup || d.group || "") !== String(group || "").trim()) return false;
  if (d.available === false || d.suspended) return false;
  if ((d.status || "approved") === "pending") return false;
  return true;
}

/**
 * জরুরি রক্তের আবেদন → matching donor-দের notification।
 * deterministic key (`em-<requestId>`) ব্যবহার করায় একই আবেদনের জন্য
 * বারবার notification তৈরি হয় না (overwrite হয়)।
 */
export async function notifyMatchingDonors(
  req: { id: string; group: string; hospital?: string; area?: string },
  opts: { exceptUid?: string } = {}
): Promise<number> {
  const group = String(req.group || "").trim();
  const reqId = String(req.id || "").trim();
  if (!group || !reqId) return 0;
  try {
    const donors = await listOnce(NODES.donors);
    let sent = 0;
    for (const d of donors) {
      if (!donorMatchesRequest(d, group, opts)) continue;
      const uid = String(d.ownerUid || "").trim();
      const where = [req.hospital, req.area].filter(Boolean).join(" · ");
      const body =
        `আপনার রক্তের গ্রুপ ${group} এবং একটি জরুরি ${group} রক্তের আবেদন পাওয়া গেছে।` +
        (where ? ` ${where}।` : "") +
        " বিস্তারিত দেখতে ক্লিক করুন।";
      const ok = await notifyUser(
        { toUid: uid, title: "জরুরি রক্তের প্রয়োজন", body, type: "emergency", ref: reqId, go: "req:for" },
        "em-" + sanitizeKey(reqId)
      );
      if (ok) sent++;
    }
    return sent;
  } catch (e) {
    console.warn("notify matching donors:", (e as Error)?.message);
    return 0;
  }
}

export default { notifyUser, notifyApproval, notifyRejection, notifyMatchingDonors, donorMatchesRequest, sanitizeKey, notifExpiry };
