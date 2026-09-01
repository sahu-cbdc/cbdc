/**
 * Secure API client — the single gateway for every backend/data operation.
 *
 *   Website UI → apiPost() → Secure API (Worker) → Firebase/RTDB (privileged)
 *
 * Rules of this layer:
 *   • Every privileged call carries the caller's Firebase ID token
 *     (Authorization: Bearer <idToken>) — the server verifies it and resolves
 *     role/ownership itself; a client-supplied uid is never trusted.
 *   • No server secret ever lives here: no service account, no ImgBB key.
 *   • Errors surface as Bangla-first Error messages so panels can toast them.
 *   • Endpoints are relative to appBase() so the same API serves the website
 *     and future Android/iOS clients from the same origin/CDN edge.
 */
import { getAuthInstance } from "./firebase";
import { appBase } from "./router";

export const API_TIMEOUT_MS = 30000;
export const API_LONG_TIMEOUT_MS = 45000;

export class ApiCallError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiCallError";
    this.status = status;
  }
}

const AUTH_REQUIRED_MESSAGE = "লগইন করা নেই — অনুমোদন পাওয়া যায়নি।";
const NETWORK_MESSAGE = "সার্ভারে সংযোগ করা যায়নি — ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
const TIMEOUT_MESSAGE = "অনুরোধের সময়সীমা পেরিয়ে গেছে — আবার চেষ্টা করুন।";

export async function getAuthToken(): Promise<string> {
  const auth = getAuthInstance();
  const user = (auth?.currentUser ?? null) as any;
  if (!user || typeof user.getIdToken !== "function") return "";
  try {
    return await user.getIdToken();
  } catch {
    return "";
  }
}

export type ApiPostOptions = {
  token?: string;
  timeoutMs?: number;
  allowEmptyToken?: boolean;
};

export type ApiPostResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
};

/** Low-level POST that never throws for HTTP-level API errors. */
export async function apiPostRaw<T = any>(
  endpoint: string,
  body: unknown,
  opts: ApiPostOptions = {}
): Promise<ApiPostResult<T>> {
  const token = opts.token !== undefined ? opts.token : await getAuthToken();
  if (!token && !opts.allowEmptyToken) {
    throw new ApiCallError(401, AUTH_REQUIRED_MESSAGE);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || API_TIMEOUT_MS);
  let res: Response | null = null;
  try {
    res = await fetch(`${appBase()}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
  } catch (e) {
    const message = String((e as Error)?.message || "");
    throw new ApiCallError(0, message.includes("abort") ? TIMEOUT_MESSAGE : NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: !!(res && res.ok && data && data.ok !== false), status: res ? res.status : 0, data };
}

/** POST that throws a Bangla Error unless the API answers ok:true. */
export async function apiPost<T = any>(
  endpoint: string,
  body: unknown,
  opts: ApiPostOptions = {}
): Promise<T> {
  const res = await apiPostRaw<T>(endpoint, body, opts);
  if (!res.ok) {
    const message = String(
      (res.data as any)?.error ||
        (res.data as any)?.message ||
        `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res.status || "—"})`
    );
    throw new ApiCallError(res.status || 0, message);
  }
  return (res.data ?? {}) as T;
}

/**
 * Server-timestamp marker — the API translates it to RTDB's {".sv":"timestamp"}
 * so writes keep the same server-clock semantics the SDK provided.
 */
export const SERVER_TIMESTAMP = { __sv__: "timestamp" } as const;

export type DataWriteResult = {
  ok: true;
  applied: number;
  values: Record<string, number>;
};

/**
 * Guarded multi-path write. Every path is authorized server-side
 * (role + ownership + protected-field checks) before anything is applied.
 */
export async function apiWritePaths(paths: Record<string, any>): Promise<DataWriteResult> {
  const out = await apiPost<DataWriteResult>("api/data/write", { writes: paths });
  return {
    ok: true,
    applied: Number(out?.applied) || 0,
    values: (out?.values && typeof out.values === "object" ? out.values : {}) as Record<string, number>,
  };
}

export async function apiIncrementField(
  node: string,
  id: string,
  field: string,
  amount = 1
): Promise<number> {
  const path = `${node}/${id}/${field}`;
  const res = await apiWritePaths({ [path]: { __inc__: amount } });
  const value = Number(res.values[path]);
  return Number.isFinite(value) ? value : 0;
}

export async function apiEnsureFieldAtLeast(
  node: string,
  id: string,
  field: string,
  minimum: number
): Promise<number> {
  const path = `${node}/${id}/${field}`;
  const res = await apiWritePaths({ [path]: { __max__: minimum } });
  const value = Number(res.values[path]);
  return Number.isFinite(value) ? value : 0;
}

export type EmailClaimStatus =
  | { status: "claimed" }
  | { status: "conflict"; ownerUid: string }
  | { status: "unavailable" };

export async function apiClaimEmail(email: string): Promise<EmailClaimStatus> {
  return apiPost<EmailClaimStatus>("api/account/claim-email", { email });
}

export type ClaimLoginResponse = { ok: true; results: Record<string, string> };

export async function apiClaimLogin(
  email: string,
  username: string,
  phone: string
): Promise<ClaimLoginResponse> {
  return apiPost<ClaimLoginResponse>("api/account/claim-login", { email, username, phone });
}

export async function apiReleaseLogin(
  email: string,
  username: string,
  phone: string
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>("api/account/claim-login", {
    email,
    username,
    phone,
    release: true,
  });
}

export async function apiReleaseEmailIdentity(email: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>("api/account/claim-email", { email, release: true });
}

export type ProfileUpsertResult = { ok: true; created: boolean; profile: Record<string, any> };

/** Upsert the caller's own users/{uid} profile (server merges + indexes). */
export async function apiUpsertProfile(
  user: Record<string, any>,
  opts: { provider?: string; mode?: "create" | "update" | "upsert" } = {}
): Promise<ProfileUpsertResult> {
  return apiPost<ProfileUpsertResult>("api/account/profile", {
    user,
    provider: opts.provider || "",
    mode: opts.mode || "upsert",
  });
}

export async function apiNextDonorId(): Promise<string> {
  const res = await apiPost<{ donorId: string }>("api/donor/id", { action: "next" });
  const id = String(res?.donorId || "").trim();
  if (!id) throw new Error("Donor UID তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
  return id;
}

export async function apiReleaseDonorSerial(donorId: string): Promise<void> {
  await apiPost("api/donor/id", { action: "release", donorId });
}

export type PublicSubmitResult = {
  ok: true;
  kind: string;
  duplicate?: boolean;
  id?: string;
  status?: string;
};

/**
 * Public (optionally anonymous) submissions from the website forms.
 * The server re-validates everything and derives ownerUid from the verified
 * token when one is present — a client-supplied ownerUid is never trusted.
 */
export async function apiPublicSubmit(
  kind: "donor-registration" | "emergency-request",
  payload: Record<string, unknown>
): Promise<PublicSubmitResult> {
  const token = await getAuthToken();
  return apiPost<PublicSubmitResult>("api/public/submit", { kind, payload }, {
    token,
    allowEmptyToken: true,
  });
}
