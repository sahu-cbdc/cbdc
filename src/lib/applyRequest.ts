
import { apiPostRaw, ApiCallError } from "./api";
import { API_GATEWAYS, API_TIMEOUTS } from "../config/api";

export type ApplyAction = "donor" | "bloodGroup" | "donation";

export type ApplyOutcome = {
  ok: boolean;
  action: ApplyAction;
  approvalRequired: boolean;
  donorId?: string;
  error?: string;
};

const ENDPOINT = API_GATEWAYS.data;
const TIMEOUT_MS = API_TIMEOUTS.apply;

/**
 * Server-side "apply" (donor / bloodGroup / donation) — routed through the
 * central API layer (token, timeout, error mapping live in src/lib/api.ts).
 */
export async function requestDirectApply(
  action: ApplyAction,
  payload: Record<string, unknown> = {},
): Promise<ApplyOutcome> {
  const fail = (error: string): ApplyOutcome => ({ ok: false, action, approvalRequired: false, error });
  try {
    const res = await apiPostRaw(ENDPOINT, { op: "apply", action, ...payload }, { timeoutMs: TIMEOUT_MS });
    if (!res.ok) {
      return fail(String((res.data as any)?.error || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res.status || "—"})`));
    }
    if (!res.data) return fail("সার্ভার কোনো উত্তর দেয়নি।");
    return {
      ok: res.data.ok === true,
      action,
      approvalRequired: res.data.approvalRequired === true,
      donorId: res.data.donorId || undefined,
      error: res.data.error || undefined,
    };
  } catch (e) {
    if (e instanceof ApiCallError) return fail(e.message);
    return fail((e as Error)?.message || "সরাসরি process করা যায়নি।");
  }
}
