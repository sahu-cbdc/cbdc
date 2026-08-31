

import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getAuthInstance } from "./firebase";

type AuthListener = (user: User | null) => void;

let auth: Auth | null = null;
let currentUser: User | null = null;
let registered = false;

let hasSynced = false;
const listeners = new Set<AuthListener>();


function ensureListener(): void {
  if (registered) return;
  auth = getAuthInstance();
  if (!auth) return;
  registered = true;
  
  currentUser = auth.currentUser || null;
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    hasSynced = true;
    for (const cb of Array.from(listeners)) {
      try {
        cb(user);
      } catch {
        
      }
    }
  });
}


export function getAuthUser(): User | null {
  ensureListener();
  const fromAuth = auth ? auth.currentUser : null;
  return fromAuth || currentUser || null;
}


export function subscribeAuthUser(cb: AuthListener): () => void {
  ensureListener();
  listeners.add(cb);
  if (hasSynced) {
    try {
      setTimeout(() => {
        if (!listeners.has(cb)) return;
        const fromAuth = auth ? auth.currentUser : null;
        cb(fromAuth || currentUser || null);
      }, 0);
    } catch {
      
    }
  }
  return () => {
    listeners.delete(cb);
  };
}


export async function waitForAuthUser(timeoutMs = 1000): Promise<User | null> {
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
        
      }
      resolve(u);
    };
    unsub = subscribeAuthUser((u) => {
      if (u) finish(u);
    });
    setTimeout(() => finish(getAuthUser()), timeoutMs);
  });
}
