

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, browserLocalPersistence, setPersistence, type Auth } from "firebase/auth";


import { FIREBASE_PUBLIC_CONFIG } from "../config/firebase";


export const firebaseConfig = FIREBASE_PUBLIC_CONFIG;


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
let initError: Error | null = null;


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
