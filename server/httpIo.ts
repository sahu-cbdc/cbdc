/**
 * CBDC — server deletion/merge endpoint-এর HTTP I/O (Cloudflare Worker + Vite dev)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/deleteApi.ts` / `server/dedupeApi.ts` / `server/resolveLegacy.ts`-এর
 * I/O বাস্তবায়ন:
 *
 *   • **Firebase Identity Toolkit** (`accounts:lookup`) — client-এর ID token
 *     যাচাই। শুধু public web API key লাগে (client bundle-এ থাকা একই মান)।
 *   • **Realtime Database REST** — admin-স্কোপের কাজে (delete/dedupe) caller-এর
 *     **অ্যাডমিন ID token** (`?auth=<idToken>`) — তাই RTDB Security Rules-ই
 *     চূড়ান্ত gate।
 *   • **Privileged RTDB REST** (legacy-merge) — সাধারণ ব্যবহারকারীর নিজের ইমেইলের
 *     পুরোনো রেকর্ড মেলাতে সার্ভারের service-account access token
 *     (`?access_token=`) লাগে — সেটি **শুধুই সার্ভারের secret**, ক্লায়েন্টে কখনো
 *     যায় না। secret না থাকলে স্পষ্ট বার্তায় ব্যর্থ হয় (কিছুই ভাঙে না)।
 *
 * কোনো Firebase Admin SDK / service-account JSON এই repo-তে commit হয় না —
 * Worker secret (`wrangler secret put`) বা dev `.env`-এ থাকে।
 */

import { ApiError, type DeleteIo } from "./deleteApi.ts";
import type { ResolveLegacyIo } from "./resolveLegacy.ts";
import type { ApplyIo } from "./applyApi.ts";
import { createAuthDeleter, parseServiceAccount, fetchGoogleAccessToken, type ServiceAccount } from "./authAdmin.ts";

const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

/** public web API key — ডিফল্ট client config-এর মতোই (src/lib/firebase.ts)। */
const DEFAULT_FIREBASE_API_KEY = "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM";
const DEFAULT_FIREBASE_DATABASE_URL =
  "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com";
/** public project id — client config-এর মতোই; service account-এর project_id থাকলে এটি override হয়। */
const DEFAULT_FIREBASE_PROJECT_ID = "chokbazarbloodclub-69d5f";

type HttpEnv = {
  FIREBASE_API_KEY?: string;
  FIREBASE_DATABASE_URL?: string;
  /** 🔐 শুধুই সার্ভারের secret — service-account JSON (অথবা base64)।
      Worker: `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT`;
      dev: `.env` → `FIREBASE_SERVICE_ACCOUNT=...`। ক্লায়েন্টে কখনো যায় না। */
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_PROJECT_ID?: string;
};

