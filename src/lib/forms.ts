/**
 * CBDC — ফর্ম ভ্যালিডেশন ও ইনলাইন এরর সিস্টেম
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  পুরো সাইটে ফর্মের আচরণ এখন এক রকম:
 *
 *    • Input box-এ কোনো example/placeholder লেখা থাকে না — শুধু label থাকে।
 *    • আবশ্যিক ঘর ফাঁকা রেখে submit করলে **কোনো popup / alert আসে না**।
 *    • ফাঁকা বা ভুল ঘরটি লাল করে **highlight** হয় এবং প্রথম ঘরে ফোকাস যায়।
 *    • এরর বার্তা ঐ ঘরের **নিচে** ছোট করে দেখা যায়।
 *    • ব্যবহারকারী পূরণ করা শুরু করলেই highlight ও বার্তা মুছে যায়।
 *
 *  ব্যবহার:
 *      import { validateForm, clearFieldError, setFieldError, attachLiveClear } from "../lib/forms";
 *
 *      const result = validateForm(formEl, {
 *        name:  { required: true, label: "নাম" },
 *        email: { required: true, email: true, label: "ইমেইল" },
 *        dob:   { required: true, dob: {min:18, max:60}, label: "জন্ম তারিখ" },
 *      });
 *      if (!result.ok) return;   // UI-তে সব highlight/বার্তা ইতিমধ্যে বসে গেছে
 *
 *  স্টাইল: `.is-invalid` (ইনপুট) এবং `.field-error` (বার্তা) — CSS প্রতিটি পেজের
 *  নিজস্ব stylesheet-এ যুক্ত করা আছে যাতে বিদ্যমান ডিজাইন অপরিবর্তিত থাকে।
 */

import { ageFromDob, isValidDob, toEnglishDigits, toBanglaDigits } from "./age";

export interface FieldRule {
  /** ফাঁকা রাখা যাবে না। */
  required?: boolean;
  /** বৈধ ইমেইল কিনা। */
  email?: boolean;
  /** ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর কিনা। */
  phone?: boolean;
  /** জন্ম তারিখ — বৈধ তারিখ এবং (দেওয়া থাকলে) বয়সসীমার ভেতরে। */
  dob?: boolean | { min?: number; max?: number };
  /** সর্বনিম্ন দৈর্ঘ্য। */
  minLength?: number;
  /** সর্বোচ্চ দৈর্ঘ্য। */
  maxLength?: number;
  /** রেগুলার এক্সপ্রেশন। */
  pattern?: RegExp;
  /** এই ঘরটির মান অন্য ঘরের সমান হতে হবে (যেমন পাসওয়ার্ড নিশ্চিতকরণ)। */
  matches?: string;
  /** checkbox — টিক দেওয়া বাধ্যতামূলক। */
  checked?: boolean;
  /** কাস্টম যাচাই — সমস্যা থাকলে বার্তা, না থাকলে "" ফেরত দিন। */
  custom?: (value: string, form: HTMLFormElement) => string;
  /** বার্তায় ব্যবহৃত ঘরের নাম। */
  label?: string;
  /** নিজের বার্তা (ডিফল্ট বার্তা বদলাতে)। */
  message?: string;
}

export type FormRules = Record<string, FieldRule>;

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  values: Record<string, string>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^01[3-9]\d{8}$/;

/** ফর্মের ভেতরে একটি ঘর খোঁজা — আগে id, তারপর name দিয়ে। */
export function findField(form: HTMLFormElement | Document, key: string): HTMLElement | null {
  const root: ParentNode = form as ParentNode;
  const byId = (root as any).querySelector?.("#" + cssEscape(key)) as HTMLElement | null;
  if (byId) return byId;
  const byName = (root as any).querySelector?.(`[name="${cssEscape(key)}"]`) as HTMLElement | null;
  return byName || null;
}

