

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, browserLocalPersistence, setPersistence, type Auth } from "firebase/auth";


const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM",
  authDomain: "auth.chawkbazarbloodclub.com", 
  databaseURL: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  projectId: "chokbazarbloodclub-69d5f",
  storageBucket: "chokbazarbloodclub-69d5f.firebasestorage.app",
  messagingSenderId: "826987875853",
  appId: "1:826987875853:web:8a9509b80867538393cf44",
  measurementId: "G-KJTMR061LX",
};


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
    
  }
  return env;
}

function resolveFirebaseConfig(): { config: typeof DEFAULT_FIREBASE_CONFIG; error: Error | null } {
  const env = publicEnv();
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
  
  const merged: Record<string, string> = {};
  for (const [prop, key] of REQUIRED_ENV_KEYS) merged[prop] = String(env[key]);
  for (const [prop, key] of OPTIONAL_ENV_KEYS) {
    if (env[key]) merged[prop] = String(env[key]);
  }
  return { config: merged as typeof DEFAULT_FIREBASE_CONFIG, error: null };
}

const resolved = resolveFirebaseConfig();


export const firebaseConfig = resolved.config;


export const NODES = {
  donors: "donors", 
  requests: "requests", 
  members: "members", 
  users: "users", 
  admins: "admins", 
  queue: "queue", 
  donations: "donations", 
  gallery: "gallery", 
  notices: "notices", 
  accounts: "accounts", 
  settings: "settings", 
  audit: "audit",       
  messages: "messages", 
  reports: "reports",   
  _meta: "_meta",       
} as const;


export const COLLECTIONS = NODES;

let app: FirebaseApp | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;
let initError: Error | null = resolved.error;


export function initFirebase(): { app: FirebaseApp; db: Database; auth: Auth } {
  if (app && rtdb && auth) {
    return { app, db: rtdb, auth };
  }
  if (initError) {
    
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
    
    try {
      void setPersistence(auth, browserLocalPersistence).catch((e) => {
        console.warn("auth persistence:", (e as Error)?.message);
      });
    } catch {
      
    }
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


export function getRtdb(): Database | null {
  if (!rtdb) initFirebase();
  return rtdb;
}


export function getDb(): Database | null {
  return getRtdb();
}


export function getAuthInstance(): Auth | null {
  if (!auth) initFirebase();
  return auth;
}


export function isFirebaseReady(): boolean {
  if (!rtdb) initFirebase();
  return !!rtdb && !initError;
}


export function getFirebaseInitError(): Error | null {
  return initError;
}
