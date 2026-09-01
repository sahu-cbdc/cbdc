import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAdminEntityDelete, handleAdminConfigCheck, ApiError } from "./server/deleteApi";
import { toUserSafeMessage } from "./server/index";
import { handleAdminDedupe } from "./server/dedupeApi";
import { handleDonorApply } from "./server/applyApi";
import { handleResolveLegacy } from "./server/resolveLegacy";
import { handleImageUpload } from "./server/imagesApi";
import {
  makeApplyIo,
  makeHttpIo,
  makeImagesIo,
  makePrivilegedIo,
  makeDataIo,
  makePublicIo,
  makeDonorIdIo,
} from "./server/httpIo";
import { serviceAccountConfigured } from "./server/authAdmin";
import { handleDataWrite } from "./server/dataApi";
import { handleProfileUpsert, handleClaimEmail, handleClaimLogin } from "./server/profileApi";
import { handleDonorIdAction } from "./server/donorIdApi";
import { handlePublicSubmit } from "./server/publicApi";



const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE_TS = path.resolve(PROJECT_ROOT, "src/config/site.ts");


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


const toLiteral = (v: string | boolean): string =>
  typeof v === "boolean" ? String(v) : JSON.stringify(v);


const LIT = `(?:"[^"\\\\]*(?:\\\\.[^"\\\\])*"|true|false)`;


function setSiteField(src: string, fieldPath: string[], value: string | boolean): string {
  const [outer, inner] = fieldPath;
  if (!inner) {
    const re = new RegExp(`(^\\s*${outer}:\\s*)${LIT}`, "m");
    if (!re.test(src)) throw new Error(`field not found: ${outer}`);
    return src.replace(re, (_m, g1: string) => g1 + toLiteral(value));
  }
  
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
    if (!fieldPath) continue; 
    if (typeof raw === "boolean") updates.push([fieldPath, raw]);
    else if (typeof raw === "string" && raw.length <= 2000) updates.push([fieldPath, raw.trim()]);
  }
  if (!updates.length) throw new Error("no editable website fields in payload");
  let src = readFileSync(SITE_TS, "utf8");
  for (const [fieldPath, value] of updates) src = setSiteField(src, fieldPath, value);
  writeFileSync(SITE_TS, src, "utf8");
  return { ok: true, updated: updates.map(([p]) => p.join(".")) };
}


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
      if (server.config.command !== "serve") return; 
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.endsWith("__admin/site-config")) return next();
        
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


function cbdcDeleteApi(devEnv: Record<string, string>): Plugin {
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
        const apiPath = url.replace(/\/+$/, "");
        const isAuthApi = apiPath.endsWith("/api/auth");
        const isDataApi = apiPath.endsWith("/api/data");
        const isAdminApi = apiPath.endsWith("/api/admin");
        const isMediaApi = apiPath.endsWith("/api/media");
        const gateway = isAuthApi ? "auth" : isDataApi ? "data" : isAdminApi ? "admin" : isMediaApi ? "media" : null;
        if (!gateway) {
          if (/^\/api\//i.test(apiPath)) {
            send(res, 404, { ok: false, error: "অনুরোধকৃত API রুটটি খুঁজে পাওয়া যায়নি।" });
            return;
          }
          return next();
        }
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
        if (!idToken && gateway !== "data") {
          send(res, 401, { ok: false, error: "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।" });
          return;
        }
        
        const chunks: Buffer[] = [];
        let bodySize = 0;
        let oversized = false;
        req.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          bodySize += chunk.length;
          const limit = gateway === "media" ? 8 * 1024 * 1024 : 64 * 1024;
          if (bodySize > limit) oversized = true;
        });
        req.on("end", () => {
          void (async () => {
            try {
              if (oversized) throw new Error(gateway === "media" ? "ছবির আকার ৮ MB-র বেশি — ছোট ছবি দিন।" : "payload too large");
              const raw = Buffer.concat(chunks);
              const payload = gateway === "media" ? {} : (JSON.parse(raw.toString("utf8") || "{}") as Record<string, unknown>);
              
              const serverEnv = {
                FIREBASE_SERVICE_ACCOUNT: devEnv.FIREBASE_SERVICE_ACCOUNT || "",
                FIREBASE_PROJECT_ID: devEnv.FIREBASE_PROJECT_ID || "",
                
                IMGBB_API_KEY: devEnv.IMGBB_API_KEY || "",
              };
              let result: unknown;
              const op = String(payload.op ?? "").trim();
              if (gateway === "auth") {
                if (op === "profile") result = await handleProfileUpsert({ ...payload, idToken }, makeDataIo(serverEnv));
                else if (op === "claim-email") result = await handleClaimEmail({ ...payload, idToken }, makeDataIo(serverEnv));
                else if (op === "claim-login") result = await handleClaimLogin({ ...payload, idToken }, makeDataIo(serverEnv));
                else if (op === "resolve-legacy") result = await handleResolveLegacy({ idToken }, makePrivilegedIo(serverEnv, ""));
                else throw new ApiError(400, "অনুরোধকৃত কাজটি খুঁজে পাওয়া যায়নি।");
              } else if (gateway === "data") {
                if (op === "write") result = await handleDataWrite({ ...payload, idToken }, makeDataIo(serverEnv));
                else if (op === "apply") result = await handleDonorApply({ ...payload, idToken }, makeApplyIo(serverEnv, idToken));
                else if (op === "public-submit") result = await handlePublicSubmit(payload, makePublicIo(serverEnv), idToken);
                else throw new ApiError(400, "অনুরোধকৃত কাজটি খুঁজে পাওয়া যায়নি।");
              } else if (gateway === "media") {
                result = await handleImageUpload(
                  { idToken },
                  new Uint8Array(raw),
                  String(req.headers["content-type"] || "image/jpeg"),
                  String(req.headers["x-filename"] || "image.jpg"),
                  makeImagesIo(serverEnv),
                );
              } else {
                if (op === "delete") result = await handleAdminEntityDelete({ ...payload, idToken }, makeHttpIo(serverEnv));
                else if (op === "dedupe") result = await handleAdminDedupe({ apply: payload.apply === true, idToken }, makeHttpIo(serverEnv));
                else if (op === "config-check") {
                  result = await handleAdminConfigCheck(
                    { idToken },
                    makeHttpIo(serverEnv),
                    {
                      serviceAccountConfigured: serviceAccountConfigured(serverEnv),
                      imgbbConfigured: await makeImagesIo(serverEnv).hasKey(),
                    },
                  );
                } else if (op === "donor-id") result = await handleDonorIdAction({ ...payload, idToken }, makeDonorIdIo(serverEnv));
                else throw new ApiError(400, "অনুরোধকৃত কাজটি খুঁজে পাওয়া যায়নি।");
              }
              send(res, 200, result);
            } catch (e) {
              const status = e instanceof ApiError ? e.status : 500;
              send(res, status, { ok: false, error: toUserSafeMessage(e) });
            }
          })();
        });
      });
    },
  };
}













const BASE = process.env.VITE_BASE || "/";

const devServerEnv: Record<string, string> = {
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || "",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
  IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",
};

export default defineConfig({
  plugins: [react(), cbdcSiteConfig(), cbdcDeleteApi(devServerEnv)],
  base: BASE,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});
