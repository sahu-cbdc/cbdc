/**
 * CBDC — Firebase Authentication অ্যাকাউন্ট ডিলিট (শুধু সার্ভার-সাইড)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Admin panel-এর ডিলিটে সংশ্লিষ্ট **লগইন অ্যাকাউন্ট** (Firebase Authentication)
 *  মুছতে হলে Google-এর admin-only Identity Toolkit API ব্যবহার করতে হয়। তা করতে
 *  একটি **service account** প্রয়োজন — যা **শুধুই সার্ভারের secret** হিসেবে থাকে:
 *
 *    • Cloudflare Worker → `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT`
 *      (পুরো service-account JSON, অথবা সেটির base64 রূপ)
 *    • `vite dev` → `.env` ফাইলে `FIREBASE_SERVICE_ACCOUNT=...`
 *
 *  **ক্লায়েন্ট bundle-এ এই কী-এর কোনো অস্তিত্ব নেই** — এই মডিউল কেবল
 *  `server/index.ts` (Worker) ও `vite.config.ts` (dev middleware) থেকে ডাকা হয়।
 *
 *  কোনো Node-only SDK ছাড়াই কাজ করে (Cloudflare Worker-সামঞ্জস্যী):
 *    ১. service account-এর private_key দিয়ে RS256 JWT (WebCrypto `crypto.subtle`)
 *    ২. JWT-bearer grant → Google OAuth2 access token
 *    ৩. `POST identitytoolkit.googleapis.com/admin/v2/projects/{pid}/accounts:delete`
 *       body: `{"localId": "<uid>"}` — ঠিক এই একটি uid-ই মোছে।
 *
 *  ফলাফল তিনটি: "deleted" | "missing" (আগেই নেই) | "failed" — এবং secret
 *  কনফিগার না থাকলে "unconfigured"। কোনো অবস্থাতেই অন্য uid স্পর্শ করা হয় না।
 */

export type AuthDeleteOutcome = "deleted" | "missing" | "failed" | "unconfigured";

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_SCOPE =
  "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform";

