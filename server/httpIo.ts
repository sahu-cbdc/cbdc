

import { ApiError, type DeleteIo } from "./deleteApi.ts";
import type { ResolveLegacyIo } from "./resolveLegacy.ts";
import type { ApplyIo } from "./applyApi.ts";
import type { ImagesIo } from "./imagesApi.ts";
import { createAuthDeleter, parseServiceAccount, fetchGoogleAccessToken, type ServiceAccount } from "./authAdmin.ts";

const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";


const DEFAULT_FIREBASE_API_KEY = "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM";
const DEFAULT_FIREBASE_DATABASE_URL =
  "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com";

const DEFAULT_FIREBASE_PROJECT_ID = "chokbazarbloodclub-69d5f";

type HttpEnv = {
  FIREBASE_API_KEY?: string;
  FIREBASE_DATABASE_URL?: string;
  
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_PROJECT_ID?: string;
  
  IMGBB_API_KEY?: string;
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


/**
 * IO for admin entity-delete / dedupe / config-check. Authorization runs in
 * the handlers themselves (verified ID token + admins row); database access
 * uses the server's service account — never the caller's token, so locked
 * RTDB rules (".write": false) can never break these admin flows.
 */
export function makeHttpIo(env: HttpEnv, fetchImpl: typeof fetch = fetch): DeleteIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const priv = makePrivilegedIo(env, undefined, fetchImpl) as ResolveLegacyIo & {
    configured: boolean;
    get(path: string): Promise<any>;
    list(node: string): Promise<any>;
    apply(paths: Record<string, unknown>): Promise<boolean>;
  };
  return {
    verifyToken: (token: string) => verifyIdentityLookup(token, apiKey, fetchImpl),
    get: (path: string) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return priv.get(path);
    },
    list: (node: string) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return priv.list(node);
    },
    apply: async (paths) => {
      if (!priv.configured) return false;
      return priv.apply(paths);
    },
    deleteAuthUser: createAuthDeleter(env as Record<string, unknown>, DEFAULT_FIREBASE_PROJECT_ID, fetchImpl),
  };
}



function privUrl(base: string, path: string, sa: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  return fetchGoogleAccessToken(sa, fetchImpl).then(
    (token) => `${base}/${path}.json?access_token=${encodeURIComponent(token)}`,
  );
}


export function makePrivilegedIo(env: HttpEnv, apiKey?: string, fetchImpl: typeof fetch = fetch) {
  
  const webKey = String(apiKey || env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const base = String(env.FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_DATABASE_URL)
    .trim()
    .replace(/\/+$/, "");
  const sa = parseServiceAccount((env as Record<string, unknown>).FIREBASE_SERVICE_ACCOUNT);

  const io: ResolveLegacyIo & { configured: boolean; patch(paths: Record<string, any>): Promise<void> } = {
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
    patch: async (paths) => {
      if (!sa) throw new ApiError(503, UNCONFIGURED_MSG);
      const list = Object.keys(paths);
      if (!list.length) return;
      const url = await privUrl(base, "", sa, fetchImpl);
      const res = await fetchImpl(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paths),
      }).catch(() => null);
      if (!res) throw new ApiError(502, "Realtime Database-এ সংযোগ করা যায়নি।");
      if (!res.ok) {
        throw new ApiError(502, "Realtime Database-এ সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।");
      }
    },
  };
  return io;
}

/**
 * IO for the guarded data-write API: verifies the caller's ID token with the
 * web API key, then reads/writes with the service account (rules-bypassing,
 * server-only). Everything the write guard needs runs through here.
 */
