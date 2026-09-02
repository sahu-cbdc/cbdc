

import { ageFromDob, isValidDob, toEnglishDigits, toBanglaDigits } from "./age";

export interface FieldRule {
  
  required?: boolean;
  
  email?: boolean;
  
  phone?: boolean;
  
  dob?: boolean | { min?: number; max?: number };
  
  minLength?: number;
  
  maxLength?: number;
  
  pattern?: RegExp;
  
  matches?: string;
  
  checked?: boolean;
  
  custom?: (value: string, form: HTMLFormElement) => string;
  
  label?: string;
  
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


function fieldWrap(el: HTMLElement): HTMLElement {
  return (el.closest(".field, .f, .form-field, .fld") as HTMLElement) || (el.parentElement as HTMLElement) || el;
}


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
    
    const anchor = el.closest(".pw-wrap") || el;
    if (anchor.parentElement === wrap) wrap.insertBefore(box, anchor.nextSibling);
    else wrap.appendChild(box);
  }
  box.textContent = message;
  box.classList.add("show");
}


export function clearFieldError(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("is-invalid");
  el.removeAttribute("aria-invalid");
  const box = fieldWrap(el).querySelector<HTMLElement>(":scope > .field-error");
  if (box) box.remove();
}


export function clearFormErrors(form: HTMLElement | null): void {
  if (!form) return;
  form.querySelectorAll<HTMLElement>(".is-invalid").forEach((el) => {
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
  });
  form.querySelectorAll<HTMLElement>(".field-error").forEach((el) => el.remove());
}


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
      
    }
    try {
      (firstBad as HTMLInputElement).focus({ preventScroll: true } as any);
    } catch {
      
    }
  }
  return out;
}


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

