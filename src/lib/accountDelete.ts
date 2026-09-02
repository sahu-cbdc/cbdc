

import { apiPostRaw } from "./api";
import { API_GATEWAYS, API_TIMEOUTS } from "../config/api";
import { toBanglaDigits } from "./age";




export async function resolveLegacyAccount(): Promise<{
  ok: boolean;
  merged: boolean;
  uid: string;
  email: string;
  profile?: Record<string, any>;
  donorId?: string;
  
  unconfigured?: boolean;
  error?: string;
}> {
  const fail = (status: number, message: string) => ({
    ok: false, merged: false, uid: "", email: "",
    unconfigured: status === 503 || /কনফিগার/i.test(message),
    error: message,
  });
  try {
    const res = await apiPostRaw(API_GATEWAYS.auth, { op: "resolve-legacy" }, { timeoutMs: TIMEOUT_MS });
    const data = res.data as any;
    if (!res.ok || !data || data.ok === false) {
      return fail(res.status, String(data?.error || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res.status || "—"})`));
    }
    return {
      ok: true,
      merged: data.merged === true,
      uid: String(data.uid || ""),
      email: String(data.email || ""),
      profile: (data.profile && typeof data.profile === "object") ? data.profile : undefined,
      donorId: data.donorId ? String(data.donorId) : undefined,
    };
  } catch (e) {
    return fail(0, (e as Error)?.message || "পুরোনো রেকর্ড মেলানো যায়নি।");
  }
}

export type DedupeGroupInfo = {
  kind: "user-email" | "donor-owner" | "donor-phone";
  key: string;
  keep: { id: string; name: string; email?: string; donorId?: string; uid?: string };
  remove: Array<{ id: string; name: string; email?: string; uid?: string }>;
  filledFields: string[];
};

export type DedupeReportInfo = {
  ok: boolean;
  applied: boolean;
  scanned: { users: number; donors: number; emailsIndexed: number };
  groups: DedupeGroupInfo[];
  notes: string[];
  changedPaths: number;
  error?: string;
};


export async function runDedupeScan(apply: boolean): Promise<DedupeReportInfo> {
  const fail = (error: string): DedupeReportInfo => ({
    ok: false, applied: false, scanned: { users: 0, donors: 0, emailsIndexed: 0 },
    groups: [], notes: [], changedPaths: 0, error,
  });
  try {
    const res = await apiPostRaw(CONFIG_ENDPOINT, { op: "dedupe", apply }, { timeoutMs: API_TIMEOUTS.dedupeScan });
    const data = res.data as any;
    if (!res.ok || !data || data.ok === false) {
      return fail(String(data?.error || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res.status || "—"})`));
    }
    return {
      ok: true,
      applied: data.applied === true,
      scanned: {
        users: Number(data.scanned?.users) || 0,
        donors: Number(data.scanned?.donors) || 0,
        emailsIndexed: Number(data.scanned?.emailsIndexed) || 0,
      },
      groups: Array.isArray(data.groups) ? data.groups : [],
      notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
      changedPaths: Number(data.changedPaths) || 0,
    };
  } catch (e) {
    return fail((e as Error)?.message || "স্ক্যান করা যায়নি।");
  }
}


export type DeleteScope = "account" | "donor";

export type DeletionStep = {
  id: string;
  label: string;
  ok: boolean;
  
  skipped?: boolean;
  error?: string;
};


export type DonorDeletionResult = {
  ok: boolean;
  scope: DeleteScope;
  donorId: string;
  uid: string;
  name: string;
  
  rtdb: "ok" | "failed" | "skipped";
  
  auth: "deleted" | "missing" | "failed" | "skipped";
  
  authUid?: string;
  
  server: "ok" | "failed" | "not-possible";
  steps: DeletionStep[];
  failed: DeletionStep[];
  
  removed: number;
  
  references: Record<string, string[]>;
  warnings: string[];
  
  error?: string;
};


const AUTH_UID_RE = /^[A-Za-z0-9_-]{20,64}$/;


export function isAuthUid(value: unknown): boolean {
  return AUTH_UID_RE.test(String(value ?? "").trim());
}

const ENDPOINT = API_GATEWAYS.admin;
const CONFIG_ENDPOINT = API_GATEWAYS.admin;
const TIMEOUT_MS = API_TIMEOUTS.accountDelete;


export async function checkDeleteServerConfig(): Promise<{ configured: boolean | null; error?: string }> {
  try {
    const res = await apiPostRaw(CONFIG_ENDPOINT, { op: "config-check" }, { timeoutMs: API_TIMEOUTS.statusCheck });
    const data: any = res.data;
    if (!res.ok || !data || data.ok !== true || typeof data.serviceAccountConfigured !== "boolean") {
      return { configured: null };
    }
    return { configured: data.serviceAccountConfigured === true };
  } catch {
    return { configured: null };
  }
}