export type DataIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  getAdminRow(uid: string): Promise<any>;
  get(path: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

export type PublicIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  get(path: string): Promise<any>;
  list(node: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

/** Privileged IO for anonymous-capable public submissions. */
export function makePublicIo(env: HttpEnv, fetchImpl: typeof fetch = fetch): PublicIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const priv = makePrivilegedIo(env, undefined, fetchImpl) as ResolveLegacyIo & {
    configured: boolean;
    get(path: string): Promise<any>;
    list(node: string): Promise<any>;
    patch(paths: Record<string, any>): Promise<void>;
  };
  return {
    verifyToken: (token) => verifyIdentityLookup(token, apiKey, fetchImpl),
    get: async (path) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.get(path).catch(() => null);
    },
    list: async (node) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.list(node).catch(() => null);
    },
    patch: (paths) => priv.patch(paths),
  };
}

export type DonorIdIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  getAdminRow(uid: string): Promise<any>;
  get(path: string): Promise<any>;
  list(node: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

/** Privileged IO for staff donor-id allocation. */
export function makeDonorIdIo(env: HttpEnv, fetchImpl: typeof fetch = fetch): DonorIdIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const priv = makePrivilegedIo(env, undefined, fetchImpl) as ResolveLegacyIo & {
    configured: boolean;
    get(path: string): Promise<any>;
    list(node: string): Promise<any>;
    patch(paths: Record<string, any>): Promise<void>;
  };
  return {
    verifyToken: (token) => verifyIdentityLookup(token, apiKey, fetchImpl),
    getAdminRow: async (uid) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.get(`admins/${uid}`).catch(() => null);
    },
    get: async (path) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.get(path).catch(() => null);
    },
    list: async (node) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.list(node).catch(() => null);
    },
    patch: (paths) => priv.patch(paths),
  };
}

export function makeDataIo(env: HttpEnv, fetchImpl: typeof fetch = fetch): DataIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const priv = makePrivilegedIo(env, undefined, fetchImpl) as ResolveLegacyIo & {
    configured: boolean;
    get(path: string): Promise<any>;
    patch(paths: Record<string, any>): Promise<void>;
  };
  return {
    verifyToken: (token) => verifyIdentityLookup(token, apiKey, fetchImpl),
    getAdminRow: async (uid) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.get(`admins/${uid}`).catch(() => null);
    },
    get: async (path) => {
      if (!priv.configured) throw new ApiError(503, UNCONFIGURED_MSG);
      return await priv.get(path).catch(() => null);
    },
    patch: (paths) => priv.patch(paths),
  };
}

const UNCONFIGURED_MSG =
  "সার্ভারে service-account secret (FIREBASE_SERVICE_ACCOUNT) কনফিগার করা নেই — " +
  "পুরোনো রেকর্ড স্বয়ংক্রিয়ভাবে মেলানো সম্ভব নয়। অ্যাডমিন প্যানেলের " +
  "'ডুপ্লিকেট যাচাই ও পরিষ্কার' ব্যবহার করুন।";


export function makeImagesIo(env: HttpEnv, fetchImpl: typeof fetch = fetch): ImagesIo {
  const apiKey = String(env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
  const priv = makePrivilegedIo(env, undefined, fetchImpl);
  const hasKey = async (): Promise<boolean> => {
    if (String((env as Record<string, unknown>).IMGBB_API_KEY ?? "").trim()) return true;
    if (!priv.configured) return false;
    const row = (await priv.get("settings/imgbb").catch(() => null)) as any;
    return !!String(row?.key ?? "").trim();
  };
  return {
    verifyToken: (token: string) => verifyIdentityLookup(token, apiKey, fetchImpl),
    getImgbbKey: async () => {
      const envKey = String((env as Record<string, unknown>).IMGBB_API_KEY ?? "").trim();
      if (envKey) return envKey;
      if (!priv.configured) {
        
        throw new ApiError(503, UNCONFIGURED_MSG);
      }
      const row = (await priv.get("settings/imgbb").catch(() => null)) as any;
      const k = String(row?.key ?? "").trim();
      if (!k) throw new ApiError(503, "সার্ভারে ImgBB API key কনফিগার করা নেই।");
      return k;
    },
    hasKey,
  };
}




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
