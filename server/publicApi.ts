/**
 * Public website submissions — the only API that works without a login.
 *
 *   POST /api/data {op:"public-submit", kind:...} — public registration/emergency
 *
 * Mirrors exactly what the public Home forms used to write directly, minus
 * everything the browser used to decide on its own:
 *   • field validation re-runs server-side,
 *   • ownerUid/uid come from the verified ID token when present (never the
 *     body — IDOR-proof),
 *   • duplicate registration detection reads members/donors privileged,
 *   • emergency auto-approve is decided from the live settings node.
 *
 * Flood protection (not a user quota) applies at the router level.
 */
import { ApiError } from "./deleteApi.ts";

export type PublicIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  get(path: string): Promise<any>;
  list(node: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

export type PublicCaller = { uid: string; email: string } | null;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const PHONE_RE = /^01[3-9]\d{8}$/;

const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
let lastPushTime = 0;
const lastRandChars: number[] = [];

function pushId(): string {
  let now = Date.now();
  const dupTime = now === lastPushTime;
  lastPushTime = now;
  const timeStampChars: string[] = new Array(8);
  let remaining = now;
  for (let i = 7; i >= 0; i--) {
    timeStampChars[i] = PUSH_CHARS.charAt(remaining % 64);
    remaining = Math.floor(remaining / 64);
  }
  let id = timeStampChars.join("");
  if (!dupTime) {
    for (let i = 0; i < 12; i++) lastRandChars[i] = Math.floor(Math.random() * 64);
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) lastRandChars[i] = 0;
    lastRandChars[i]++;
  }
  for (let i = 0; i < 12; i++) id += PUSH_CHARS.charAt(lastRandChars[i]);
  return id;
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\s+/g, "");
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function validDob(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

async function resolveCaller(io: PublicIo, idToken: string): Promise<PublicCaller> {
  const token = String(idToken || "").trim();
  if (!token) return null;
  const verified = await io.verifyToken(token).catch(() => null);
  if (!verified || !verified.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }
  return { uid: String(verified.uid), email: String(verified.email || "").trim().toLowerCase() };
}

function sameAccountRow(row: any, uid: string, email: string, phone: string): boolean {
  if (!row || typeof row !== "object") return false;
  const ownerKeys = ["ownerUid", "uid", "userId"];
  for (const k of ownerKeys) {
    if (String(row[k] ?? "").trim() === uid) return true;
  }
  const rowEmail = String(row.email ?? "").trim().toLowerCase();
  const rowPhone = String(row.phone ?? "").replace(/\s+/g, "");
  if (email && rowEmail === email) return true;
  if (phone && rowPhone === phone) return true;
  return false;
}

export async function handlePublicSubmit(
  input: Record<string, unknown> | null | undefined,
  io: PublicIo,
  idToken: string
): Promise<{ ok: true; kind: string; duplicate?: boolean; id?: string; status?: string }> {
  const kind = String(input?.kind ?? "").trim();
  const payload = (input && typeof (input as any).payload === "object" ? (input as any).payload : {}) as Record<string, unknown>;
  if (kind === "donor-registration") return submitDonorRegistration(payload, io, idToken);
  if (kind === "emergency-request") return submitEmergencyRequest(payload, io, idToken);
  throw new ApiError(400, "অজানা অনুরোধ — kind সঠিক নয়।");
}

async function submitDonorRegistration(
  payload: Record<string, unknown>,
  io: PublicIo,
  idToken: string
): Promise<{ ok: true; kind: string; duplicate: boolean; id?: string }> {
  const caller = await resolveCaller(io, idToken);
  const name = cleanText(payload.name, 120);
  const bloodGroup = cleanText(payload.bloodGroup, 5);
  const gender = cleanText(payload.gender, 20);
  const dob = cleanText(payload.dob, 12);
  const area = cleanText(payload.area, 120);
  const district = cleanText(payload.district, 120);
  const phone = digits(payload.phone);
  const whatsapp = digits(payload.whatsapp);
  const health = cleanText(payload.healthNotes ?? payload.health, 400);
  const last = cleanText(payload.lastDonationDate ?? payload.last, 12);
  const address = cleanText(payload.address, 300);

  if (name.length < 2) throw new ApiError(400, "নাম সঠিকভাবে লিখুন।");
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw new ApiError(400, "রক্তের গ্রুপ নির্বাচন করুন।");
  if (!gender) throw new ApiError(400, "লিঙ্গ নির্বাচন করুন।");
  if (!validDob(dob)) throw new ApiError(400, "জন্ম তারিখ সঠিকভাবে দিন।");
  if (!area) throw new ApiError(400, "থানা / এলাকা দিন।");
  if (!PHONE_RE.test(phone)) throw new ApiError(400, "১১ সংখ্যার সঠিক মোবাইল নম্বর দিন।");
  if (whatsapp && !PHONE_RE.test(whatsapp)) throw new ApiError(400, "১১ সংখ্যার সঠিক WhatsApp নম্বর দিন।");

  const uid = caller ? caller.uid : "";
  const email = caller ? caller.email : "";
  if (uid) {
    const [donors, members] = await Promise.all([
      io.list("donors").catch(() => null),
      io.list("members").catch(() => null),
    ]);
    const rows = [
      ...Object.values((donors as Record<string, any>) || {}),
      ...Object.values((members as Record<string, any>) || {}),
    ];
    if (rows.some((row) => sameAccountRow(row, uid, email, phone))) {
      return { ok: true, kind: "donor-registration", duplicate: true };
    }
  }

  const memberId = pushId();
  const createdAt = new Date().toISOString();
  const member: Record<string, unknown> = {
    id: memberId,
    name,
    bloodGroup,
    gender,
    dob,
    area,
    district: district || area,
    phone,
    ...(whatsapp ? { whatsapp } : {}),
    ...(health ? { healthNotes: health } : {}),
    ...(last ? { lastDonationDate: last } : {}),
    ...(address ? { address } : {}),
    ...(uid ? { uid, ownerUid: uid } : {}),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };
  const paths: Record<string, any> = {
    [`members/${memberId}`]: member,
    [`queue/${memberId}`]: {
      kind: "donor",
      memberId,
      id: memberId,
      uid,
      ownerUid: uid,
      name,
      group: bloodGroup,
      area,
      dob,
      gender,
      health,
      last,
      phone,
      whatsapp: whatsapp || "",
      address,
      at: createdAt,
      updatedAt: createdAt,
    },
  };
  if (uid) paths[`users/${uid}/donorMemberId`] = memberId;
  await io.patch(paths);
  return { ok: true, kind: "donor-registration", duplicate: false, id: memberId };
}

async function submitEmergencyRequest(
  payload: Record<string, unknown>,
  io: PublicIo,
  idToken: string
): Promise<{ ok: true; kind: string; id: string; status: string }> {
  const caller = await resolveCaller(io, idToken);
  const uid = caller ? caller.uid : "";
  if (!uid) {
    throw new ApiError(401, "জরুরি আবেদন জমা দিতে লগইন করুন।");
  }
  const patientName = cleanText(payload.patientName, 120);
  const bloodGroup = cleanText(payload.bloodGroup, 5);
  const bags = Math.max(1, Math.min(99, Math.floor(Number(digits(payload.bags)) || 0)));
  const urgency = cleanText(payload.urgency, 60);
  const hospitalName = cleanText(payload.hospitalName, 160);
  const hospitalAddress = cleanText(payload.hospitalAddress, 240);
  const requesterName = cleanText(payload.requesterName, 120);
  const phone = digits(payload.phone);
  const whatsapp = digits(payload.whatsapp);
  const description = cleanText(payload.description, 1200);
  const instructions = cleanText(payload.instructions, 600);
  const patientAgeRaw = Number(digits(payload.patientAge));
  const patientAge = Number.isFinite(patientAgeRaw) && patientAgeRaw >= 1 && patientAgeRaw <= 120 ? patientAgeRaw : null;

  if (!patientName) throw new ApiError(400, "রোগীর নাম লিখুন।");
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw new ApiError(400, "রক্তের গ্রুপ নির্বাচন করুন।");
  if (!(bags >= 1)) throw new ApiError(400, "ব্যাগ সংখ্যা দিন।");
  if (!urgency) throw new ApiError(400, "জরুরিতার সময়সীমা নির্বাচন করুন।");
  if (!hospitalName) throw new ApiError(400, "হাসপাতালের নাম লিখুন।");
  if (!hospitalAddress) throw new ApiError(400, "হাসপাতালের ঠিকানা লিখুন।");
  if (!requesterName) throw new ApiError(400, "আপনার নাম লিখুন।");
  if (!PHONE_RE.test(phone)) throw new ApiError(400, "১১ সংখ্যার সঠিক মোবাইল নম্বর দিন।");

  let hours = Number(payload.durationHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    const map: Array<[string, number]> = [
      ["১ ঘণ্টা", 1],
      ["২ ঘণ্টা", 2],
      ["৬ ঘণ্টা", 6],
      ["১২ ঘণ্টা", 12],
      ["৪৮ ঘণ্টা", 48],
      ["২ দিন", 48],
      ["৭২ ঘণ্টা", 72],
      ["৩ দিন", 72],
    ];
    hours = 24;
    for (const [needle, value] of map) {
      if (urgency.includes(needle)) {
        hours = value;
        break;
      }
    }
  }
  hours = Math.min(720, Math.max(1, hours));
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  const settings = (await io.get("settings/app").catch(() => null)) as any;
  const rules = settings && settings.rules && typeof settings.rules === "object" ? settings.rules : {};
  const autoApproved = rules.emergencyApproval === false || settings?.autoApproveEmergency === true;
  const status = autoApproved ? "approved" : "pending";
  const createdAt = new Date().toISOString();
  const reqId = pushId();

  const paths: Record<string, any> = {
    [`requests/${reqId}`]: {
      id: reqId,
      patientName,
      patientAge,
      bloodGroup,
      bags,
      urgency,
      hospitalName,
      hospitalAddress,
      requesterName,
      phone,
      whatsapp: whatsapp || "",
      description,
      instructions,
      status,
      createdAt,
      expiresAt,
      ownerUid: uid,
      updatedAt: createdAt,
    },
  };
  if (!autoApproved) {
    paths[`queue/${reqId}`] = {
      kind: "request",
      requestId: reqId,
      id: reqId,
      patient: patientName,
      group: bloodGroup,
      bags,
      urgency,
      hospital: hospitalName,
      area: hospitalAddress,
      phone,
      requester: requesterName,
      whatsapp: whatsapp || "",
      description,
      instructions,
      at: createdAt,
      expiresAt,
      ownerUid: uid,
      updatedAt: createdAt,
    };
  }

  const currentCount = (await io.get(`users/${uid}/applicationCount`).catch(() => null)) as any;
  const base = Number(currentCount);
  const next = (Number.isFinite(base) ? base : 0) + 1;
  paths[`users/${uid}/applicationCount`] = next;

  await io.patch(paths);
  return { ok: true, kind: "emergency-request", id: reqId, status };
}

export default handlePublicSubmit;
