import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAdminEntityDelete } from "./server/deleteApi";
import { makeHttpIo } from "./server/httpIo";

/* ═══════════════════════════════════════════════════════════════════════════
   Admin Panel → "ওয়েবসাইট" সেটিংস ↔ Main Website-এর src/config/site.ts
   ═══════════════════════════════════════════════════════════════════════════

   অ্যাডমিন প্যানেলের "ওয়েবসাইট" ফর্মে সেভ করা মান আর Realtime Database-এ
   যায় না — এই dev-only middleware সেগুলো সরাসরি `src/config/site.ts`
   (Main Website-এর কেন্দ্রীয় কনফিগ ফাইল)-এ লিখে দেয়। ফাইল বদলালে Vite-এর
   HMR সাথে সাথে সব খোলা পেজ রিলোড করে দেয়, তাই ওয়েবসাইটে পরিবর্তন সঙ্গে
   সঙ্গে দেখা যায়। ফাইলের বাকি সব অংশ (comment, structure) অপরিবর্তিত থাকে —
   শুধু নির্দিষ্ট মানগুলো replace হয়। */

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE_TS = path.resolve(PROJECT_ROOT, "src/config/site.ts");

/* অ্যাডমিন ফর্মের key → src/config/site.ts-এর field path */
const SITE_FIELDS: Record<string, string[]> = {
  heroTitle: ["hero", "title"],
  heroText: ["hero", "text"],
  phone: ["phone"],
  email: ["email"],
  address: ["address"],
  facebook: ["facebookHandle"],
  showStats: ["showStats"],
  showGallery: ["showGallery"],
  showEmergency: ["showEmergency"],
};

/* মান → TypeScript literal (string escape-সহ) */
const toLiteral = (v: string | boolean): string =>
  typeof v === "boolean" ? String(v) : JSON.stringify(v);

/* একটি string/boolean literal-এর regex — escaped অক্ষরসহ */
const LIT = `(?:"[^"\\\\]*(?:\\\\.[^"\\\\])*"|true|false)`;

/* src/config/site.ts-এ নির্দিষ্ট field-এর মান বদলায় (বাকি সব হুবহু রেখে) */
function setSiteField(src: string, fieldPath: string[], value: string | boolean): string {
  const [outer, inner] = fieldPath;
  if (!inner) {
    const re = new RegExp(`(^\\s*${outer}:\\s*)${LIT}`, "m");
    if (!re.test(src)) throw new Error(`field not found: ${outer}`);
    return src.replace(re, (_m, g1: string) => g1 + toLiteral(value));
  }
  /* nested block — যেমন hero: { title: "…", text: "…" } */
  const blockRe = new RegExp(`(\\b${outer}:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`);
  const block = src.match(blockRe);
  if (!block) throw new Error(`block not found: ${outer}`);
  const fieldRe = new RegExp(`(\\b${inner}:\\s*)${LIT}`);
  if (!fieldRe.test(block[2])) throw new Error(`field not found: ${outer}.${inner}`);
  const body = block[2].replace(fieldRe, (_m, g1: string) => g1 + toLiteral(value));
  return src.slice(0, block.index) + block[1] + body + block[3] + src.slice(block.index + block[0].length);
}

function writeSiteConfig(values: Record<string, unknown>): { ok: boolean; updated: string[] } {
  const updates: Array<[string[], string | boolean]> = [];
  for (const [key, raw] of Object.entries(values || {})) {
    const fieldPath = SITE_FIELDS[key];
    if (!fieldPath) continue; // অজানা key নীরবে উপেক্ষা
    if (typeof raw === "boolean") updates.push([fieldPath, raw]);
    else if (typeof raw === "string" && raw.length <= 2000) updates.push([fieldPath, raw.trim()]);
  }
  if (!updates.length) throw new Error("no editable website fields in payload");
  let src = readFileSync(SITE_TS, "utf8");
  for (const [fieldPath, value] of updates) src = setSiteField(src, fieldPath, value);
  writeFileSync(SITE_TS, src, "utf8");
  return { ok: true, updated: updates.map(([p]) => p.join(".")) };
}

/**
 * dev-server middleware — POST <base>__admin/site-config
 *
 * নিরাপত্তা (এটি source code-এ লেখে, তাই কঠোরভাবে সীমিত):
 *   • শুধু `vite dev` (`apply: "serve"`, command === "serve")-এ চালু —
 *     `vite build`/`vite preview`-এ endpoint-ই থাকে না,
 *   • same-origin কড়া যাচাই (Origin/Host header অবশ্যই মিলতে হবে) → অন্য সাইট
 *     বা অন্য ডিভাইস থেকে POST করে source বদলানো যায় না,
 *   • JSON body 64 KB-এ সীমিত, শুধু অনুমোদিত field-ই লেখা হয়।
 * Production deploy-এ এই endpoint কোনোভাবেই বিদ্যমান নেই।
 */
