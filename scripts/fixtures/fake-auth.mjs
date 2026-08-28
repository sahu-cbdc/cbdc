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
};

export function __user() {
  return { ...USER };
}

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
export const deleteUser = async () => undefined;
