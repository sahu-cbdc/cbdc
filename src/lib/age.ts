

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";


export function toEnglishDigits(v: unknown): string {
  return String(v ?? "").replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}


export function toBanglaDigits(v: unknown): string {
  return String(v ?? "").replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}


export function isValidDob(dob: unknown): boolean {
  const s = toEnglishDigits(dob).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  
  const now = new Date();
  if (d.getTime() > now.getTime()) return false;
  if (d.getFullYear() < now.getFullYear() - 120) return false;
  return true;
}


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


export function resolveAge(record: { dob?: unknown; age?: unknown } | null | undefined): number | null {
  if (!record) return null;
  const fromDob = ageFromDob(record.dob);
  if (fromDob !== null) return fromDob;
  const legacy = Number(toEnglishDigits(record.age));
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}


export function ageText(source: { dob?: unknown; age?: unknown } | string | number | null | undefined): string {
  let age: number | null;
  if (source && typeof source === "object") age = resolveAge(source);
  else age = ageFromDob(source) ?? (Number(toEnglishDigits(source)) || null);
  return age === null ? "—" : toBanglaDigits(age) + " বছর";
}


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


export function dobBounds(minAge: number, maxAge: number): { min: string; max: string } {
  const now = new Date();
  const max = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  const min = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { min: fmt(min), max: fmt(max) };
}


export function isAgeEligible(dob: unknown, minAge: number, maxAge: number): boolean {
  const a = ageFromDob(dob);
  return a !== null && a >= minAge && a <= maxAge;
}

export default { ageFromDob, resolveAge, ageText, dobText, dobBounds, isValidDob, isAgeEligible };
