/**
 * CBDC — Approval-Settings-exempt direct processing (server-side, gated by settings)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Admin Panel-এর «অনুমোদন ও সেটিংস»-এর প্রতিটি সুইচ (donorApproval /
 *  donationApproval / emergencyApproval / bloodGroupApproval) বলে দেয় কোন কাজে
 *  approval লাগবে আর কোনটি **সরাসরি** সম্পন্ন হবে।
 *
 *  `donors`, `requests`, `users/{uid}/bloodGroup`, `_meta/donorCounter`,
 *  `users/{uid}/data/verifiedDonations`-এ লেখার অনুমতি Security Rules-এ শুধু
 *  staff-এর। তাই OFF (সরাসরি) path সাধারণ (non-staff) ব্যবহারকারীর ব্রাউজার থেকে
 *  সম্ভব নয় — সেজন্য এই endpoint:
 *
 *    POST <base>api/donor/apply   { action:"donor"|"bloodGroup"|"donation", ... }
 *
 *  • caller-এর Firebase ID token যাচাই (Identity Toolkit),
 *  • `settings/app.rules` থেকে ওই action-এর সেটিং পড়ে — **ON থাকলে 409**
 *    (approval queue-তেই যেতে হবে), **OFF থাকলেই** সরাসরি process,
 *  • সব লেখা **privileged** (service-account access token) RTDB IO দিয়ে —
 *    তাই ব্রাউজার rules-এর কাছে পৌঁছায়ই না; এক atomic multi-path update-এ।
 *
 *  মডিউলটি pure (I/O injected) — `ApplyIo` inject করে যেকোনো পরিবেশে (Worker,
 *  dev middleware, verification harness) একই logic চালানো যায়। ডোনেশন-যাচাইয়ের
 *  লেখা `src/lib/donationLog.ts`-এর চেক করা pure logic-ই ব্যবহার করে।
 */

import { ApiError } from "./deleteApi.ts";
import {
  makeApprovedDonationRecord,
  writeApprovedDonation,
  type ApprovedDonation,
} from "../src/lib/donationLog.ts";

/** I/O seam — Worker/dev-middleware/পরীক্ষা সবাই নিজের fetch দিয়ে inject করে। */
export type ApplyIo = {
  /** Firebase ID token যাচাই → { uid, email }; invalid হলে null। */
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  /** `node/{id}`-এর মান (রেকর্ড না থাকলে null)। */
  getRow(node: string, id: string): Promise<any | null>;
  /** পুরো node-এর রেকর্ড `{ id: row }` আকারে (node না থাকলে [])। */
  listOnce(node: string): Promise<any[]>;
  /** multi-path apply (atomic) — null মান মানে path মুছে ফেলা। */
  updatePaths(paths: Record<string, any>): Promise<void>;
};

export type ApplyAction = "donor" | "bloodGroup" | "donation";

export type ApplyResult = {
  ok: boolean;
  action: ApplyAction;
  /** ON থাকলে request approval queue-তে যাবে — সরাসরি process হয়নি। */
  approvalRequired: boolean;
  donorId?: string;
  /** সরাসরি process হলে কতগুলো path লেখা হলো। */
  pathsWritten?: number;
  error?: string;
};

const SETTINGS_NODE = "settings";
const SETTINGS_ID = "app";

/** rules flag পড়া: false → OFF (সরাসরি), বাকি সব → ON (approval প্রয়োজন)। */
function ruleOn(settings: any, key: string): boolean {
  const rules = settings && settings.rules && typeof settings.rules === "object" ? settings.rules : {};
  return rules[key] !== false;
}

/** একই অ্যাকাউন্টের ডোনার রেকর্ড খোঁজা (duplicate ডোনার রোধ — item 9, 11)। */
async function findDonorByOwner(io: ApplyIo, owner: string): Promise<any | null> {
  if (!owner) return null;
  const donors = (await io.listOnce("donors").catch(() => [])) || [];
  return donors.find((d) => String(d?.ownerUid || d?.uid || "") === owner) || null;
}

/** সার্ভার-সাইড ডোনার আইডি — ব্যবহৃত serial-এর পর সবচেয়ে ছোট free serial। */
async function nextDonorIdServer(io: ApplyIo): Promise<string> {
  const year = new Date().getFullYear();
  const donors = (await io.listOnce("donors").catch(() => [])) || [];
  const used = new Set<number>();
  for (const d of donors) {
    const m = String(d?.id || d?.donorId || "").match(/CBDC-\d+-(\d+)/);
    if (m) used.add(Number(m[1]));
  }
  let seq = 1;
  while (used.has(seq)) seq++;
  return "CBDC-" + year + "-" + String(seq).padStart(4, "0");
}

