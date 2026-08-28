/** Small client wrapper for privileged operations.
 *
 * Firebase Authentication intentionally does not allow a browser client to
 * delete somebody else's Auth account. Account deletion therefore goes through
 * the callable Cloud Function, which re-checks the caller's admin role before
 * deleting Auth and all RTDB records belonging to the UID.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { initFirebase } from "./firebase";

export type DonorApplicationInput = {
  name: string; gender: string; dob: string; area: string; phone: string;
  bloodGroup: string; lastDonation?: string; health?: string; whatsapp?: string;
  district?: string;
};

export type EmergencyRequestInput = {
  patientName: string; patientAge?: number | null; bloodGroup: string; bags: number;
  hospitalName: string; hospitalAddress: string; urgency: string; durationHours: number;
  requesterName: string; phone: string; whatsapp?: string; description?: string;
  instructions?: string;
};

export function submitEmergencyRequest(input: EmergencyRequestInput) {
  return call<EmergencyRequestInput, { ok: boolean; status: "pending" | "approved"; id: string }>(
    "submitEmergencyRequest", input
  );
}

async function call<TInput, TResult>(name: string, data: TInput): Promise<TResult> {
  const { app } = initFirebase();
  if (!app) throw new Error("Firebase সংযোগ নেই।");
  const fn = httpsCallable<TInput, TResult>(getFunctions(app), name);
  const result = await fn(data);
  return result.data;
}

export type AccountDeletionReport = {
  ok: boolean;
  uid: string;
  donorId?: string;
  /** `missing` = Auth-এ অ্যাকাউন্টটিই ছিল না (এটি কোনো ব্যর্থতা নয়)। */
  auth?: "deleted" | "missing";
  removed?: Record<string, number>;
  storageRemoved?: number;
};

/**
 * Firebase Authentication account + UID/Donor-ID সম্পর্কিত RTDB রেকর্ড মোছা
 * (Admin SDK প্রিভিলেজ — ব্রাউজার থেকে অন্যের Auth অ্যাকাউন্ট মোছা যায় না)।
 * Auth-এ অ্যাকাউন্ট আগেই মোছা থাকলে সেটি ব্যর্থতা নয় (`auth:"missing"`).
 */
export async function deleteAccountCompletely(uid: string, donorId = ""): Promise<AccountDeletionReport> {
  const targetUid = String(uid || "").trim();
  if (!targetUid) throw new Error("অ্যাকাউন্টের UID পাওয়া যায়নি।");
  const payload: { uid: string; donorId?: string } = { uid: targetUid };
  const targetDonorId = String(donorId || "").trim();
  if (targetDonorId) payload.donorId = targetDonorId;
  return call<{ uid: string; donorId?: string }, AccountDeletionReport>("deleteAccountCompletely", payload);
}

/** Used only when approval is OFF. The function validates the setting and
 * performs the approved user + public donor write with Admin SDK privileges. */
export function submitDonorApplication(input: DonorApplicationInput) {
  return call<DonorApplicationInput, { ok: boolean; status: "pending" | "approved"; donorId?: string }>(
    "submitDonorApplication", input
  );
}

/** Used only when Blood Group approval is OFF. */
export function changeBloodGroup(input: { to: string; reason: string; proof: string }) {
  return call<typeof input, { ok: boolean; status: "pending" | "approved" }>("changeBloodGroup", input);
}
