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
 * Firebase project configuration — Updated with new project credentials.
 * These values are public client-side identifiers — access control is enforced
 * by Firestore Security Rules (see firestore.rules), not by hiding this config.
 */
export const firebaseConfig = {
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
let initError: Error | null = null;

/** Initialise Firebase exactly once and return the shared services. */
export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (app && db && auth) {
    return { app, db, auth };
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

