import { defineConfig, loadEnv, type Plugin } from "vite";
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
        const isDeleteApi = apiPath.endsWith("/api/admin/delete");
        const isDedupeApi = apiPath.endsWith("/api/admin/dedupe");
        const isConfigCheckApi = apiPath.endsWith("/api/admin/config-check");
        const isResolveApi = apiPath.endsWith("/api/account/resolve-legacy");
        const isApplyApi = apiPath.endsWith("/api/donor/apply");
        const isUploadApi = apiPath.endsWith("/api/images/upload");
        const isDataWriteApi = apiPath.endsWith("/api/data/write");
        const isProfileApi = apiPath.endsWith("/api/account/profile");
        const isClaimEmailApi = apiPath.endsWith("/api/account/claim-email");
        const isClaimLoginApi = apiPath.endsWith("/api/account/claim-login");
        const isDonorIdApi = apiPath.endsWith("/api/donor/id");
        const isPublicSubmitApi = apiPath.endsWith("/api/public/submit");
        if (
          !isDeleteApi && !isDedupeApi && !isConfigCheckApi && !isResolveApi && !isApplyApi &&
          !isUploadApi && !isDataWriteApi && !isProfileApi && !isClaimEmailApi &&
          !isClaimLoginApi && !isDonorIdApi && !isPublicSubmitApi
        ) return next();
        
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
        if (!idToken && !isPublicSubmitApi) {
          send(res, 401, { ok: false, error: "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।" });
          return;
        }
        
        const chunks: Buffer[] = [];
        let bodySize = 0;
        let oversized = false;
        req.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          bodySize += chunk.length;
          const limit = isUploadApi ? 8 * 1024 * 1024 : 64 * 1024;
          if (bodySize > limit) oversized = true;
        });
        req.on("end", () => {
          void (async () => {
            try {
              if (oversized) throw new Error(isUploadApi ? "ছবির আকার ৮ MB-র বেশি — ছোট ছবি দিন।" : "payload too large");
              const raw = Buffer.concat(chunks);
              const payload = isUploadApi ? {} : (JSON.parse(raw.toString("utf8") || "{}") as Record<string, unknown>);
              
              const serverEnv = {
                FIREBASE_SERVICE_ACCOUNT: devEnv.FIREBASE_SERVICE_ACCOUNT || "",
                FIREBASE_PROJECT_ID: devEnv.FIREBASE_PROJECT_ID || "",
                
                IMGBB_API_KEY: devEnv.IMGBB_API_KEY || "",
              };
              let result: unknown;
              if (isPublicSubmitApi) {
                result = await handlePublicSubmit(payload, makePublicIo(serverEnv), idToken);
              } else if (isDataWriteApi) {
                result = await handleDataWrite({ ...payload, idToken }, makeDataIo(serverEnv));
              } else if (isProfileApi) {
                result = await handleProfileUpsert({ ...payload, idToken }, makeDataIo(serverEnv));
              } else if (isClaimEmailApi) {
                result = await handleClaimEmail({ ...payload, idToken }, makeDataIo(serverEnv));
              } else if (isClaimLoginApi) {
                result = await handleClaimLogin({ ...payload, idToken }, makeDataIo(serverEnv));
              } else if (isDonorIdApi) {
                result = await handleDonorIdAction({ ...payload, idToken }, makeDonorIdIo(serverEnv));
              } else if (isUploadApi) {
                result = await handleImageUpload(
                  { idToken },
                  new Uint8Array(raw),
                  String(req.headers["content-type"] || "image/jpeg"),
                  String(req.headers["x-filename"] || "image.jpg"),
                  makeImagesIo(serverEnv),
                );
              } else if (isConfigCheckApi) {
                
                result = await handleAdminConfigCheck(
                  { idToken },
                  makeHttpIo(serverEnv, idToken),
                  {
                    serviceAccountConfigured: serviceAccountConfigured(serverEnv),
                    imgbbConfigured: await makeImagesIo(serverEnv).hasKey(),
                  },
                );
              } else if (isDedupeApi) {
                result = await handleAdminDedupe(
                  { apply: payload.apply === true, idToken },
                  makeHttpIo(serverEnv, idToken),
                );
              } else if (isResolveApi) {
                result = await handleResolveLegacy(
                  { idToken },
                  makePrivilegedIo(serverEnv, ""),
                );
              } else if (isApplyApi) {
                result = await handleDonorApply(
                  { ...payload, idToken },
                  makeApplyIo(serverEnv, idToken),
                );
              } else {
                result = await handleAdminEntityDelete(
                  { ...payload, idToken },
                  makeHttpIo(serverEnv, idToken),
                );
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

export default defineConfig(({ mode }) => {
  
  const env = loadEnv(mode, process.cwd(), "");
  const devServerEnv: Record<string, string> = {
    FIREBASE_SERVICE_ACCOUNT: env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || "",
    FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
    IMGBB_API_KEY: env.IMGBB_API_KEY || process.env.IMGBB_API_KEY || "",
  };
  return {
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
  };
});
