/**
 * Verification fixture — Firebase Auth stub (see scripts/verify-admin-panel.mjs).
 * একটি স্থির, সাইন-ইন করা admin ব্যবহারকারী দেয় (কোনো নেটওয়ার্ক ছাড়াই)।
 */

const USER = {
  uid: "adminuid00000000000000001",
  email: "admin@cbdc.test",
  displayName: "শাহাদাত আহমেদ",
  photoURL: "",
  emailVerified: true,
  /* secure server delete — client শুধু এই ID token পাঠায় (কোনো secret নেই) */
  getIdToken: async () => "fake-id-token-admin",
};

/* verification-এ ব্যবহৃত token → uid ম্যাপ (server-side Identity Toolkit stub-এ)। */
export const __tokens = new Map([
  ["fake-id-token-admin", USER.uid],
  ["fake-id-token-donor-a", "donoruid000000000000000a"],
  ["fake-id-token-donor-b", "donoruid000000000000000b"],
  ["fake-id-token-nobody", "nobodyuid00000000000000"],
]);

export function __user() {
  return { ...USER };
}

/* self-account deletion test — এই uid-এর deleteUser ইচ্ছে করে ব্যর্থ হবে */
export const __failingDeleteUids = new Set();
export const __deletedUids = [];

export function getAuth() {
  return { currentUser: USER, __fake: true };
}
export async function setPersistence() {
  return;
}
export function onAuthStateChanged(auth, cb) {
  setTimeout(() => cb(USER), 0);
  return () => undefined;
}
export const browserLocalPersistence = "local";

/* বাকি export গুলো অন্য মডিউল import করে — ESM named import ঠিক রাখতেই। */
const noop = async () => ({ user: USER });
export const GoogleAuthProvider = class {
  constructor() {}
  addScope() {}
};
export const EmailAuthProvider = class {};
export const signInWithPopup = noop;
export const signInWithRedirect = noop;
export const getRedirectResult = async () => null;
export const sendPasswordResetEmail = async () => undefined;
export const verifyPasswordResetCode = async () => USER.email;
export const confirmPasswordReset = async () => undefined;
export const signOut = async () => undefined;
export const signInWithEmailAndPassword = noop;
export const createUserWithEmailAndPassword = noop;
export const updatePassword = async () => undefined;
export const reauthenticateWithCredential = noop;
export const deleteUser = async (user) => {
  const uid = String(user?.uid || "");
  if (__failingDeleteUids.has(uid)) {
    const error = new Error("auth/requires-recent-login");
    error.code = "auth/requires-recent-login";
    throw error;
  }
  __deletedUids.push(uid);
  return undefined;
};
