/**
 * PUBLIC Firebase web configuration — the single source of truth.
 *
 * Both the browser SDK (src/lib/firebase.ts) and the server
 * (server/config.ts) import their values from HERE and nowhere else, so
 * switching project/environment means editing exactly this one file.
 *
 * These values are safe to bundle: the Firebase web API key is public by
 * design (access is governed by Auth settings and database rules, not by
 * key secrecy).
 *
 * Server-only secrets (service account, ImgBB key) never appear here —
 * they live exclusively in server-side secret storage (Cloudflare Worker
 * secrets in production, process environment for local dev).
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
