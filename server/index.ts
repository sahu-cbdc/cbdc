/**
 * Central API gateway — exactly four endpoints, each dispatching on `op`:
 *
 *   POST /api/auth   → op: profile | claim-email | claim-login | resolve-legacy
 *   POST /api/data   → op: write | apply | public-submit   (public-submit
 *                      may be anonymous; everything else needs a Bearer token)
 *   POST /api/admin  → op: delete | dedupe | config-check | donor-id
 *   POST /api/media  → image upload (binary body, no op)
 *
 * Every request verifies the caller's Firebase ID token server-side and
 * resolves uid/role/ownership from verified data only. Errors are sanitized
 * (Bangla, no internals); unknown /api routes get a JSON 404 — never the SPA.
 */
import { handleAdminEntityDelete, handleAdminConfigCheck, ApiError, type ServerDeleteResult } from "./deleteApi.ts";
import { handleAdminDedupe } from "./dedupeApi.ts";
import { handleDonorApply } from "./applyApi.ts";
import { handleResolveLegacy } from "./resolveLegacy.ts";
import { handleImageUpload, MAX_UPLOAD_BYTES } from "./imagesApi.ts";
import { makeApplyIo, makeHttpIo, makeImagesIo, makePrivilegedIo, makeDataIo, makePublicIo, makeDonorIdIo } from "./httpIo.ts";
import { serviceAccountConfigured } from "./authAdmin.ts";
import { corsForRequest } from "./cors.ts";
import { createAbuseGuard, guardKey } from "./abuseGuard.ts";
import { serverConfig } from "./config.ts";
import { handleDataWrite } from "./dataApi.ts";
import { handleProfileUpsert, handleClaimEmail, handleClaimLogin } from "./profileApi.ts";
import { handleDonorIdAction } from "./donorIdApi.ts";
import { handlePublicSubmit } from "./publicApi.ts";

type Gateway = "auth" | "data" | "admin" | "media";

const GATEWAY_RE: Record<Gateway, RegExp> = {
  auth: /\/api\/auth$/i,
  data: /\/api\/data$/i,
  admin: /\/api\/admin$/i,
  media: /\/api\/media$/i,
};

function gatewayOf(pathname: string): Gateway | null {
  for (const key of Object.keys(GATEWAY_RE) as Gateway[]) {
    if (GATEWAY_RE[key].test(pathname)) return key;
  }
  return null;
}

interface JsonOptions {
  status?: number;
  corsHeaders?: Record<string, string>;
}

function jsonResponse(payload: unknown, opts: JsonOptions = {}): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...(opts.corsHeaders || {}),
  };
  return new Response(JSON.stringify(payload), {
    status: opts.status ?? 200,
    headers,
  });
}

const AUTH_MSG = "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।";
const GENERIC_ERROR_MSG = "সার্ভারে সাময়িক সমস্যা হয়েছে — একটু পর আবার চেষ্টা করুন।";
const UNKNOWN_OP_MSG = "অনুরোধকৃত কাজটি খুঁজে পাওয়া যায়নি।";
const FLOOD_MSG = "খুব দ্রুত অনেকগুলো অনুরোধ এসেছে — একটু পর আবার চেষ্টা করুন।";

export function toUserSafeMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  console.error("[api] unexpected error:", e);
  return GENERIC_ERROR_MSG;
}

function clientKey(request: Request): string {
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip && ip.trim()) return ip.trim();
  const origin = request.headers.get("Origin");
  return origin && origin.trim() ? origin.trim() : "unknown";
}

async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      throw new ApiError(413, "অনুরোধটি খুব বড় — একটু ছোট করে আবার পাঠান।");
    }
    const body = JSON.parse(text || "{}");
    return (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "ভুল অনুরোধ — JSON body দিন।");
  }
}