export async function serverDeleteEntity(req: {
  scope: DeleteScope;
  donorId?: string;
  uid?: string;
  name?: string;
}): Promise<DonorDeletionResult> {
  const scope = req.scope === "account" ? "account" : "donor";
  const donorId = String(req.donorId ?? "").trim();
  const uid = String(req.uid ?? "").trim();
  const name = String(req.name ?? "").trim();
  try {
    const res = await apiPostRaw(ENDPOINT, { op: "delete", scope, donorId, uid, name }, { timeoutMs: TIMEOUT_MS });
    const data: any = res.data;
    if (!res.ok) {
      const message = String(data?.error || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res.status || "—"})`);
      return clientFailure(scope, donorId, uid, name, message);
    }
    if (!data || data.ok === false) {
      return clientFailure(scope, donorId, uid, name, String(data?.error || "সার্ভার delete ব্যর্থ হয়েছে।"));
    }
    return normalize(data, scope, donorId, uid, name);
  } catch (e) {
    const message = (e as Error)?.message || "নিরাপদ সার্ভার ডিলিট করা যায়নি।";
    return clientFailure(scope, donorId, uid, name, message);
  }
}





function normalize(data: any, scope: DeleteScope, donorId: string, uid: string, name: string): DonorDeletionResult {
  const failed: DeletionStep[] = [];
  return {
    ok: data.ok !== false,
    scope: data.scope === "account" ? "account" : scope,
    donorId: String(data.donorId || donorId),
    uid: String(data.uid || uid),
    name: String(data.name || name),
    rtdb: data.rtdb === "ok" ? "ok" : data.rtdb === "failed" ? "failed" : "skipped",
    auth:
      data.auth === "deleted" ? "deleted"
      : data.auth === "failed" ? "failed"
      : data.auth === "missing" ? "missing"
      : "skipped",
    authUid: String(data.authUid || ""),
    server: data.server === "ok" ? "ok" : "failed",
    steps: Array.isArray(data.steps) ? data.steps : [],
    failed,
    removed: Number(data.removed) || 0,
    references: (data.references && typeof data.references === "object") ? data.references : {},
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    error: data.ok === false ? String(data.error || "") : undefined,
  };
}

function clientFailure(scope: DeleteScope, donorId: string, uid: string, name: string, message: string): DonorDeletionResult {
  const step: DeletionStep = { id: "server", label: "নিরাপদ সার্ভার অনুরোধ", ok: false, error: message };
  return {
    ok: false,
    scope,
    donorId,
    uid,
    name,
    rtdb: "skipped",
    auth: "skipped",
    server: "failed",
    steps: [step],
    failed: [step],
    removed: 0,
    references: {},
    warnings: [],
    error: message,
  };
}




export function deletionMessage(result: DonorDeletionResult): string {
  const isAccount = result.scope === "account";
  if (result.ok) {
    const authPart =
      result.auth === "deleted"
        ? "লগইন অ্যাকাউন্ট (Firebase Authentication) সহ সম্পূর্ণ মুছে গেছে"
        : result.auth === "missing"
          ? "সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না — তাই কোনো লগইন মোছা হয়নি"
          : result.auth === "failed"
            ? "লগইন অ্যাকাউন্ট মোছা যায়নি"
            : "লগইন অ্যাকাউন্ট মোছা হয়নি — সার্ভার কনফিগারেশন প্রয়োজন";
    return isAccount
      ? `অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে — ${authPart}; ডোনার আইডি অক্ষত আছে`
      : `ডোনার আইডি সফলভাবে মুছে ফেলা হয়েছে — ${authPart}`;
  }
  if (result.error) return result.error;
  const detail = result.failed.find((f) => f.error)?.error;
  return `${isAccount ? "অ্যাকাউন্ট" : "ডোনার আইডি"} মুছে ফেলা যায়নি${detail ? ` — ${detail}` : "।"}`;
}


export function bulkDeletionMessage(results: DonorDeletionResult[]): string {
  const n = Math.max(1, results.length);
  const isAccount = results[0]?.scope === "account";
  const what = isAccount ? "অ্যাকাউন্ট" : "ডোনার আইডি";
  const title = n > 1 ? `নির্বাচিত ${toBanglaDigits(n)}টি ${what} মুছে ফেলা হয়েছে` : `${what} মুছে ফেলা হয়েছে`;
  const deleted = results.filter((r) => r.auth === "deleted").length;
  const missing = results.filter((r) => r.auth === "missing").length;
  const skipped = results.filter((r) => r.auth === "skipped").length;
  let authTxt: string;
  if (deleted && !skipped) {
    authTxt = isAccount
      ? " — লগইন (Firebase Authentication) সহ; ডোনার আইডি অক্ষত আছে"
      : " — সংশ্লিষ্ট লগইন অ্যাকাউন্টসহ (Firebase Authentication)";
  } else if (!deleted && missing && !skipped) {
    authTxt = isAccount
      ? " — সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না; ডোনার আইডি অক্ষত আছে"
      : " — সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না";
  } else if (skipped && deleted) {
    authTxt = ` — ${toBanglaDigits(deleted)} জনের লগইন মুছেছে, ${toBanglaDigits(skipped)} জনের মোছা হয়নি (সার্ভার কনফিগারেশন দেখুন)`;
  } else if (skipped) {
    authTxt = " — লগইন অ্যাকাউন্ট মোছা হয়নি (সার্ভার কনফিগারেশন দেখুন)";
  } else {
    authTxt = "";
  }
  return title + authTxt;
}


export function describeDeletionFailure(name: string, failed: DeletionStep[]): string {
  const target = String(name || "").trim() || "ডোনার";
  const parts = failed
    .map((f) => f.label + (f.error ? ` (${f.error})` : ""))
    .filter(Boolean)
    .join(", ");
  return `${target} মুছে ফেলা যায়নি — ${parts || "অজানা সমস্যা"}।`;
}