export async function handleDonorApply(
  input: Record<string, unknown> | null | undefined,
  io: ApplyIo,
): Promise<ApplyResult> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  const uid = String(caller.uid);

  const action = String(input?.action ?? "").trim() as ApplyAction;
  if (action !== "donor" && action !== "bloodGroup" && action !== "donation") {
    throw new ApiError(400, "অজানা action — শুধু donor, bloodGroup বা donation।");
  }

  const settings = (await io.getRow(SETTINGS_NODE, SETTINGS_ID).catch(() => null)) || {};

  /* ── donor application ── */
  if (action === "donor") {
    if (ruleOn(settings, "donorApproval")) {
      return { ok: false, action, approvalRequired: true };
    }
    const user = (await io.getRow("users", uid).catch(() => null)) || {};
    const existing = await findDonorByOwner(io, uid);
    const donorId = (existing && String(existing.id || existing.donorId || "").trim()) ||
      (await nextDonorIdServer(io));
    const at = new Date().toISOString();
    const name = String(user.name || "").trim();
    const bloodGroup = String(user.bloodGroup || user.bloodGroupName || "").trim();
    const paths: Record<string, any> = {
      [`users/${uid}/donorStatus`]: "approved",
      [`users/${uid}/donorId`]: donorId,
      [`users/${uid}/donorRejectNote`]: null,
      [`donors/${donorId}`]: {
        id: donorId, donorId, uid, ownerUid: uid,
        name, bloodGroup, group: bloodGroup,
        area: String(user.area || ""), district: String(user.district || ""),
        phone: String(user.phone || ""), whatsapp: String(user.whatsapp || user.phone || ""),
        gender: String(user.gender || ""), dob: String(user.dob || ""),
        lastDonationDate: String(user.lastDonation || ""),
        donations: existing ? Number(existing.donations) || 0 : 0,
        totalDonations: existing ? Number(existing.totalDonations) || 0 : 0,
        totalBags: existing ? Number(existing.totalBags) || 0 : 0,
        status: "approved", available: true, verified: true, suspended: false,
        joined: (existing && existing.joined) || at,
        createdAt: (existing && existing.createdAt) || at, updatedAt: at,
      },
    };
    if (bloodGroup) paths[`users/${uid}/bloodGroup`] = bloodGroup;
    await io.updatePaths(paths);
    return { ok: true, action, approvalRequired: false, donorId, pathsWritten: Object.keys(paths).length };
  }

  /* ── blood group change ── */
  if (action === "bloodGroup") {
    if (ruleOn(settings, "bloodGroupApproval")) {
      return { ok: false, action, approvalRequired: true };
    }
    const to = String(input?.to ?? "").trim();
    const reason = String(input?.reason ?? "").trim();
    const proof = String(input?.proof ?? "").trim();
    const validGroups = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
    if (!validGroups.includes(to)) throw new ApiError(400, "সঠিক রক্তের গ্রুপ দিন।");
    const user = (await io.getRow("users", uid).catch(() => null)) || {};
    const from = String(user.bloodGroup || "").trim();
    const at = new Date().toISOString();
    const donor = await findDonorByOwner(io, uid);
    const paths: Record<string, any> = {
      [`users/${uid}/bloodGroup`]: to,
      [`users/${uid}/groupChange`]: {
        from, to, reason: reason.slice(0, 300), proof, status: "approved", at, decidedAt: at,
      },
    };
    if (donor && String(donor.id || "")) {
      paths[`donors/${donor.id}/bloodGroup`] = to;
      paths[`donors/${donor.id}/group`] = to;
    }
    await io.updatePaths(paths);
    return { ok: true, action, approvalRequired: false, donorId: donor ? String(donor.id) : "", pathsWritten: Object.keys(paths).length };
  }

  /* ── blood donation verification ── */
  const date = String(input?.date ?? "").trim();
  const place = String(input?.place ?? "").trim();
  const bags = Math.max(1, Math.floor(Number(input?.bags) || 1));
  const proof = String(input?.proof ?? "").trim();
  const patient = String(input?.patient ?? "").trim();
  const note = String(input?.note ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, "সঠিক রক্তদানের তারিখ দিন।");
  if (!place) throw new ApiError(400, "স্থান / হাসপাতাল লিখুন।");
  if (ruleOn(settings, "donationApproval")) {
    return { ok: false, action, approvalRequired: true };
  }
  const donor = await findDonorByOwner(io, uid);
  if (!donor) throw new ApiError(409, "অনুমোদিত ডোনার রেকর্ড পাওয়া যায়নি — আগে ডোনার হিসেবে নিবন্ধন করুন।");
  const q = {
    kind: "donation", ownerUid: uid, uid,
    name: String(donor.name || ""), place, date, bags, proof, patient, note,
    at: new Date().toISOString(),
  };
  const record: ApprovedDonation = await makeApprovedDonationRecord(q, donor, "সিস্টেম", io);
  const { paths, stats } = await writeApprovedDonation(record, null, io);
  await io.updatePaths(paths);
  return {
    ok: true, action, approvalRequired: false,
    donorId: String(donor.id || ""), pathsWritten: Object.keys(paths).length,
  };
}

/** default export — existing call-site convention */
export default handleDonorApply;