async function readUploadBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const reader = request.body && typeof request.body.getReader === "function" ? request.body.getReader() : null;
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new Uint8Array(value);
      total += chunk.length;
      if (total > maxBytes) {
        throw new ApiError(413, "ছবিটি খুব বড় — ছোট ছবি দিন।");
      }
      chunks.push(chunk);
    }
  } catch (e) {
    await reader.cancel().catch(() => undefined);
    throw e;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function contentLength(request: Request): number {
  const raw = String(request.headers.get("Content-Length") || "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const guards = new Map<string, ReturnType<typeof createAbuseGuard>>();
function guardFor(env: any, bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${max}:${windowMs}`;
  let guard = guards.get(key);
  if (!guard) {
    guard = createAbuseGuard({ max, windowMs });
    guards.set(key, guard);
  }
  return guard;
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const cfg = serverConfig(env);
    const isApiPath = /^\/api\//i.test(path);
    const gateway = gatewayOf(path);

    if (!isApiPath) {
      return env.ASSETS && typeof env.ASSETS.fetch === "function"
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 });
    }

    const cors = corsForRequest(
      request.headers.get("Origin"),
      request.method,
      cfg.allowedOrigins,
      request.headers.get("Access-Control-Request-Method"),
    );

    if (request.method === "OPTIONS") {
      if (cors.preflight) {
        return new Response(null, { status: 204, headers: cors.headers });
      }
      return jsonResponse({ ok: false, error: "CORS preflight অনুমোদিত নয়।" }, { status: 403 });
    }

    if (!gateway) {
      return jsonResponse(
        { ok: false, error: "অনুরোধকৃত API রুটটি খুঁজে পাওয়া যায়নি।" },
        { status: 404, corsHeaders: cors.headers },
      );
    }

    if (request.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });

    const auth = String(request.headers.get("Authorization") || "");
    const idToken = auth.replace(/^Bearer\s+/i, "").trim();

    try {
      if (gateway === "media") {
        if (!guardFor(env, "media", cfg.abuseGuardMax, cfg.abuseGuardWindowMs).check(guardKey(clientKey(request), "media"))) {
          return jsonResponse({ ok: false, error: FLOOD_MSG }, { status: 429, corsHeaders: cors.headers });
        }
        if (!idToken) return jsonResponse({ ok: false, error: AUTH_MSG }, { status: 401, corsHeaders: cors.headers });
        const len = contentLength(request);
        if (len > MAX_UPLOAD_BYTES) {
          return jsonResponse(
            { ok: false, error: "ছবিটি খুব বড় — ছোট ছবি দিন।" },
            { status: 413, corsHeaders: cors.headers },
          );
        }
        const raw = await readUploadBody(request, MAX_UPLOAD_BYTES);
        const mime = String(request.headers.get("Content-Type") || "image/jpeg");
        const filename = String(request.headers.get("X-Filename") || "image.jpg");
        const result = await handleImageUpload({ idToken }, raw, mime, filename, makeImagesIo(env));
        return jsonResponse(result, { corsHeaders: cors.headers });
      }

      const body = await readJsonBody(request, cfg.maxJsonBytes);
      const op = String(body.op ?? "").trim();

      const isPublicSubmit = gateway === "data" && op === "public-submit";
      if (isPublicSubmit) {
        if (!guardFor(env, "public/submit", cfg.publicSubmitGuardMax, cfg.abuseGuardWindowMs).check(guardKey(clientKey(request), "public/submit"))) {
          return jsonResponse({ ok: false, error: FLOOD_MSG }, { status: 429, corsHeaders: cors.headers });
        }
      } else {
        if (!guardFor(env, "api", cfg.abuseGuardMax, cfg.abuseGuardWindowMs).check(guardKey(clientKey(request), gateway))) {
          return jsonResponse({ ok: false, error: FLOOD_MSG }, { status: 429, corsHeaders: cors.headers });
        }
        if (!idToken) return jsonResponse({ ok: false, error: AUTH_MSG }, { status: 401, corsHeaders: cors.headers });
      }

      let result: unknown;
      if (gateway === "auth") {
        if (op === "profile") result = await handleProfileUpsert({ ...body, idToken }, makeDataIo(env));
        else if (op === "claim-email") result = await handleClaimEmail({ ...body, idToken }, makeDataIo(env));
        else if (op === "claim-login") result = await handleClaimLogin({ ...body, idToken }, makeDataIo(env));
        else if (op === "resolve-legacy") result = await handleResolveLegacy({ idToken }, makePrivilegedIo(env));
        else throw new ApiError(400, UNKNOWN_OP_MSG);
      } else if (gateway === "data") {
        if (op === "write") result = await handleDataWrite({ ...body, idToken }, makeDataIo(env));
        else if (op === "apply") result = await handleDonorApply({ ...body, idToken }, makeApplyIo(env, idToken));
        else if (op === "public-submit") result = await handlePublicSubmit(body, makePublicIo(env), idToken);
        else throw new ApiError(400, UNKNOWN_OP_MSG);
      } else {
        if (op === "delete") {
          const deleted: ServerDeleteResult = await handleAdminEntityDelete({ ...body, idToken }, makeHttpIo(env));
          result = deleted;
        } else if (op === "dedupe") {
          result = await handleAdminDedupe({ apply: body.apply === true, idToken }, makeHttpIo(env));
        } else if (op === "config-check") {
          result = await handleAdminConfigCheck({ idToken }, makeHttpIo(env), {
            serviceAccountConfigured: serviceAccountConfigured(env),
            imgbbConfigured: await makeImagesIo(env).hasKey(),
          });
        } else if (op === "donor-id") {
          result = await handleDonorIdAction({ ...body, idToken }, makeDonorIdIo(env));
        } else throw new ApiError(400, UNKNOWN_OP_MSG);
      }
      return jsonResponse(result, { corsHeaders: cors.headers });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 500;
      const message = toUserSafeMessage(e);
      return jsonResponse(
        { ok: false, error: message },
        { status, corsHeaders: cors.headers },
      );
    }
  },
};