/** env থেকে service account পড়া — raw JSON অথবা base64; না পেলে null। */
export function parseServiceAccount(raw: unknown): ServiceAccount | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    let json = value;
    if (!json.startsWith("{")) {
      /* base64 (Worker secret-এ multiline PEM সুবিধাজনক নয় — তাই base64ও গ্রহণযোগ্য) */
      const binary = atob(json.replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const client_email = String(parsed.client_email ?? "").trim();
    const private_key = String(parsed.private_key ?? "").trim();
    if (!client_email || !private_key) return null;
    return {
      client_email,
      private_key: private_key.replace(/\\n/g, "\n"),
      project_id: String(parsed.project_id ?? "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

/** secret কনফিগার করা আছে কি না (ব্যর্থ ডিলিটের আগেই স্পষ্ট বার্তার জন্য)। */
export function serviceAccountConfigured(env: Record<string, unknown>): boolean {
  return !!parseServiceAccount(env && env.FIREBASE_SERVICE_ACCOUNT);
}

/* ── base64url helpers ─────────────────────────────────────────────── */

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8Json(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/** PEM (PKCS#8 "BEGIN PRIVATE KEY") → DER bytes — WebCrypto importKey-এর জন্য। */
function pkcs8FromPem(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ── access token (প্রতি service account-এ ১ ঘণ্টা ক্যাশ) ──────────── */
/* ── access token (প্রতি service account-এ ১ ঘণ্টা ক্যাশ) ──────────── */

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

export async function fetchGoogleAccessToken(
  sa: ServiceAccount,
  fetchImpl: typeof fetch,
): Promise<string> {
  return fetchAccessToken(sa, fetchImpl);
}

/** একবার OAuth access token আনুন (কোনো retry ছাড়া) — JWT-bearer grant। */
async function fetchAccessTokenOnce(
  sa: ServiceAccount,
  fetchImpl: typeof fetch,
): Promise<string> {
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = bytesToB64url(utf8Json({ alg: "RS256", typ: "JWT" }));
  const claims = bytesToB64url(
    utf8Json({
      iss: sa.client_email,
      scope: OAUTH_SCOPE,
      aud: OAUTH_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8FromPem(sa.private_key) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput) as unknown as ArrayBuffer,
  );
  const assertion = `${signingInput}.${bytesToB64url(new Uint8Array(signature))}`;

  const res = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google OAuth2 token পাওয়া যায়নি (HTTP ${res.status}) ${text.slice(0, 160)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  const token = String(data?.access_token ?? "");
  if (!token) throw new Error("Google OAuth2 token খালি");
  tokenCache.set(sa.client_email, {
    token,
    expiresAt: Date.now() + (Number(data?.expires_in) || 3600) * 1000,
  });
  return token;
}

/** transient (নেটওয়ার্ক/৫xx) ব্যর্থতায় একবার রিট্রাই — OAuth token অনুরোধ। */
async function fetchAccessToken(
  sa: ServiceAccount,
  fetchImpl: typeof fetch,
): Promise<string> {
  try {
    return await fetchAccessTokenOnce(sa, fetchImpl);
  } catch (first) {
    const cached = tokenCache.get(sa.client_email);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    /* শুধু OAuth token-সংক্রান্ত (নেটওয়ার্ক/৫xx) ব্যর্থতায়ই retry —
       signing/validation error হলে ব্যর্থতাই থেকে যায়। */
    const isTransient = String((first as Error)?.message || "").includes("OAuth2 token");
    if (!isTransient) throw first;
    return fetchAccessTokenOnce(sa, fetchImpl);
  }
}

/** Identity Toolkit delete-এর HTTP status/body → auth ফলাফল। */
export function authDeleteStatus(status: number, bodyText: string): "deleted" | "missing" | "failed" {
  if (status === 200) return "deleted";
  /* আগেই মুছে ফেলা/নেই — এটি ব্যর্থতা নয়। Identity Toolkit-এর বিভিন্ন
     NOT_FOUND কোড সামলানো হয় (HTTP 404 / 400-বডিতে কোড)। */
  if (
    status === 404 ||
    /USER_NOT_FOUND|EMAIL_NOT_FOUND|PHONE_NUMBER_NOT_FOUND|NOT_FOUND/i.test(bodyText || "")
  ) {
    return "missing";
  }
  return "failed";
}

/**
 * ঠিক একটি Firebase Authentication অ্যাকাউন্ট মুছে ফেলা (admin Identity Toolkit)।
 * রিটার্ন: "deleted" | "missing" (আগেই নেই) | "failed" | "unconfigured"।
 */
export async function deleteAuthUserWithServiceAccount(
  sa: ServiceAccount,
  projectId: string,
  uid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Exclude<AuthDeleteOutcome, "unconfigured">> {
  try {
    const token = await fetchAccessToken(sa, fetchImpl);
    const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(
      projectId,
    )}/accounts:delete`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ localId: uid }),
    });
    const text = await res.text().catch(() => "");
    const outcome = authDeleteStatus(res.status, text);
    if (outcome === "failed") {
      console.warn(`[auth-delete] uid=${uid} HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return outcome;
  } catch (e) {
    console.warn("[auth-delete]", (e as Error)?.message);
    return "failed";
  }
}

/**
 * env থেকে একটি `deleteAuthUser(uid)` ফাংশন তৈরি — `DeleteIo`-র জন্য।
 * secret না থাকলে সবসময় "unconfigured" ফেরত দেয় — deleteApi অ্যাটমিক
 * নিয়মে (লগইন ছাড়া কোনো partial delete নয়) কিছুই মোছা হয় না।
 */
export function createAuthDeleter(
  env: Record<string, unknown>,
  defaultProjectId: string,
  fetchImpl: typeof fetch = fetch,
): (uid: string) => Promise<AuthDeleteOutcome> {
  const sa = parseServiceAccount(env && env.FIREBASE_SERVICE_ACCOUNT);
  const projectId = String(env && env.FIREBASE_PROJECT_ID ? env.FIREBASE_PROJECT_ID : "").trim() ||
    (sa && sa.project_id) ||
    defaultProjectId;
  if (!sa) return async () => "unconfigured";
  return (uid: string) => deleteAuthUserWithServiceAccount(sa, projectId, uid, fetchImpl);
}
