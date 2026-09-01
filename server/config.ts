/**
 * Central server configuration — the single place service values come from.
 *
 *   • PUBLIC values (Firebase web API key, database URL, project id) ship as
 *     Cloudflare `vars` (see wrangler.jsonc) and fall back to the checked-in
 *     defaults below. The web API key is public by design.
 *   • SECRETS (FIREBASE_SERVICE_ACCOUNT, IMGBB_API_KEY) are read from the
 *     environment ONLY — they are never bundled, never returned by an API,
 *     and never appear in this file.
 */
import { parseAllowedOrigins } from "./cors.ts";

export const PUBLIC_DEFAULTS = {
  firebaseWebApiKey: "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM",
  firebaseDatabaseUrl: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  firebaseProjectId: "chokbazarbloodclub-69d5f",
} as const;

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
    firebaseWebApiKey: str(e.FIREBASE_API_KEY) || PUBLIC_DEFAULTS.firebaseWebApiKey,
    firebaseDatabaseUrl: str(e.FIREBASE_DATABASE_URL) || PUBLIC_DEFAULTS.firebaseDatabaseUrl,
    firebaseProjectId: str(e.FIREBASE_PROJECT_ID) || PUBLIC_DEFAULTS.firebaseProjectId,
    serviceAccount: e.FIREBASE_SERVICE_ACCOUNT,
    imgbbApiKey: str(e.IMGBB_API_KEY),
    allowedOrigins: parseAllowedOrigins(typeof e.ALLOWED_ORIGINS === "string" ? e.ALLOWED_ORIGINS : undefined),
    abuseGuardMax: num(e.ABUSE_GUARD_MAX, 600),
    abuseGuardWindowMs: num(e.ABUSE_GUARD_WINDOW_MS, 60_000),
    publicSubmitGuardMax: num(e.PUBLIC_SUBMIT_GUARD_MAX, 60),
    maxJsonBytes: 262_144,
  };
}
