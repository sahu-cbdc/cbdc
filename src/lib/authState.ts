/**
 * CBDC — ঐক্যবদ্ধ Firebase Authentication state
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  নিয়ম: ঠিক **একটি** `onAuthStateChanged` listener এই অ্যাপে নিবন্ধিত হয় —
 *  এখানে। অন্য সব জায়গা (store, Home, Doner, Admin, Moderator, authx) এই
 *  মডিউলের `subscribeAuthUser()` / `getAuthUser()` / `waitForAuthUser()` ব্যবহার
 *  করে। এতে duplicate auth listener তৈরি হয় না এবং login/logout-এর পর সব
 *  সার্বিক session/RTDB প্রতিফলন ঠিক একই উৎস থেকে আসে।
 *
 *  ‌Firebase Authentication-ই session-এর primary source:
 *    - `email/password` → `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`
 *    - `Google`          → `signInWithPopup` / `signInWithRedirect` + `getRedirectResult`
 *      (src/lib/authx.ts-এ)।
 *
 *  এখানে **কোনো** Firebase Admin SDK / service-account / private key নেই; শুধু
 *  shared browser `Auth` instance-এর state observer।
 */

import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getAuthInstance } from "./firebase";

type AuthListener = (user: User | null) => void;

let auth: Auth | null = null;
let currentUser: User | null = null;
let registered = false;
/** shared listener-এর প্রথম initial callback দিয়েছে কিনা। */
let hasSynced = false;
const listeners = new Set<AuthListener>();

/** Shared Auth listener ঠিক একবারই register করা — idempotent। */
function ensureListener(): void {
  if (registered) return;
  auth = getAuthInstance();
  if (!auth) return;
  registered = true;
  /* Firebase SDK localStorage থেকে user আগে থেকেই পেয়ে থাকতে পারে; listener
     event-এর আগে tentative value হিসাবে রাখা হয় (getAuthUser()-এর জন্য)। */
  currentUser = auth.currentUser || null;
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    hasSynced = true;
    for (const cb of Array.from(listeners)) {
      try {
        cb(user);
      } catch {
        /* subscriber error — অন্য subscriber-কে থামাই না */
      }
    }
  });
}

/** বর্তমান Firebase Auth user (null = signed-out / এখনো লোড হয়নি)। */
export function getAuthUser(): User | null {
  ensureListener();
  return currentUser || (auth ? auth.currentUser : null) || null;
}

/**
 * Auth state-এর একক উৎসে subscribe।
 * - Callback একটি initial snapshot পায় (Firebase `onAuthStateChanged`-এর মতো,
 *   পরবর্তী tick-এ), যেখানে shared listener-এর initial event এখনো না এলে
 *   listener event-ই initial হিসাবে কাজ করে — duplicate initial callback হয় না।
 * - Return = unsubscribe (শুধু এই subscriber সরায়; shared listener থাকে)।
 */
export function subscribeAuthUser(cb: AuthListener): () => void {
  ensureListener();
  listeners.add(cb);
  if (hasSynced) {
    try {
      setTimeout(() => {
        if (!listeners.has(cb)) return;
        cb(currentUser);
      }, 0);
    } catch {
      /* ignore */
    }
  }
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Sign-in শেষে currentUser বসা পর্যন্ত অপেক্ষা (ছোট timeout-সহ)।
 * Return: User | null (null হলে signed-out / timeout / init-error)।
 */
export async function waitForAuthUser(timeoutMs = 4000): Promise<User | null> {
  ensureListener();
  if (currentUser || (auth && auth.currentUser)) return getAuthUser();
  return new Promise((resolve) => {
    let done = false;
    let unsub: () => void = () => {};
    const finish = (u: User | null) => {
      if (done) return;
      done = true;
      try {
        unsub();
      } catch {
        /* ignore */
      }
      resolve(u);
    };
    unsub = subscribeAuthUser((u) => {
      if (u) finish(u);
    });
    setTimeout(() => finish(getAuthUser()), timeoutMs);
  });
}
