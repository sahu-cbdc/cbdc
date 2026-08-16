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
 * Firebase project configuration (unchanged from the original HTML).
 * These values are public client-side identifiers — access control is enforced
 * by Firestore Security Rules (see firestore.rules), not by hiding this config.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyALJJ7ZAFKWoFQmmjTtvaJia22qrnjJQuw",
  authDomain: "cbdc-a9418.firebaseapp.com",
  databaseURL: "https://cbdc-a9418-default-rtdb.firebaseio.com",
  projectId: "cbdc-a9418",
  storageBucket: "cbdc-a9418.firebasestorage.app",
  messagingSenderId: "90475597825",
  appId: "1:90475597825:web:264a256ffccfc4cb9db000",
  measurementId: "G-YBFHHRDC7V",
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
    // Re-throw is too aggressive for the ported pages which guard with
    // `fbReady`; instead we surface the error through the getter helpers.
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

/** Firebase Auth instance (lazily initialised). */
export function getAuthInstance(): Auth | null {
  if (!auth) initFirebase();
  return auth;
}

/** Whether Firebase initialised successfully. */
export function isFirebaseReady(): boolean {
  if (!db) initFirebase();
  return !!db && !initError;
}

/** A short, stable display name for the connected project (for diagnostics). */
export function projectLabel(): string {
  return firebaseConfig.projectId;
}

export { app, db, auth };
