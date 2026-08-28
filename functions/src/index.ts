import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";

initializeApp();
const auth = getAuth();
const database: Database = getDatabase();

const STAFF_NODES = ["admins", "users", "donors", "members", "queue", "requests", "accounts", "reports"] as const;
const BLOOD_GROUPS = new Set(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]);

async function isAuthorisedAdmin(uid: string): Promise<boolean> {
  const snap = await database.ref(`admins/${uid}`).once("value");
  return snap.exists() && snap.child("role").val() === "admin" && snap.child("status").val() !== "disabled";
}

async function currentUser(uid: string) {
  return (await database.ref(`users/${uid}`).once("value")).val() as Record<string, any> | null;
}

function requireString(value: unknown, field: string, max = 160): string {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return result;
}

function validDob(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) return false;
  const age = new Date().getUTCFullYear() - date.getUTCFullYear() -
    (new Date().getTime() < new Date(Date.UTC(new Date().getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).getTime() ? 1 : 0);
  return age >= 18 && age <= 60;
}

async function nextDonorId(): Promise<string> {
  const year = String(new Date().getUTCFullYear());
  const result = await database.ref(`_meta/donorCounter/${year}`).transaction((value) => (Number(value) || 0) + 1);
  if (!result.committed) throw new HttpsError("aborted", "Could not allocate a donor ID.");
  return `CBDC-${year}-${String(Number(result.snapshot.val()) || 0).padStart(4, "0")}`;
}

/**
 * Delete a user from Firebase Auth and every known UID-owned RTDB collection.
 * Shared notices and the append-only audit log are intentionally retained.
 */
export const deleteAccountCompletely = onCall(async (request: CallableRequest<{ uid?: string }>) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  if (!(await isAuthorisedAdmin(request.auth.uid))) {
    throw new HttpsError("permission-denied", "Only an authorised admin may delete accounts.");
  }

  const targetUid = String(request.data?.uid || "").trim();
  if (!targetUid) throw new HttpsError("invalid-argument", "A target UID is required.");
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "An admin cannot delete their own account.");
  }

  const root = await database.ref().once("value");
  const updates: Record<string, null> = {
    [`users/${targetUid}`]: null,
    [`admins/${targetUid}`]: null,
    [`accounts/${targetUid}`]: null,
  };

  for (const node of STAFF_NODES) {
    const value = root.child(node).val();
    if (!value || typeof value !== "object") continue;
    for (const [id, row] of Object.entries(value as Record<string, any>)) {
      if (!row || typeof row !== "object") continue;
      const owner = String(row.ownerUid || row.uid || row.userId || "");
      if (owner === targetUid) updates[`${node}/${id}`] = null;
    }
  }

  try {
    await auth.deleteUser(targetUid);
    await database.ref().update(updates);
  } catch (error) {
    console.error("deleteAccountCompletely failed", targetUid, error);
    throw new HttpsError("internal", "The account and its related data could not be deleted completely.");
  }

  return { ok: true, uid: targetUid };
});

/**
 * A privileged, setting-aware donor application path. The client uses this
 * only when donorApproval is OFF. Existing pending requests are never touched.
 */
export const submitDonorApplication = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");
  const user = await currentUser(uid);
  if (!user) throw new HttpsError("failed-precondition", "Your profile does not exist.");

  const settings = (await database.ref("settings/app/rules").once("value")).val() as Record<string, any> | null;
  const approvalRequired = settings?.donorApproval !== false;
  const name = requireString(request.data?.name, "name", 80);
  const gender = requireString(request.data?.gender, "gender", 30);
  const dob = requireString(request.data?.dob, "dob", 10);
  const area = requireString(request.data?.area, "area", 100);
  const phone = requireString(request.data?.phone, "phone", 20);
  const bloodGroup = requireString(request.data?.bloodGroup, "bloodGroup", 4);
  if (!validDob(dob) || !BLOOD_GROUPS.has(bloodGroup)) {
    throw new HttpsError("invalid-argument", "The donor application contains invalid details.");
  }

  const existingStatus = String(user.donorStatus || "");
  if (existingStatus === "pending") throw new HttpsError("already-exists", "A donor application is already pending.");
  const at = new Date().toISOString();
  const district = String(request.data?.district || "").trim().slice(0, 60);
  const common: Record<string, any> = {
    name, gender, dob, area, phone, bloodGroup,
    lastDonation: String(request.data?.lastDonation || "").trim(),
    health: String(request.data?.health || "").trim(),
    whatsapp: String(request.data?.whatsapp || "").trim(),
    available: true, appliedAt: at, uid, ownerUid: uid,
    ...(district ? { district } : {}),
  };

  if (approvalRequired) {
    const qid = `PD-${uid.replace(/[^A-Za-z0-9]/g, "").slice(-40)}`;
    await database.ref().update({
      [`users/${uid}/name`]: name, [`users/${uid}/gender`]: gender, [`users/${uid}/dob`]: dob,
      [`users/${uid}/area`]: area, [`users/${uid}/phone`]: phone, [`users/${uid}/bloodGroup`]: bloodGroup,
      ...(district ? { [`users/${uid}/district`]: district } : {}),
      [`users/${uid}/donorStatus`]: "pending", [`users/${uid}/donorId`]: null,
      [`users/${uid}/lastDonation`]: common.lastDonation, [`users/${uid}/health`]: common.health,
      [`users/${uid}/whatsapp`]: common.whatsapp, [`users/${uid}/available`]: true, [`users/${uid}/appliedAt`]: at,
      [`queue/${qid}`]: { ...common, kind: "donor", id: qid, group: bloodGroup, at, atTs: Date.now() },
    });
    return { ok: true, status: "pending" as const };
  }

  const donorId = await nextDonorId();
  await database.ref().update({
    [`users/${uid}/name`]: name, [`users/${uid}/gender`]: gender, [`users/${uid}/dob`]: dob,
    [`users/${uid}/area`]: area, [`users/${uid}/phone`]: phone, [`users/${uid}/bloodGroup`]: bloodGroup,
      ...(district ? { [`users/${uid}/district`]: district } : {}),
    [`users/${uid}/donorStatus`]: "approved", [`users/${uid}/donorId`]: donorId,
    [`users/${uid}/lastDonation`]: common.lastDonation, [`users/${uid}/health`]: common.health,
    [`users/${uid}/whatsapp`]: common.whatsapp, [`users/${uid}/available`]: true, [`users/${uid}/appliedAt`]: at,
    [`donors/${donorId}`]: {
      ...common, id: donorId, donorId, status: "approved", verified: true, suspended: false,
      joined: at, donations: 0, totalDonations: 0,
    },
  });
  return { ok: true, status: "approved" as const, donorId };
});