async function verifyIdentityLookup(
  idToken: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{ uid: string; email: string } | null> {
  const url = `${IDENTITY_TOOLKIT}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as any;
  const user = data?.users?.[0];
  const uid = String(user?.localId ?? user?.uid ?? "").trim();
  return uid ? { uid, email: String(user?.email ?? "").trim() } : null;
}

/** RTDB REST — GET; ৪০৩ হলে অ্যাডমিন নয় (rules) বোঝায়। */
async function restGet(
  base: string,
  token: string,
  path: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const url = `${base}/${path}.json?auth=${encodeURIComponent(token)}`;
  const res = await fetchImpl(url, { method: "GET" }).catch(() => null);
  if (!res) throw new ApiError(502, "Realtime Database-এ সংযোগ করা যায়নি।");
  if (res.status === 401 || res.status === 403) {
    throw new ApiError(403, "Realtime Database rules অনুযায়ী অনুমতি নেই (শুধু অ্যাডমিন)।");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(502, `Realtime Database read ব্যর্থ (${res.status}) ${text.slice(0, 200)}`);
  }
  return await res.json().catch(() => null);
}

/** RTDB REST — PATCH (multi-path, atomic) → ব্যর্থ হলে প্রতিটি path আলাদা DELETE। */
async function restApply(
  base: string,
  token: string,
  paths: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const list = Object.keys(paths);
  if (!list.length) return true;
  const auth = `?auth=${encodeURIComponent(token)}`;
  try {
    const res = await fetchImpl(`${base}/.json${auth}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paths),
    }).catch(() => null);
    if (res && res.ok) return true;
    if (res && (res.status === 401 || res.status === 403)) {
      throw new ApiError(403, "Realtime Database rules অনুযায়ী মুছতে অনুমতি নেই (শুধু অ্যাডমিন)।");
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    /* network/সার্ভার সমস্যা → একে একে চেষ্টা */
  }
  let allOk = true;
  for (const path of list) {
    const res = await fetchImpl(`${base}/${path}.json${auth}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) allOk = false;
  }
  return allOk;
}

/**
 * Worker/dev-middleware-এ ব্যবহৃত `DeleteIo` — বর্তমান client token বেঁধে দেয়।
 */
export function makeHttpIo(env: HttpEnv, idToken: string, fetchImpl: typeof fetch = fetch): DeleteIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const base = String(env.FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_DATABASE_URL)
    .trim()
    .replace(/\/+$/, "");
  return {
    verifyToken: (token: string) => verifyIdentityLookup(token, apiKey, fetchImpl),
    get: (path: string) => restGet(base, idToken, path, fetchImpl),
    list: (node: string) => restGet(base, idToken, node, fetchImpl),
    apply: (paths: Record<string, unknown>) => restApply(base, idToken, paths, fetchImpl),
    /* 🔐 লগইন (Firebase Authentication) অ্যাকাউন্ট মোছা — শুধু server-side secret;
       secret না থাকলে "unconfigured" (RTDB ডিলিট তখনও নিরাপদে চলে, warning সহ)। */
    deleteAuthUser: createAuthDeleter(env as Record<string, unknown>, DEFAULT_FIREBASE_PROJECT_ID, fetchImpl),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Privileged I/O (legacy-merge) — service-account access token, শুধু সার্ভারে
   ═══════════════════════════════════════════════════════════════════════════ */

function privUrl(base: string, path: string, sa: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  return fetchGoogleAccessToken(sa, fetchImpl).then(
    (token) => `${base}/${path}.json?access_token=${encodeURIComponent(token)}`,
  );
}

/**
 * `ResolveLegacyIo` — caller যাচাই public API key দিয়ে, ডেটা অ্যাক্সেস
 * service-account token দিয়ে। secret না থাকলে প্রতিটি অপারেশন স্পষ্ট বার্তায়
 * ব্যর্থ হয় (ক্লায়েন্ট তখন duplicate না বানিয়ে অ্যাডমিন dedupe-এর নির্দেশনা দেখায়)।
 */
export function makePrivilegedIo(env: HttpEnv, apiKey?: string, fetchImpl: typeof fetch = fetch) {
  /* public web API key (client bundle-এ থাকা একই মান) — শুধু caller-যাচাইয়ে;
     ডেটা অ্যাক্সেসে ব্যবহৃত হয় service-account token (আলাদা secret)। */
  const webKey = String(apiKey || env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const base = String(env.FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_DATABASE_URL)
    .trim()
    .replace(/\/+$/, "");
  const sa = parseServiceAccount((env as Record<string, unknown>).FIREBASE_SERVICE_ACCOUNT);

  const io: ResolveLegacyIo & { configured: boolean } = {
    configured: !!sa,
    verifyCaller: (token) => verifyIdentityLookup(token, webKey, fetchImpl),
    get: async (path) => {
      if (!sa) throw new ApiError(503, UNCONFIGURED_MSG);
      const url = await privUrl(base, path, sa, fetchImpl);
      const res = await fetchImpl(url, { method: "GET" }).catch(() => null);
      if (!res) throw new ApiError(502, "Realtime Database-এ সংযোগ করা যায়নি।");
      if (!res.ok) throw new ApiError(502, `Realtime Database read ব্যর্থ (${res.status})`);
      return await res.json().catch(() => null);
    },
    list: (node) => io.get(node),
    apply: async (paths) => {
      if (!sa) return false;
      const list = Object.keys(paths);
      if (!list.length) return true;
      try {
        const url = await privUrl(base, "", sa, fetchImpl);
        const res = await fetchImpl(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paths),
        }).catch(() => null);
        return !!(res && res.ok);
      } catch {
        return false;
      }
    },
  };
  return io;
}

const UNCONFIGURED_MSG =
  "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই — " +
  "পুরোনো রেকর্ড স্বয়ংক্রিয়ভাবে মেলানো সম্ভব নয়। অ্যাডমিন প্যানেলের " +
  "'ডুপ্লিকেট যাচাই ও পরিষ্কার' ব্যবহার করুন।";

/* ═══════════════════════════════════════════════════════════════════════════
   Apply I/O (Approval-settings direct processing) — privileged service-account
   ═══════════════════════════════════════════════════════════════════════════
   OFF-সেটিংসের সরাসরি processing-এ সাধারণ (non-staff) ব্যবহারকারীর নিজের
   ডেটাতে admin-level লেখা দরকার (donors, verifiedDonations, bloodGroup …)।
   ব্রাউজার rules-এর কাছে সেগুলো লিখতে পারে না, তাই data access সব service-account
   access token দিয়ে হয় (ক্লায়েন্টে secret কখনো যায় না)। caller যাচাই public
   API key দিয়ে — শুধু নিজেরই process হতে পারে (নীচে applyApi.ts-এ uid বেঁধে)। */
export function makeApplyIo(env: HttpEnv, idToken: string, fetchImpl: typeof fetch = fetch): ApplyIo {
  const priv = makePrivilegedIo(env, undefined, fetchImpl) as ResolveLegacyIo & { configured: boolean };
  return {
    verifyToken: (token: string) => priv.verifyCaller(token),
    getRow: async (node, id) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      const v = (await priv.get(`${node}/${id}`)) as any;
      if (!v || typeof v !== "object") return null;
      return { ...v, id };
    },
    listOnce: async (node) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      const v = (await priv.list(node)) as Record<string, any> | null;
      if (!v || typeof v !== "object") return [];
      return Object.entries(v).map(([id, row]) =>
        row && typeof row === "object" ? { ...row, id } : { id, value: row },
      );
    },
    updatePaths: async (paths) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      const ok = await priv.apply(paths);
      if (!ok) throw new ApiError(502, "Realtime Database-এ সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।");
    },
  };
}
