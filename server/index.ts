/**
 * CBDC — Cloudflare Worker entry
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  শুধুমাত্র একটি server endpoint আছে: `POST /api/admin/delete`
 *  (বেস পাথসহ, যেমন `/cbdc/api/admin/delete`) — Admin panel-এর অ্যাকাউন্ট/
 *  ডোনার আইডি deletion। বাকি সব অনুরোধ static assets-এ যায়
 *  (`env.ASSETS` → `./dist`, SPA fallback `single-page-application`)।
 *
 *  নিরাপত্তা (server-এও কোনো private key নেই):
 *    • শুধু POST; Authorization: Bearer <Firebase ID token> বাধ্যতামূলক,
 *    • same-origin SPA-র fetch — কোনো CORS header নেই (cross-origin থেকে
 *      custom Authorization header পাঠানো অসম্ভব),
 *    • token + অ্যাডমিন role যাচাই → RTDB Security Rules-এর অধীনেই delete
 *      (`server/deleteApi.ts` + `server/httpIo.ts` দেখুন)।
 *
 *  Deploy: `npm run build && npx wrangler deploy` (wrangler.jsonc-এ `main`
 *  ও `vars` সেট করা আছে — উভয় মান public: client config-এর হুবহু মান)।
 */

import { handleAdminEntityDelete, type ServerDeleteResult } from "./deleteApi.ts";
import { handleAdminDedupe } from "./dedupeApi.ts";
import { handleDonorApply } from "./applyApi.ts";
import { handleResolveLegacy } from "./resolveLegacy.ts";
import { makeApplyIo, makeHttpIo, makePrivilegedIo } from "./httpIo.ts";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const isDelete = path.endsWith("/api/admin/delete");
    const isDedupe = path.endsWith("/api/admin/dedupe");
    const isResolve = path.endsWith("/api/account/resolve-legacy");
    const isApply = path.endsWith("/api/donor/apply");

    if (!isDelete && !isDedupe && !isResolve && !isApply) {
      /* static assets (Vite build) — SPA fallback সহ */
      return env.ASSETS && typeof env.ASSETS.fetch === "function"
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

    const auth = String(request.headers.get("Authorization") || "");
    const idToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) return jsonResponse({ ok: false, error: "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।" }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ ok: false, error: "ভুল অনুরোধ — JSON body দিন।" }, 400);
    }

    try {
      if (isDelete) {
        const result: ServerDeleteResult = await handleAdminEntityDelete(
          { ...body, idToken },
          makeHttpIo(env, idToken),
        );
        return jsonResponse(result);
      }
      if (isDedupe) {
        const result = await handleAdminDedupe(
          { apply: body.apply === true, idToken },
          makeHttpIo(env, idToken),
        );
        return jsonResponse(result);
      }
      if (isApply) {
        /* Approval-settings OFF → সরাসরি process (donor/bloodGroup/donation) —
           privileged (service-account) IO দিয়ে; শুধু নিজের UID-ই process হয়। */
        const result = await handleDonorApply({ ...body, idToken }, makeApplyIo(env, idToken));
        return jsonResponse(result);
      }
      /* legacy-merge — সাধারণ (লগইন করা) ব্যবহারকারীর নিজের পুরোনো রেকর্ড */
      const privileged = makePrivilegedIo(env);
      const result = await handleResolveLegacy({ idToken }, privileged);
      return jsonResponse(result);
    } catch (e) {
      const status = Number((e as any)?.status) || 500;
      const message = (e as Error)?.message || "সার্ভার সমস্যা — আবার চেষ্টা করুন।";
      return jsonResponse({ ok: false, error: message }, status);
    }
  },
};
