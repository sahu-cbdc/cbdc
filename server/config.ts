/**
 * Central server configuration — how service values reach the server.
 *
 *   • PUBLIC values (Firebase web API key, database URL, project id) come
 *     from the single shared source src/config/firebase.ts — the same file
 *     the browser SDK uses. They are not duplicated here or in wrangler vars.
 *   • SECRETS (FIREBASE_SERVICE_ACCOUNT, IMGBB_API_KEY) and deployment
 *     tunables (ALLOWED_ORIGINS, guard limits) are read from the server
 *     environment ONLY — Cloudflare Worker secrets in production, process
 *     environment for local dev. They are never bundled, never returned by
 *     an API, and never appear in any checked-in file.
 */
import { parseAllowedOrigins } from "./cors.ts";
import { FIREBASE_PUBLIC_CONFIG } from "../src/config/firebase.ts";
import { IMGBB_SERVER } from "../src/config/imgbb.ts";

export const UNCONFIGURED_MSG =
  "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই — " +
  "পুরোনো রেকর্ড স্বয়ংক্রিয়ভাবে মেলানো সম্ভব নয়। অ্যাডমিন প্যানেলের " +
  "'ডুপ্লিকেট যাচাই ও পরিষ্কার' ব্যবহার করুন।";

export type ServerConfig = {
  firebaseWebApiKey: string;
  firebaseDatabaseUrl: string;
  firebaseProjectId: string;
  serviceAccount: unknown;
  imgbbApiKey: string;
  allowedOrigins: string[];
  abuseGuardMax: number;
  abuseGuardWindowMs: number;
  publicSubmitGuardMax: number;
  maxJsonBytes: number;
};

export function serverConfig(env: unknown): ServerConfig {
  const e = (env || {}) as Record<string, any>;
  const str = (v: unknown) => String(v ?? "").trim();
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    firebaseWebApiKey: FIREBASE_PUBLIC_CONFIG.apiKey,
    firebaseDatabaseUrl: FIREBASE_PUBLIC_CONFIG.databaseURL,
    firebaseProjectId: FIREBASE_PUBLIC_CONFIG.projectId,
    serviceAccount: e.FIREBASE_SERVICE_ACCOUNT,
    imgbbApiKey: str(e.IMGBB_API_KEY) || IMGBB_SERVER.apiKey,
    allowedOrigins: parseAllowedOrigins(typeof e.ALLOWED_ORIGINS === "string" ? e.ALLOWED_ORIGINS : undefined),
    abuseGuardMax: num(e.ABUSE_GUARD_MAX, 600),
    abuseGuardWindowMs: num(e.ABUSE_GUARD_WINDOW_MS, 60_000),
    publicSubmitGuardMax: num(e.PUBLIC_SUBMIT_GUARD_MAX, 60),
    maxJsonBytes: 262_144,
  };
}