/**
 * Submit an emergency request with the approval decision made on the server.
 * The public form may be used before login; an authenticated submit is linked
 * to that UID and only that owner can later edit/cancel it under the rules.
 */
export const submitEmergencyRequest = onCall(async (request: CallableRequest<Record<string, unknown>>) => {
  const data = request.data || {};
  const settings = (await database.ref("settings/app").once("value")).val() as Record<string, any> | null;
  const rules = settings?.rules && typeof settings.rules === "object" ? settings.rules : {};
  const approvalRequired = rules.emergencyApproval !== false && settings?.autoApproveEmergency !== true;
  const text = (key: string, max: number, required = true) => {
    const value = String(data[key] ?? "").trim();
    if (required && !value) throw new HttpsError("invalid-argument", `${key} is required.`);
    if (value.length > max) throw new HttpsError("invalid-argument", `${key} is too long.`);
    return value;
  };
  const bloodGroup = text("bloodGroup", 4);
  if (!BLOOD_GROUPS.has(bloodGroup)) throw new HttpsError("invalid-argument", "Invalid blood group.");
  const bags = Number(data.bags);
  const durationHours = Number(data.durationHours);
  if (!Number.isInteger(bags) || bags < 1 || bags > 99 || !Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 168) {
    throw new HttpsError("invalid-argument", "Invalid request duration or bag count.");
  }
  const phone = text("phone", 20);
  const uid = String(request.auth?.uid || "");
  const id = database.ref("requests").push().key;
  if (!id) throw new HttpsError("internal", "Could not allocate a request ID.");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
  const status = approvalRequired ? "pending" : "approved";
  const record = {
    id, patientName: text("patientName", 120), patientAge: data.patientAge == null ? null : Number(data.patientAge),
    bloodGroup, bags, hospitalName: text("hospitalName", 160), hospitalAddress: text("hospitalAddress", 240),
    urgency: text("urgency", 80), durationHours, requesterName: text("requesterName", 120), phone,
    whatsapp: text("whatsapp", 20, false), description: text("description", 1000, false),
    instructions: text("instructions", 1000, false), status, workflowStatus: approvalRequired ? "pending" : "searching",
    createdAt, expiresAt, ownerUid: uid,
  };
  const updates: Record<string, any> = { [`requests/${id}`]: record };
  if (approvalRequired) updates[`queue/${id}`] = {
    kind: "request", requestId: id, id, patient: record.patientName, group: bloodGroup, bags,
    urgency: record.urgency, hospital: record.hospitalName, area: record.hospitalAddress,
    requester: record.requesterName, phone, whatsapp: record.whatsapp, at: createdAt, expiresAt, ownerUid: uid,
  };
  await database.ref().update(updates);
  if (uid) {
    await database.ref(`users/${uid}/applicationCount`).transaction(value => (Number(value) || 0) + 1);
  }
  return { ok: true, status: status as "pending" | "approved", id };
});

/** A setting-aware blood-group change path for donors when approval is OFF. */
export const changeBloodGroup = onCall(async (request: CallableRequest<{ to?: string; reason?: string; proof?: string }>) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");
  const user = await currentUser(uid);
  if (!user || String(user.donorStatus || "") !== "approved" || !user.donorId) {
    throw new HttpsError("failed-precondition", "Only an approved donor can change this value.");
  }
  const rules = (await database.ref("settings/app/rules").once("value")).val() as Record<string, any> | null;
  if (rules?.bloodGroupApproval !== false) throw new HttpsError("failed-precondition", "Blood-group approval is enabled.");
  const to = requireString(request.data?.to, "blood group", 4);
  const reason = requireString(request.data?.reason, "reason", 500);
  const proof = requireString(request.data?.proof, "proof", 2000);
  if (!BLOOD_GROUPS.has(to) || to === String(user.bloodGroup || "")) {
    throw new HttpsError("invalid-argument", "The target blood group is invalid.");
  }
  const at = new Date().toISOString();
  await database.ref().update({
    [`users/${uid}/bloodGroup`]: to,
    [`users/${uid}/groupChange`]: { from: user.bloodGroup || "", to, reason, proof, status: "approved", at, decidedAt: at },
    [`donors/${user.donorId}/bloodGroup`]: to,
  });
  return { ok: true, status: "approved" as const };
});