function cssEscape(v: string): string {
  return String(v).replace(/["\\]/g, "\\$&");
}

/** ঘরটির চারপাশের `.field` কনটেইনার (এরর বার্তা এখানেই বসে)। */
function fieldWrap(el: HTMLElement): HTMLElement {
  return (el.closest(".field, .f, .form-field, .fld") as HTMLElement) || (el.parentElement as HTMLElement) || el;
}

/** একটি ঘরে এরর বসানো — highlight + নিচে বার্তা। */
export function setFieldError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.classList.add("is-invalid");
  el.setAttribute("aria-invalid", "true");
  const wrap = fieldWrap(el);
  let box = wrap.querySelector<HTMLElement>(":scope > .field-error");
  if (!box) {
    box = document.createElement("span");
    box.className = "field-error";
    box.setAttribute("role", "alert");
    // ঘরের ঠিক নিচে — pw-wrap-এর মতো wrapper থাকলে তার পরেই
    const anchor = el.closest(".pw-wrap") || el;
    if (anchor.parentElement === wrap) wrap.insertBefore(box, anchor.nextSibling);
    else wrap.appendChild(box);
  }
  box.textContent = message;
  box.classList.add("show");
}

/** একটি ঘরের এরর/highlight মুছে ফেলা। */
export function clearFieldError(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("is-invalid");
  el.removeAttribute("aria-invalid");
  const box = fieldWrap(el).querySelector<HTMLElement>(":scope > .field-error");
  if (box) box.remove();
}

/** ফর্মের সব এরর একবারে মুছে ফেলা। */
export function clearFormErrors(form: HTMLElement | null): void {
  if (!form) return;
  form.querySelectorAll<HTMLElement>(".is-invalid").forEach((el) => {
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
  });
  form.querySelectorAll<HTMLElement>(".field-error").forEach((el) => el.remove());
}

/**
 * ব্যবহারকারী টাইপ/নির্বাচন শুরু করলেই ঐ ঘরের highlight ও বার্তা চলে যাবে।
 * ফর্ম তৈরি হওয়ার পর একবার ডাকলেই যথেষ্ট (delegated listener)।
 */
export function attachLiveClear(form: HTMLElement | null): void {
  if (!form || (form as any).__cbdcLiveClear) return;
  (form as any).__cbdcLiveClear = true;
  const handler = (e: Event) => {
    const t = e.target as HTMLInputElement | null;
    if (!t) return;
    const tag = String(t.tagName || "").toUpperCase();
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return;
    const filled = isToggle(t) ? t.checked : String(t.value || "").trim() !== "";
    if (filled) clearFieldError(t);
  };
  form.addEventListener("input", handler);
  form.addEventListener("change", handler);
}

/** checkbox / radio কিনা — `instanceof` ছাড়াই (SSR-নিরাপদ)। */
function isToggle(el: any): boolean {
  const tag = String(el?.tagName || "").toUpperCase();
  const type = String(el?.type || "").toLowerCase();
  return tag === "INPUT" && (type === "checkbox" || type === "radio");
}

function valueOf(el: HTMLElement | null): string {
  if (!el) return "";
  if (isToggle(el)) return (el as HTMLInputElement).checked ? "on" : "";
  return String((el as HTMLInputElement).value ?? "").trim();
}

function defaultMessage(rule: FieldRule, kind: string, extra?: Record<string, any>): string {
  if (rule.message) return rule.message;
  const label = rule.label || "এই ঘরটি";
  switch (kind) {
    case "required":
      return label + " পূরণ করুন";
    case "checked":
      return "এগিয়ে যেতে এখানে সম্মতি দিন";
    case "email":
      return "সঠিক ইমেইল ঠিকানা লিখুন";
    case "phone":
      return "১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন";
    case "dob":
      return "সঠিক জন্ম তারিখ নির্বাচন করুন";
    case "dobRange":
      return `জন্ম তারিখ অনুযায়ী বয়স ${toBanglaDigits(extra?.min ?? 18)} থেকে ${toBanglaDigits(extra?.max ?? 60)} বছরের মধ্যে হতে হবে`;
    case "minLength":
      return `কমপক্ষে ${toBanglaDigits(extra?.n)} অক্ষর দিন`;
    case "maxLength":
      return `সর্বোচ্চ ${toBanglaDigits(extra?.n)} অক্ষর দেওয়া যাবে`;
    case "pattern":
      return label + " সঠিক ফরম্যাটে নেই";
    case "matches":
      return "দুটি মান মিলছে না";
    default:
      return label + " সঠিক নয়";
  }
}

/**
 * ফর্ম যাচাই করে — সমস্যা থাকলে সব ঘরে highlight + নিচে বার্তা বসিয়ে দেয়,
 * প্রথম সমস্যাযুক্ত ঘরে scroll ও focus করে। **কোনো popup দেখায় না।**
 */
export function validateForm(form: HTMLFormElement | null, rules: FormRules): ValidationResult {
  const out: ValidationResult = { ok: true, errors: {}, values: {} };
  if (!form) return out;
  clearFormErrors(form);
  attachLiveClear(form);

  let firstBad: HTMLElement | null = null;

  for (const key of Object.keys(rules)) {
    const rule = rules[key] || {};
    const el = findField(form, key);
    const raw = valueOf(el);
    out.values[key] = raw;
    if (!el) continue;

    let error = "";

    if (rule.checked && !raw) error = defaultMessage(rule, "checked");
    else if (rule.required && !raw) error = defaultMessage(rule, "required");

    if (!error && raw) {
      if (rule.email && !EMAIL_RE.test(raw)) error = defaultMessage(rule, "email");
      else if (rule.phone && !PHONE_RE.test(toEnglishDigits(raw))) error = defaultMessage(rule, "phone");
      else if (rule.dob) {
        if (!isValidDob(raw)) error = defaultMessage(rule, "dob");
        else if (typeof rule.dob === "object") {
          const age = ageFromDob(raw) ?? -1;
          const min = rule.dob.min ?? 0;
          const max = rule.dob.max ?? 200;
          if (age < min || age > max) error = defaultMessage(rule, "dobRange", { min, max });
        }
      } else if (rule.minLength && raw.length < rule.minLength)
        error = defaultMessage(rule, "minLength", { n: rule.minLength });
      else if (rule.maxLength && raw.length > rule.maxLength)
        error = defaultMessage(rule, "maxLength", { n: rule.maxLength });
      else if (rule.pattern && !rule.pattern.test(raw)) error = defaultMessage(rule, "pattern");
      else if (rule.matches) {
        const other = findField(form, rule.matches);
        if (other && valueOf(other) !== raw) error = defaultMessage(rule, "matches");
      }
      if (!error && rule.custom) error = rule.custom(raw, form) || "";
    }

    if (error) {
      out.ok = false;
      out.errors[key] = error;
      setFieldError(el, error);
      if (!firstBad) firstBad = el;
    }
  }

  if (firstBad) {
    try {
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      /* ignore */
    }
    try {
      (firstBad as HTMLInputElement).focus({ preventScroll: true } as any);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * সব পেজে ব্যবহারের জন্য অভিন্ন CSS — highlight ও ইনলাইন এরর বার্তা।
 * পেজের নিজস্ব stylesheet-এর সাথে যোগ করা হয়, তাই ডিজাইন আগের মতোই থাকে,
 * শুধু ভুল ঘরের বর্ডার লাল হয় ও নিচে ছোট বার্তা আসে।
 */
export const FORM_ERROR_CSS = `
.is-invalid,
input.is-invalid,
select.is-invalid,
textarea.is-invalid{
  border-color:#e0242f !important;
  background:rgba(224,36,47,.04);
  box-shadow:0 0 0 3px rgba(224,36,47,.12) !important;
}
.is-invalid:focus{box-shadow:0 0 0 4px rgba(224,36,47,.18) !important}
label.check.is-invalid,
.check.is-invalid{box-shadow:none !important;background:transparent}
.field-error{
  display:block;
  margin-top:6px;
  color:#c31824;
  font-size:.76rem;
  font-weight:700;
  line-height:1.5;
}
[data-theme="dark"] .field-error{color:#ff8f96}
`;

export default { validateForm, setFieldError, clearFieldError, clearFormErrors, attachLiveClear, FORM_ERROR_CSS };
