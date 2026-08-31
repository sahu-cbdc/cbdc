/**
 * CBDC — Cloudflare Worker entry
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Server endpoints (base path সহ, যেমন `/cbdc/api/...`):
 *    • POST /api/admin/delete          — Admin panel-এর অ্যাকাউন্ট/ডোনার আইডি deletion
 *    • POST /api/admin/dedupe           — Admin duplicate cleanup
 *    • POST /api/admin/config-check     — Admin deletion preflight (secret আছে কি না)
 *    • POST /api/account/resolve-legacy — legacy-merge (নিজের পুরোনো রেকর্ড)
 *    • POST /api/donor/apply            — Approval-settings OFF → direct processing
 *    • POST /api/images/upload          — Secure server-side image upload (ImgBB proxy)
 *
 *  নিরাপত্তা:
 *    • সব আটটি endpoint-ই authenticated — `Authorization: Bearer <Firebase ID
 *      token>` Identity Toolkit দিয়ে যাচাই হয় (401/403 condition);
 *    • **কোনো private key / service-account / API secret ক্লায়েন্ট bundle-এ নেই**।
 *      কোনো secret-ই কখনো API response-এ ফেরত যায় না;
 *    • CORS — allowlist-ভিত্তিক; CORS কখনোই authentication নয়; `*` ব্যবহার হয় না;
 *    • **Intelligent abuse protection** — fixed normal-user quota নয়; শুধু স্পষ্ট
 *      flooding (একই উৎস থেকে দ্রুত ধারাবাহিক অনুরোধ) 429 দেয়। legitimate
 *      usage কার্যত unlimited।
 *    • upload-এ raw image body ৮ MB-এ সীমিত; ছবি কখনো সার্ভারে সংরক্ষণ হয় না —
 *      শুধু ImgBB-তে যায় ও URL ফেরত আসে।
 *
 *  Deploy: `npm run build && npx wrangler deploy` (wrangler.jsonc-এ `main`
 *  ও `vars` সেট আছে — উভয় মান public: client config-এর হুবহু মান; আর সব
 *  secret (`FIREBASE_SERVICE_ACCOUNT`, `IMGBB_API_KEY`) wrangler secret-এ)।
 */

import { handleAdminEntityDelete, handleAdminConfigCheck, type ServerDeleteResult } from "./deleteApi.ts";
import { handleAdminDedupe } from "./dedupeApi.ts";
import { handleDonorApply } from "./applyApi.ts";
import { handleResolveLegacy } from "./resolveLegacy.ts";
import { handleImageUpload } from "./imagesApi.ts";
import { makeApplyIo, makeHttpIo, makeImagesIo, makePrivilegedIo } from "./httpIo.ts";
import { serviceAccountConfigured } from "./authAdmin.ts";
import { corsForRequest, parseAllowedOrigins } from "./cors.ts";
import { createAbuseGuard, guardKey } from "./abuseGuard.ts";

/*
 * Intelligent abuse protection — module-level (per worker isolate) in-memory.
 * Fixed normal-user quota নয়: threshold খুবই উদার (ডিফল্ট ৬০০/মিনিট/উৎস) —
 * স্বাভাবিক ব্যবহার (এমনকি অ্যাডমিনের bulk-delete) এতে স্পর্শ হয় না; শুধু স্পষ্ট
 * flood (একই উৎস থেকে দ্রুত ধারাবাহিক অনুরোধ) 429 দেয়। Multi-user legitimate
 * traffic প্রত্যেকের নিজস্ব bucket-এ পড়ে — aggregate কার্যত unlimited।
 * `ABUSE_GUARD_MAX` / `ABUSE_GUARD_WINDOW_MS` env দিয়ে আরও উদার করা যায়।
 */
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

/** অনুরোধটি API endpoint কিনা — base path-এর সাথে মিলিয়ে, শেষে `/api/...`। */
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

/** স্পষ্ট flooding দমন — per-উৎস (IP বা, না থাকলে, origin)। auth হিসেবে নয়। */
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
  /* upload — raw image bytes (JSON নয়)। */
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
    /* wiring-compat name — আচরণ apis.apply-র সমতুল্য */
    const isApply = path.endsWith("/api/donor/apply");
    const allowedOrigins = parseAllowedOrigins(env && env.ALLOWED_ORIGINS);

    /* ── static assets (Vite build) — SPA fallback সহ; API-র কোনো CORS না। ── */
    if (!isApi(apis)) {
      return env.ASSETS && typeof env.ASSETS.fetch === "function"
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 });
    }

    /* ── CORS — allowlist-ভিত্তিক; CORS auth নয়, token-ই auth। ── */
    const cors = corsForRequest(
      request.headers.get("Origin"),
      request.method,
      allowedOrigins,
      request.headers.get("Access-Control-Request-Method"),
    );
    /* Preflight (OPTIONS + Origin) — header-সহ 204। */
    if (request.method === "OPTIONS") {
      if (cors.preflight) {
        return new Response(null, { status: 204, headers: cors.headers });
      }
      return jsonResponse({ ok: false, error: "CORS preflight অনুমোদিত নয়।" }, { status: 403 });
    }

    if (request.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });

    /* ── Abuse/flood protection — উদার per-উৎস; legitimate unlimited। ── */
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
      /* ── upload — কোনো token ছাড়া সম্ভব নয়; raw body only। ── */
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

      /* ── বাকি সব JSON API — token বাধ্যতামূলক। ── */
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
          { serviceAccountConfigured: serviceAccountConfigured(env) },
        );
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      if (apis.apply) {
        const result = await handleDonorApply({ ...body, idToken }, makeApplyIo(env, idToken));
        return jsonResponse(result, { corsHeaders: cors.headers });
      }
      /* legacy-merge — সাধারণ (লগইন করা) ব্যবহারকারীর নিজের পুরোনো রেকর্ড */
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
