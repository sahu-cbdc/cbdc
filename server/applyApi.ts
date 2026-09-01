

import { ApiError } from "./deleteApi.ts";
import {
  makeApprovedDonationRecord,
  writeApprovedDonation,
  type ApprovedDonation,
} from "../src/lib/donationLog.ts";


export type ApplyIo = {
  
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  
  getRow(node: string, id: string): Promise<any | null>;
  
  listOnce(node: string): Promise<any[]>;
  
  updatePaths(paths: Record<string, any>): Promise<void>;
};

export type ApplyAction = "donor" | "bloodGroup" | "donation";

export type ApplyResult = {
  ok: boolean;
  action: ApplyAction;
  
  approvalRequired: boolean;
  donorId?: string;
  
  pathsWritten?: number;
  error?: string;
};

const SETTINGS_NODE = "settings";
const SETTINGS_ID = "app";


function ruleOn(settings: any, key: string): boolean {
  const rules = settings && settings.rules && typeof settings.rules === "object" ? settings.rules : {};
  return rules[key] !== false;
}


async function findDonorByOwner(io: ApplyIo, owner: string): Promise<any | null> {
  if (!owner) return null;
  const donors = (await io.listOnce("donors").catch(() => [])) || [];
  return donors.find((d) => String(d?.ownerUid || d?.uid || "") === owner) || null;
}


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

  
  const lockKey = uid + "|" + action;
  if (inflightApply.has(lockKey)) {
    throw new ApiError(429, "এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াধীন — একটু পরে আবার চেষ্টা করুন।");
  }
  inflightApply.add(lockKey);
  try {
    return await processApply(uid, action, input, io);
  } finally {
    inflightApply.delete(lockKey);
  }
}


const inflightApply = new Set<string>();

async function processApply(
  uid: string,
  action: ApplyAction,
  input: Record<string, unknown> | null | undefined,
  io: ApplyIo,
): Promise<ApplyResult> {
  const settings = (await io.getRow(SETTINGS_NODE, SETTINGS_ID).catch(() => null)) || {};

  
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


export default handleDonorApply;
