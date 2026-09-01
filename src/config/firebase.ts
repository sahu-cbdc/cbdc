/**
 * PUBLIC Firebase web configuration — the single place it lives.
 *
 * These values are safe to bundle: the Firebase web API key is public by
 * design (access is governed by Auth-domain rules and database rules, not
 * by key secrecy). To run against a different environment set the
 * `VITE_FIREBASE_*` build variables — if ANY required key is set, ALL
 * required keys must be set; partial config is rejected on purpose so a
 * half-overridden environment can never point the app at mixed projects.
 *
 * Server-only secrets (service account, ImgBB key) never appear here —
 * they live exclusively in Worker secrets (see .env.example).
 */
export const FIREBASE_PUBLIC_CONFIG = {
  apiKey: "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM",
  authDomain: "auth.chawkbazarbloodclub.com",
  databaseURL: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  projectId: "chokbazarbloodclub-69d5f",
  storageBucket: "chokbazarbloodclub-69d5f.firebasestorage.app",
  messagingSenderId: "826987875853",
  appId: "1:826987875853:web:8a9509b80867538393cf44",
  measurementId: "G-KJTMR061LX",
} as const;

export type FirebasePublicConfig = Record<keyof typeof FIREBASE_PUBLIC_CONFIG, string>;

const REQUIRED_ENV_KEYS = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
  ["databaseURL", "VITE_FIREBASE_DATABASE_URL"],
] as const;

const OPTIONAL_ENV_KEYS = [
  ["storageBucket", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["measurementId", "VITE_FIREBASE_MEASUREMENT_ID"],
] as const;

function publicEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  try {
    const meta = (import.meta as any).env || {};
    for (const [, key] of [...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS]) {
      const value = meta[key];
      if (typeof value === "string" && value) env[key] = value;
    }
  } catch {
    return {};
  }
  return env;
}

export function resolveFirebasePublicConfig(): {
  config: FirebasePublicConfig;
  error: Error | null;
} {
  const env = publicEnv();
  const anySet =
    REQUIRED_ENV_KEYS.some(([, k]) => env[k]) || OPTIONAL_ENV_KEYS.some(([, k]) => env[k]);
  if (!anySet) {
    return { config: { ...FIREBASE_PUBLIC_CONFIG }, error: null };
  }
  const missing = REQUIRED_ENV_KEYS.filter(([, k]) => !env[k]).map(([, k]) => k);
  if (missing.length) {
    return {
      config: { ...FIREBASE_PUBLIC_CONFIG },
      error: new Error(
        "Firebase environment config অসম্পূর্ণ: " +
        missing.join(", ") + " সেট করা নেই। হয় সব VITE_FIREBASE_* ভ্যারিয়েবল দিন, নয়তো কোনোটিই দেবেন না " +
        "(তাহলে কোডে যাচাই করা ডিফল্ট config ব্যবহৃত হবে)। আংশিক config নিরাপত্তার জন্য " +
        "ইচ্ছাকৃতভাবে প্রত্যাখ্যান করা হয়েছে।"
      ),
    };
  }
  const merged: Record<string, string> = {};
  for (const [prop, key] of REQUIRED_ENV_KEYS) merged[prop] = String(env[key]);
  for (const [prop, key] of OPTIONAL_ENV_KEYS) {
    if (env[key]) merged[prop] = String(env[key]);
  }
  return { config: merged as FirebasePublicConfig, error: null };
}
