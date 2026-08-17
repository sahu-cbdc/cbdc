/**
 * CBDC — জন্ম তারিখ (Birthday) ভিত্তিক বয়স সিস্টেম
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  অ্যাপে আর কোথাও "বয়স (বছর)" আলাদা করে লেখা/সংরক্ষণ করা হয় না।
 *  ব্যবহারকারী শুধু **জন্ম তারিখ** দেন, আর বয়স সবসময় সেখান থেকে
 *  স্বয়ংক্রিয়ভাবে হিসাব হয় — ফলে বয়স কখনো পুরোনো হয়ে যায় না।
 *
 *  ডাটাবেসে (Realtime Database) সংরক্ষিত ফিল্ড: `dob` — "YYYY-MM-DD"।
 *  যেখানে বয়স দেখাতে হয়, সেখানে `ageFromDob(dob)` ব্যবহার করুন।
 *
 *  পুরোনো রেকর্ডে (যেগুলোতে শুধু `age` সংখ্যা ছিল) কিছু ভাঙে না —
 *  `resolveAge()` আগে dob দেখে, না পেলে পুরোনো `age` মান ব্যবহার করে।
 */

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** বাংলা সংখ্যা → ইংরেজি সংখ্যা (ইনপুট যেভাবেই আসুক)। */
export function toEnglishDigits(v: unknown): string {
  return String(v ?? "").replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

/** ইংরেজি সংখ্যা → বাংলা সংখ্যা (শুধু দেখানোর জন্য)। */
export function toBanglaDigits(v: unknown): string {
  return String(v ?? "").replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}

/** "YYYY-MM-DD" মানটি বৈধ তারিখ কিনা। */
export function isValidDob(dob: unknown): boolean {
  const s = toEnglishDigits(dob).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  // ভবিষ্যতের তারিখ বা অবাস্তব পুরোনো তারিখ গ্রহণ করা হয় না
  const now = new Date();
  if (d.getTime() > now.getTime()) return false;
  if (d.getFullYear() < now.getFullYear() - 120) return false;
  return true;
}

/**
 * জন্ম তারিখ থেকে পূর্ণ বছরে বয়স।
 * বৈধ না হলে `null` — কলার তখন "—" দেখাতে পারে।
 */
export function ageFromDob(dob: unknown): number | null {
  const s = toEnglishDigits(dob).trim();
  if (!isValidDob(s)) return null;
  const b = new Date(s + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * একটি রেকর্ড থেকে কার্যকর বয়স — আগে `dob`, না থাকলে পুরোনো `age` ফিল্ড।
 * (ডাটাবেসে থাকা পুরোনো রেকর্ডের সঙ্গে backward compatible)
 */
export function resolveAge(record: { dob?: unknown; age?: unknown } | null | undefined): number | null {
  if (!record) return null;
  const fromDob = ageFromDob(record.dob);
  if (fromDob !== null) return fromDob;
  const legacy = Number(toEnglishDigits(record.age));
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}

/** বয়স দেখানোর জন্য বাংলা লেখা — যেমন "২৪ বছর"; না জানা থাকলে "—"। */
export function ageText(source: { dob?: unknown; age?: unknown } | string | number | null | undefined): string {
  let age: number | null;
  if (source && typeof source === "object") age = resolveAge(source);
  else age = ageFromDob(source) ?? (Number(toEnglishDigits(source)) || null);
  return age === null ? "—" : toBanglaDigits(age) + " বছর";
}

/** জন্ম তারিখ বাংলা ফরম্যাটে — যেমন "১২ মার্চ ২০০১"। */
export function dobText(dob: unknown): string {
  const s = toEnglishDigits(dob).trim();
  if (!isValidDob(s)) return "—";
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

/**
 * `<input type="date">`-এ ব্যবহারের জন্য সর্বোচ্চ/সর্বনিম্ন জন্ম তারিখ।
 * (minAge/maxAge = রক্তদানের নিয়ম; SITE.rules থেকে আসে)
 */
export function dobBounds(minAge: number, maxAge: number): { min: string; max: string } {
  const now = new Date();
  const max = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  const min = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { min: fmt(min), max: fmt(max) };
}

/** জন্ম তারিখ অনুযায়ী বয়স নিয়মের ভেতরে আছে কিনা। */
export function isAgeEligible(dob: unknown, minAge: number, maxAge: number): boolean {
  const a = ageFromDob(dob);
  return a !== null && a >= minAge && a <= maxAge;
}

export default { ageFromDob, resolveAge, ageText, dobText, dobBounds, isValidDob, isAgeEligible };
