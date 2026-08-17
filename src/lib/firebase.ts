/**
 * CBDC — Firebase integration layer
 *
 * Single, shared Firebase instance for the whole app:
 *   - Firebase Authentication (email/password + Google) for login / register /
 *     logout / session,
 *   - **Firebase Realtime Database** as the primary data source for all app
 *     data (Cloud Firestore is no longer used anywhere).
 *
 * ছবি Firebase Storage-এ সংরক্ষণ করা হয় না — image hosting-এর জন্য ImgBB API
 * ব্যবহার করা হয় (দেখুন src/lib/imgbb.ts)। তাই Storage এখানে initialized হয় না।
 *
 * Realtime Database-এর সব read/write helper আছে src/lib/rtdb.ts-এ; পেজগুলো
 * সরাসরি `firebase/database` আমদানি না করে ওই helper গুলো ব্যবহার করে, তাই
 * পুরো অ্যাপে একটাই data access layer থাকে।
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase project configuration — project: chokbazarbloodclub-69d5f
 * (project number 826987875853).
 *
 * These values are public client-side identifiers (web API key) — access
 * control is enforced by Realtime Database Security Rules (see database.rules.json)
 * and by Firebase Auth itself, not by hiding this config. No server credential /
 * service account / admin key may ever be added here.
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
 *
 * Realtime Database ব্যবহার হয় বলে `databaseURL` এখন **required**।
 */
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
 * Realtime Database-এর top-level node গুলো। এটাই database structure —
 * প্রতিটি node-এর নিচে `{ id: {...} }` আকারে রেকর্ড থাকে।
 * পূর্ণ schema-র জন্য দেখুন docs/FIREBASE.md।
 */
export const NODES = {
  donors: "donors", // approved public donor profiles
  requests: "requests", // emergency blood requests
  members: "members", // donor sign-up applications (pending review)
  users: "users", // website user accounts (key = auth uid)
  admins: "admins", // admin / moderator role records (key = auth uid)
  queue: "queue", // moderation queue (approvals, proofs, reports)
  gallery: "gallery", // gallery images (ImgBB URL + metadata)
  notices: "notices", // published notices
  accounts: "accounts", // panel / team account records
  settings: "settings", // app settings (e.g. settings/imgbb — ImgBB API key)
} as const;

/**
 * পুরোনো নাম `COLLECTIONS` — Firestore যুগের কোড যেন হঠাৎ না ভাঙে সেজন্য
 * alias রাখা হয়েছে। নতুন কোডে `NODES` ব্যবহার করুন।
 */
export const COLLECTIONS = NODES;

let app: FirebaseApp | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;
let initError: Error | null = resolved.error;

/** Initialise Firebase exactly once and return the shared services. */
export function initFirebase(): { app: FirebaseApp; db: Database; auth: Auth } {
  if (app && rtdb && auth) {
    return { app, db: rtdb, auth };
  }
  if (initError) {
    // Config resolve করতে গিয়ে error — চুপচাপ ভুল config চালু না করে থামিয়ে দিই।
    console.error("Firebase config error:", initError.message);
    return {
      app: app as FirebaseApp,
      db: rtdb as Database,
      auth: auth as Auth,
    };
  }
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    rtdb = getDatabase(app);
    auth = getAuth(app);
    initError = null;
  } catch (e) {
    initError = e as Error;
    console.warn("Firebase init failed:", (e as Error)?.message);
  }
  return {
    app: app as FirebaseApp,
    db: rtdb as Database,
    auth: auth as Auth,
  };
}

/** Realtime Database instance (lazily initialised). */
export function getRtdb(): Database | null {
  if (!rtdb) initFirebase();
  return rtdb;
}

/** পুরোনো নাম — এখন Realtime Database instance ফেরত দেয়। */
export function getDb(): Database | null {
  return getRtdb();
}

/** Auth instance (lazily initialised). */
export function getAuthInstance(): Auth | null {
  if (!auth) initFirebase();
  return auth;
}

/** Whether Firebase initialised successfully. */
export function isFirebaseReady(): boolean {
  if (!rtdb) initFirebase();
  return !!rtdb && !initError;
}

/** যদি init/config কোনো কারণে ব্যর্থ হয়, নির্ভুল কারণ ফেরত দেয় (না হলে null)। */
export function getFirebaseInitError(): Error | null {
  return initError;
}
