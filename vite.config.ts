import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/** dev-server middleware — POST <base>__admin/site-config */
function cbdcSiteConfig(): Plugin {
  return {
    name: "cbdc-site-config",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.endsWith("__admin/site-config")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "POST only" }));
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
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: (e as Error)?.message || "bad request" }));
          }
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
export default defineConfig({
  plugins: [react(), cbdcSiteConfig()],
  base: "/",
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
