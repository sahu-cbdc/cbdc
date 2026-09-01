
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toEnglishDigits(value: unknown): string {
  return String(value ?? "").replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePhone(value: unknown): string {
  return toEnglishDigits(value).replace(/\s+/g, "");
}

export function isElevenDigitPhone(value: unknown): boolean {
  return /^01[3-9]\d{8}$/.test(normalizePhone(value));
}

/** True when a duplicate-check row belongs to the user currently signing up. */
export function duplicateRowIsSelf(
  row: Record<string, unknown> | null | undefined,
  self: { uid?: unknown; email?: unknown },
): boolean {
  if (!row) return false;
  const selfUid = String(self.uid ?? "").trim();
  const selfEmail = normalizeEmail(self.email);
  const rowUid = String(row.uid ?? "").trim();
  const rowId = String(row.id ?? "").trim();
  const rowEmail = normalizeEmail(row.email);
  if (selfUid && (rowUid === selfUid || rowId === selfUid)) return true;
  if (selfEmail && (rowUid === selfEmail || rowId === selfEmail || rowEmail === selfEmail)) return true;
  return false;
}

export type EmailClaimStatus =
  | { status: "claimed" }
  | { status: "conflict"; ownerUid: string }
  | { status: "unavailable" };

export interface AuthFlowIo {
  claimEmail(email: string, uid: string): Promise<EmailClaimStatus>;
  getProfile(uid: string): Promise<Record<string, any> | null>;
  createProfile(uid: string, data: Record<string, any>): Promise<void>;
  updateProfile(uid: string, data: Record<string, any>, existing: Record<string, any>): Promise<void>;
  claimLogin(email: string, username: string, phone: string): Promise<void>;
  lookupLoginKey(kind: "username", value: unknown): Promise<string | null>;
}

export const EMAIL_CONFLICT_MESSAGE =
  "এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে — একই ইমেইলে দ্বিতীয় অ্যাকাউন্ট তৈরি করা যায় না। লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।";

export const EMAIL_CLAIM_UNAVAILABLE_MESSAGE =
  "অ্যাকাউন্ট তৈরির সময় ইমেইল যাচাই করা যায়নি (ডাটাবেস সংযোগ বা অনুমতি সমস্যা)। কোনো ডুপ্লিকেট তৈরি এড়াতে প্রক্রিয়াটি সম্পন্ন হয়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।";

export const PROFILE_WRITE_FAILED_MESSAGE =
  "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু প্রোফাইল সংরক্ষণ করা যায়নি (ডাটাবেস অনুমতি বা সংযোগ সমস্যা)। আবার লগইন করলে প্রোফাইল স্বয়ংক্রিয়ভাবে তৈরি হয়ে যাবে — সমস্যা থাকলে অ্যাডমিনের সাথে যোগাযোগ করুন।";

export type SignupOutcome =
  | { ok: true; existing: boolean; indexed: boolean }
  | { ok: false; reason: "email-conflict" | "email-claim-unavailable" | "profile-write-failed"; message: string };

export interface FinalizeSignupInput {
  uid: string;
  email: string;
  username: string;
  phone: string;
  role: string;
  provider: string;
  newData: Record<string, any>;
  existingData: Record<string, any>;
  resolveConflict?: () => Promise<boolean>;
}

export async function finalizeEmailSignup(
  io: AuthFlowIo,
  input: FinalizeSignupInput,
): Promise<SignupOutcome> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const phone = normalizePhone(input.phone);

  let claim = await io.claimEmail(email, input.uid);
  if (claim.status === "conflict" && input.resolveConflict) {
    const resolved = await input.resolveConflict();
    if (resolved) claim = await io.claimEmail(email, input.uid);
  }
  if (claim.status === "conflict") {
    return { ok: false, reason: "email-conflict", message: EMAIL_CONFLICT_MESSAGE };
  }
  if (claim.status === "unavailable") {
    return { ok: false, reason: "email-claim-unavailable", message: EMAIL_CLAIM_UNAVAILABLE_MESSAGE };
  }

  const existing = await io.getProfile(input.uid);
  try {
    if (existing) {
      await io.updateProfile(
        input.uid,
        { ...input.existingData, email, username, phone, provider: input.provider },
        existing,
      );
    } else {
      await io.createProfile(input.uid, {
        ...input.newData,
        email,
        username,
        phone,
        provider: input.provider,
        role: input.role,
        createdAt: new Date().toISOString(),
      });
    }
  } catch {
    return { ok: false, reason: "profile-write-failed", message: PROFILE_WRITE_FAILED_MESSAGE };
  }

  let indexed = false;
  try {
    await io.claimLogin(email, username, phone);
    indexed = true;
  } catch {
    indexed = false;
  }
  return { ok: true, existing: !!existing, indexed };
}

export async function backfillLoginIndex(
  io: AuthFlowIo,
  email: unknown,
  username: unknown,
  phone: unknown,
): Promise<boolean> {
  const mail = normalizeEmail(email);
  if (!mail) return false;
  try {
    await io.claimLogin(mail, normalizeUsername(username), normalizePhone(phone));
    return true;
  } catch {
    return false;
  }
}

export async function resolveEmailForLogin(
  io: AuthFlowIo,
  identifier: unknown,
): Promise<string | null> {
  const q = String(identifier ?? "").trim().toLowerCase();
  if (!q) return null;
  if (q.includes("@")) return normalizeEmail(q);
  const byUsername = await io.lookupLoginKey("username", q);
  if (byUsername && String(byUsername).includes("@")) return normalizeEmail(byUsername);
  return null;
}
