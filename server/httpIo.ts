/**
 * CBDC — server deletion endpoint-এর HTTP I/O (Cloudflare Worker + Vite dev)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/deleteApi.ts`-এর `DeleteIo`-এর বাস্তব বাস্তবায়ন:
 *
 *   • **Firebase Identity Toolkit** (`accounts:lookup`) — client-এর ID token
 *     যাচাই। শুধু public web API key লাগে (client bundle-এ থাকা একই মান) —
 *     কোনো private key/service-account নেই।
 *   • **Realtime Database REST** — প্রতিটি read/write client-এর ID token দিয়ে
 *     (`?auth=<idToken>`), তাই **RTDB Security Rules-ই** দ্বিতীয় স্তরের সুরক্ষা:
 *     শুধু অ্যাডমিনদের নোড/লেখার অনুমতি আছে। deleteApi-র ভূমিকা যাচাইয়ের পরে
 *     production-এ এটাই চূড়ান্ত gate।
 *
 * কোনো Firebase Admin SDK / service-account JSON / private key এই রিপো-র
 * কোথাও নেই — এটাই এই ডিজাইনের মূল নিরাপত্তা প্রতিশ্রুতি।
 */

import { ApiError, type DeleteIo } from "./deleteApi";

const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

/** public web API key — ডিফল্ট client config-এর মতোই (src/lib/firebase.ts)। */
const DEFAULT_FIREBASE_API_KEY = "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM";
const DEFAULT_FIREBASE_DATABASE_URL =
  "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com";

type HttpEnv = {
  FIREBASE_API_KEY?: string;
  FIREBASE_DATABASE_URL?: string;
};

async function verifyIdentityLookup(
  idToken: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{ uid: string } | null> {
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
  return uid ? { uid } : null;
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
  paths: Record<string, null>,
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
    apply: (paths: Record<string, null>) => restApply(base, idToken, paths, fetchImpl),
  };
}
