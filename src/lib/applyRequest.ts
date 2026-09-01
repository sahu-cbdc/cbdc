

import { getAuthInstance } from "./firebase";
import { appBase } from "./router";

export type ApplyAction = "donor" | "bloodGroup" | "donation";

export type ApplyOutcome = {
  ok: boolean;
  action: ApplyAction;
  approvalRequired: boolean;
  donorId?: string;
  error?: string;
};

const ENDPOINT = "api/donor/apply";
const TIMEOUT_MS = 20000;

export async function requestDirectApply(
  action: ApplyAction,
  payload: Record<string, unknown> = {},
): Promise<ApplyOutcome> {
  try {
    const auth = getAuthInstance();
    const user = (auth?.currentUser ?? null) as any;
    if (!user || typeof user.getIdToken !== "function") {
      return { ok: false, action, approvalRequired: false, error: "লগইন করা নেই — অনুমোদন পাওয়া যায়নি।" };
    }
    let token = "";
    try {
      token = await user.getIdToken();
    } catch (e) {
      return { ok: false, action, approvalRequired: false, error: `ID token পাওয়া যায়নি — ${(e as Error)?.message || "আবার লগইন করুন।"}` };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response | null = null;
    try {
      res = await fetch(`${appBase()}${ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res || !res.ok) {
      return {
        ok: false, action, approvalRequired: false,
        error: String((data && data.error) || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res ? res.status : "—"})`),
      };
    }
    if (!data) return { ok: false, action, approvalRequired: false, error: "সার্ভার কোনো উত্তর দেয়নি।" };
    return {
      ok: data.ok === true,
      action,
      approvalRequired: data.approvalRequired === true,
      donorId: data.donorId || undefined,
      error: data.error || undefined,
    };
  } catch (e) {
    const message = (e as Error)?.message || "সরাসরি process করা যায়নি।";
    return {
      ok: false, action, approvalRequired: false,
      error: message.includes("abort") ? "অনুরোধের সময়সীমা পেরিয়ে গেছে — আবার চেষ্টা করুন।" : message,
    };
  }
}