function cbdcSiteConfig(): Plugin {
  const send = (res: any, status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(JSON.stringify(payload));
  };
  return {
    name: "cbdc-site-config",
    apply: "serve",
    configureServer(server) {
      if (server.config.command !== "serve") return; // build/preview — কিছুই রেজিস্টার হয় না
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.endsWith("__admin/site-config")) return next();
        /* same-origin যাচাই — cross-site POST থেকে source-লেখা বন্ধ */
        const host = String(req.headers.host || "").split(":")[0];
        const origin = String(req.headers.origin || req.headers.referer || "");
        let originHost = "";
        try {
          originHost = origin ? new URL(origin).host.split(":")[0] : "";
        } catch {
          originHost = "";
        }
        if (originHost && host && originHost !== host) {
          send(res, 403, { ok: false, error: "cross-origin request rejected" });
          return;
        }
        if (req.method !== "POST") {
          send(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body = "";
        let oversized = false;
        req.on("data", (chunk: Buffer) => {
          body += chunk;
          if (body.length > 64 * 1024) oversized = true;
        });
        req.on("end", () => {
          try {
            if (oversized) throw new Error("payload too large");
            const result = writeSiteConfig(JSON.parse(body || "{}"));
            server.config.logger.info(`[site-config] src/config/site.ts updated: ${result.updated.join(", ")}`);
            send(res, 200, result);
          } catch (e) {
            send(res, 400, { ok: false, error: (e as Error)?.message || "bad request" });
          }
        });
      });
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Admin Panel → secure server-side delete (dev-only middleware)
   ═══════════════════════════════════════════════════════════════════════════

   The same logic that runs in production on the Cloudflare Worker
   (server/index.ts) is mounted here for `vite dev` — so the delete flow works
   identically in development (Real Firebase: Identity Toolkit + RTDB REST,
   no private keys). It is explicitly dev-only (`apply: "serve"`):
   `vite build`/`vite preview` never register this endpoint — production uses
   the Worker (`wrangler.jsonc` → `main`).

   Safety mirror of the site-config middleware:
   • same-origin only (Origin/Host must match),
   • JSON body limited to 64 KB, POST only,
   • client's Firebase ID token in `Authorization: Bearer` is verified
     (Identity Toolkit) + admin role checked before any delete. */
function cbdcDeleteApi(): Plugin {
  const send = (res: any, status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(JSON.stringify(payload));
  };
  return {
    name: "cbdc-delete-api",
    apply: "serve",
    configureServer(server) {
      if (server.config.command !== "serve") return;
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.replace(/\/+$/, "").endsWith("/api/admin/delete")) return next();
        /* same-origin যাচাই — cross-site থেকে token-সহ delete বন্ধ */
        const host = String(req.headers.host || "").split(":")[0];
        const origin = String(req.headers.origin || req.headers.referer || "");
        let originHost = "";
        try {
          originHost = origin ? new URL(origin).host.split(":")[0] : "";
        } catch {
          originHost = "";
        }
        if (originHost && host && originHost !== host) {
          send(res, 403, { ok: false, error: "cross-origin request rejected" });
          return;
        }
        if (req.method !== "POST") {
          send(res, 405, { ok: false, error: "POST only" });
          return;
        }
        const idToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
        if (!idToken) {
          send(res, 401, { ok: false, error: "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।" });
          return;
        }
        let body = "";
        let oversized = false;
        req.on("data", (chunk: Buffer) => {
          body += chunk;
          if (body.length > 64 * 1024) oversized = true;
        });
        req.on("end", () => {
          void (async () => {
            try {
              if (oversized) throw new Error("payload too large");
              const payload = JSON.parse(body || "{}");
              /* 🔐 Firebase Authentication (লগইন) অ্যাকাউন্ট ডিলিটের server-side
                 secret — শুধু dev-এ process.env/.env থেকে; client bundle-এ কখনো যায় না। */
              const result = await handleAdminEntityDelete(
                { ...payload, idToken },
                makeHttpIo(
                  {
                    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || "",
                    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
                  },
                  idToken,
                ),
              );
              send(res, 200, result);
            } catch (e) {
              const status = Number((e as any)?.status) || 500;
              send(res, status, { ok: false, error: (e as Error)?.message || "সার্ভার সমস্যা" });
            }
          })();
        });
      });
    },
  };
}

// https://vitejs.dev/config/
//
// `base: "/"` — absolute asset paths are required for SPA deep links.
// Cloudflare/Firebase rewrites `/doner/req`, `/admin/...` etc. to `index.html`;
// if assets are emitted as `./assets/...`, a browser refresh from `/doner/req`
// tries to load `/doner/req/assets/...` and the app never boots. Root-relative
// assets always load from `/assets/...` on the deployed root domain.
//
// Single-page build — শুধুমাত্র index.html। সব পেজ (Home / Doner / Admin /
// Moderator) .tsx কম্পোনেন্ট হিসেবে একই entry থেকে বুট হয়
// (src/main.tsx + src/lib/router.ts)। প্যানেলগুলো lazy-loaded chunk হিসেবে আসে।
/* `base` — host-independent:
   • ডিফল্ট "/" (root deploy — Firebase Hosting, Cloudflare Pages, Netlify, Vite
     preview … সব জায়গায় একই)। SPA deep-link-এর জন্য root-relative asset path
     বাধ্যতামূলক, তাই এটাই নিরাপদ ডিফল্ট।
   • কোনো host-এ sub-directory-তে serve করতে হলে শুধু env দিন:
     VITE_BASE=/cbdc/ — কোডে কোনো host-নির্দিষ্ট hardcoded path নেই। */
const BASE = process.env.VITE_BASE || "/";

export default defineConfig({
  plugins: [react(), cbdcSiteConfig(), cbdcDeleteApi()],
  base: BASE,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // Preview environment proxies traffic under a generated e2b host.
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});
