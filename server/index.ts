

import { handleAdminEntityDelete, handleAdminConfigCheck, type ServerDeleteResult } from "./deleteApi.ts";
import { handleAdminDedupe } from "./dedupeApi.ts";
import { handleDonorApply } from "./applyApi.ts";
import { handleResolveLegacy } from "./resolveLegacy.ts";
import { handleImageUpload } from "./imagesApi.ts";
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

function readRequestBody(request: Request, api: Record<string, boolean>): Promise<{
  body: Record<string, unknown>;
  raw: Uint8Array;
  mime: string;
  filename: string;
}> {
  
  if (api.upload) {
    return request
      .arrayBuffer()
      .then((buf) => new Uint8Array(buf))
      .then((raw) => ({
        body: {},
        raw,
        mime: String(request.headers.get("Content-Type") || "image/jpeg"),
        filename: String(request.headers.get("X-Filename") || "image.jpg"),
      }));
  }
  return request
    .json()
    .then((body) => ({
      body: (body && typeof body === "object" ? body : {}) as Record<string, unknown>,
      raw: new Uint8Array(0),
      mime: "",
      filename: "",
    }))
    .catch(() => {
      throw new Error("ভুল অনুরোধ — JSON body দিন।");
    });
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

    let body: Record<string, unknown> = {};
    let raw: Uint8Array = new Uint8Array(0);
    let mime = "";
    let filename = "";
    try {
      const r = await readRequestBody(request, apis);
      body = r.body;
      raw = r.raw;
      mime = r.mime;
      filename = r.filename;
    } catch (e) {
      return jsonResponse(
        { ok: false, error: (e as Error)?.message || "ভুল অনুরোধ।" },
        { status: 400, corsHeaders: cors.headers },
      );
    }

    try {
      
      if (apis.upload) {
        if (!idToken) return jsonResponse({ ok: false, error: AUTH_MSG }, { status: 401, corsHeaders: cors.headers });
        const result = await handleImageUpload(
          { idToken },
          raw,
          mime,
          filename,
          makeImagesIo(env),
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }

      
      if (!idToken) return jsonResponse({ ok: false, error: AUTH_MSG }, { status: 401, corsHeaders: cors.headers });

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
      const status = Number((e as any)?.status) || 500;
      const message = (e as Error)?.message || "সার্ভার সমস্যা — আবার চেষ্টা করুন।";
      return jsonResponse(
        { ok: false, error: message },
        { status, corsHeaders: cors.headers },
      );
    }
  },
};
