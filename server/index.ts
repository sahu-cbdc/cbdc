
import { handleAdminEntityDelete, handleAdminConfigCheck, ApiError, type ServerDeleteResult } from "./deleteApi.ts";
import { handleAdminDedupe } from "./dedupeApi.ts";
import { handleDonorApply } from "./applyApi.ts";
import { handleResolveLegacy } from "./resolveLegacy.ts";
import { handleImageUpload, MAX_UPLOAD_BYTES } from "./imagesApi.ts";
import { makeApplyIo, makeHttpIo, makeImagesIo, makePrivilegedIo } from "./httpIo.ts";
import { serviceAccountConfigured } from "./authAdmin.ts";
import { corsForRequest, parseAllowedOrigins } from "./cors.ts";
import { createAbuseGuard, guardKey } from "./abuseGuard.ts";


function makeGuard(env: any) {
  const max = Number(env && env.ABUSE_GUARD_MAX) || 600;
  const windowMs = Number(env && env.ABUSE_GUARD_WINDOW_MS) || 60_000;
  return createAbuseGuard({ max, windowMs });
}
let abuseGuard: ReturnType<typeof createAbuseGuard> | null = null;
function getGuard(env: any) {
  if (!abuseGuard) abuseGuard = makeGuard(env);
  return abuseGuard;
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



export function toUserSafeMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  console.error("[api] unexpected error:", e);
  return GENERIC_ERROR_MSG;
}


function apiPaths(requestUrl: URL): Record<string, boolean> {
  const path = requestUrl.pathname.replace(/\/+$/, "");
  return {
    delete: /\/api\/admin\/delete$/i.test(path),
    dedupe: /\/api\/admin\/dedupe$/i.test(path),
    configCheck: /\/api\/admin\/config-check$/i.test(path),
    resolve: /\/api\/account\/resolve-legacy$/i.test(path),
    apply: /\/api\/donor\/apply$/i.test(path),
    upload: /\/api\/images\/upload$/i.test(path),
  };
}

const isApi = (p: Record<string, boolean>): boolean => Object.values(p).some(Boolean);


function clientKey(request: Request): string {
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip && ip.trim()) return ip.trim();
  const origin = request.headers.get("Origin");
  return origin && origin.trim() ? origin.trim() : "unknown";
}


async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  } catch {
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
        throw new ApiError(413, "ছবির আকার ৮ MB-র বেশি — ছোট ছবি দিন।");
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

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const apis = apiPaths(url);
    
    const isApply = path.endsWith("/api/donor/apply");
    const allowedOrigins = parseAllowedOrigins(env && env.ALLOWED_ORIGINS);

    
    if (!isApi(apis)) {
      return env.ASSETS && typeof env.ASSETS.fetch === "function"
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 });
    }

    
    const cors = corsForRequest(
      request.headers.get("Origin"),
      request.method,
      allowedOrigins,
      request.headers.get("Access-Control-Request-Method"),
    );
    
    if (request.method === "OPTIONS") {
      if (cors.preflight) {
        return new Response(null, { status: 204, headers: cors.headers });
      }
      return jsonResponse({ ok: false, error: "CORS preflight অনুমোদিত নয়।" }, { status: 403 });
    }

    if (request.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });

    
    const guardKeyStr = guardKey(clientKey(request), apis.upload ? "images/upload" : "api");
    if (!getGuard(env).check(guardKeyStr)) {
      return jsonResponse(
        { ok: false, error: "খুব দ্রুত অনেকগুলো অনুরোধ এসেছে — একটু পর আবার চেষ্টা করুন।" },
        { status: 429, corsHeaders: cors.headers },
      );
    }

    const auth = String(request.headers.get("Authorization") || "");
    const idToken = auth.replace(/^Bearer\s+/i, "").trim();

    
    if (!idToken) return jsonResponse({ ok: false, error: AUTH_MSG }, { status: 401, corsHeaders: cors.headers });

    try {
      
      if (apis.upload) {
        const len = contentLength(request);
        if (len > MAX_UPLOAD_BYTES) {
          return jsonResponse(
            { ok: false, error: "ছবির আকার ৮ MB-র বেশি — ছোট ছবি দিন।" },
            { status: 413, corsHeaders: cors.headers },
          );
        }
        const raw = await readUploadBody(request, MAX_UPLOAD_BYTES);
        const mime = String(request.headers.get("Content-Type") || "image/jpeg");
        const filename = String(request.headers.get("X-Filename") || "image.jpg");
        const result = await handleImageUpload(
          { idToken },
          raw,
          mime,
          filename,
          makeImagesIo(env),
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }

      
      const body = await readJsonBody(request);

      if (apis.delete) {
        const result: ServerDeleteResult = await handleAdminEntityDelete(
          { ...body, idToken },
          makeHttpIo(env, idToken),
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      if (apis.dedupe) {
        const result = await handleAdminDedupe(
          { apply: body.apply === true, idToken },
          makeHttpIo(env, idToken),
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      if (apis.configCheck) {
        const result = await handleAdminConfigCheck(
          { idToken },
          makeHttpIo(env, idToken),
          {
            serviceAccountConfigured: serviceAccountConfigured(env),
            imgbbConfigured: await makeImagesIo(env).hasKey(),
          },
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      if (apis.apply) {
        const result = await handleDonorApply({ ...body, idToken }, makeApplyIo(env, idToken));
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      
      const privileged = makePrivilegedIo(env);
      const result = await handleResolveLegacy({ idToken }, privileged);
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
