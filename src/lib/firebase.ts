/**
 * CBDC — Firebase integration layer
 *
 * Single, shared Firebase instance for the whole app:
 *   - Firebase Authentication (email/password + Google) for login / register /
 *     logout / session,
 *   - Cloud Firestore as the primary data source for all app data.
 *
 * ছবি Firebase Storage-এ সংরক্ষণ করা হয় না — image hosting-এর জন্য ImgBB API
 * ব্যবহার করা হয় (দেখুন src/lib/imgbb.ts)। তাই Storage এখানে initialized হয় না।
 *
 * The page logic uses dynamic `import("firebase/...")`; this module
 * centralises that into one typed singleton so every page shares the same app
 * instance and the same configuration.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase project configuration — project: chokbazarbloodclub-69d5f
 * (project number 826987875853).
 *
 * These values are public client-side identifiers (web API key) — access
 * control is enforced by Firestore Security Rules (see firestore.rules) and by
 * Firebase Auth itself, not by hiding this config. No server credential / service
 * account / admin key may ever be added here.
 */
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM",
  authDomain: "chokbazarbloodclub-69d5f.firebaseapp.com",
  databaseURL: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  projectId: "chokbazarbloodclub-69d5f",
  storageBucket: "chokbazarbloodclub-69d5f.firebasestorage.app",
  messagingSenderId: "826987875853",
  appId: "1:826987875853:web:8a9509b80867538393cf44",
  measurementId: "G-KJTMR061LX",
};

/**
 * ঐচ্ছিক পরিবেশ-ভিত্তিক override। Vite env নিয়ম (`VITE_...`) অনুসরণ করা বাধ্যতামূলক।
 *
 * নিয়ম (বিপদজনক silent fallback রোধ করতে):
 *   - কোনো VITE_FIREBASE_* ভ্যারিয়েবল সেট করা থাকলে **প্রয়োজনীয় সবগুলোই**
 *     থাকতে হবে। আংশিক সেট থাকলে ভুল/পুরোনো config চুপচাপ মিশিয়ে না ফেলে
 *     স্পষ্ট init error দেখানো হয় (initFirebase() তখন ready হয় না এবং
 *     getFirebaseInitError() কারণ ফেরত দেয়)।
 *   - কোনো VITE_FIREBASE_* না থাকলে উপরের DEFAULT config ব্যবহার হয়, যা
 *     Firebase Console এর config-এর সঙ্গে হুবহু মিলিয়ে যাচাই করা।
 */
const REQUIRED_ENV_KEYS = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
] as const;
const OPTIONAL_ENV_KEYS = [
  ["storageBucket", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["databaseURL", "VITE_FIREBASE_DATABASE_URL"],
  ["measurementId", "VITE_FIREBASE_MEASUREMENT_ID"],
] as const;

function resolveFirebaseConfig(): { config: typeof DEFAULT_FIREBASE_CONFIG; error: Error | null } {
  let env: Record<string, string | undefined> = {};
  try {
    env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  } catch {
    env = {};
  }
  const anySet =
    REQUIRED_ENV_KEYS.some(([, k]) => env[k]) || OPTIONAL_ENV_KEYS.some(([, k]) => env[k]);
  if (!anySet) {
    return { config: DEFAULT_FIREBASE_CONFIG, error: null };
  }
  const missing = REQUIRED_ENV_KEYS.filter(([, k]) => !env[k]).map(([, k]) => k);
  if (missing.length) {
    return {
      config: DEFAULT_FIREBASE_CONFIG,
      error: new Error(
        "Firebase environment config অসম্পূর্ণ: " +
          missing.join(", ") +
          " সেট করা নেই। হয় সব VITE_FIREBASE_* ভ্যারিয়েবল দিন, নয়তো কোনোটিই দেবেন না " +
          "(তাহলে কোডে যাচাই করা ডিফল্ট config ব্যবহৃত হবে)। আংশিক config নিরাপত্তার জন্য " +
          "ইচ্ছাকৃতভাবে প্রত্যাখ্যান করা হয়েছে।"
      ),
    };
  }
  // আংশিক নয়, পুরো env সেট আছে — তাহলে সেটাই ব্যবহার করো (optional গুলো থাকলে ভরাট করো)
  const merged: Record<string, string> = {};
  for (const [prop, key] of REQUIRED_ENV_KEYS) merged[prop] = String(env[key]);
  for (const [prop, key] of OPTIONAL_ENV_KEYS) {
    if (env[key]) merged[prop] = String(env[key]);
  }
  return { config: merged as typeof DEFAULT_FIREBASE_CONFIG, error: null };
}

const resolved = resolveFirebaseConfig();

/** The effective, validated client-side Firebase config. */
export const firebaseConfig = resolved.config;

/**
 * Firestore collection names. This is the database structure — see
 * docs/FIREBASE.md for the full schema of each collection.
 */
export const COLLECTIONS = {
  donors: "donors", // approved public donor profiles
  requests: "requests", // emergency blood requests
  members: "members", // donor sign-up applications (pending review)
  users: "users", // website user accounts
  admins: "admins", // admin / moderator role documents (email -> role)
  queue: "queue", // moderation queue (approvals, proofs, reports)
  gallery: "gallery", // gallery images (ImgBB URL + metadata)
  notices: "notices", // published notices
  accounts: "accounts", // panel / team account records
  settings: "settings", // app settings (e.g. settings/imgbb — ImgBB API key)
} as const;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let initError: Error | null = resolved.error;

/** Initialise Firebase exactly once and return the shared services. */
export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (app && db && auth) {
    return { app, db, auth };
  }
  if (initError) {
    // Config resolve করতে গিয়ে error — চুপচাপ ভুল config চালু না করে থামিয়ে দিই।
    console.error("Firebase config error:", initError.message);
    return {
      app: app as FirebaseApp,
      db: db as Firestore,
      auth: auth as Auth,
    };
  }
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    initError = null;
  } catch (e) {
    initError = e as Error;
    console.warn("Firebase init failed:", (e as Error)?.message);
  }
  return {
    app: app as FirebaseApp,
    db: db as Firestore,
    auth: auth as Auth,
  };
}

/** Firestore instance (lazily initialised). */
export function getDb(): Firestore | null {
  if (!db) initFirebase();
  return db;
}

/** Auth instance (lazily initialised). */
export function getAuthInstance(): Auth | null {
  if (!auth) initFirebase();
  return auth;
}

/** Whether Firebase initialised successfully. */
export function isFirebaseReady(): boolean {
  if (!db) initFirebase();
  return !!db && !initError;
}

/** যদি init/config কোনো কারণে ব্যর্থ হয়, নির্ভুল কারণ ফেরত দেয় (না হলে null)। */
export function getFirebaseInitError(): Error | null {
  return initError;
}
