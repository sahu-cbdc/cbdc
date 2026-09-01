/**
 * Centralized client auth-session actions.
 *
 * Firebase Auth's web SDK owns the browser session, so these operations run
 * in the browser — but pages never import the SDK directly; they call these
 * helpers. Everything database-side or privileged goes through the API
 * gateways (src/config/api.ts), never through this module.
 */
import { initFirebase, getAuthInstance } from "./firebase";

export type AuthUserSnapshot = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
};

export type AuthCurrentUser = AuthUserSnapshot & {
  emailVerified: boolean;
  providerIds: string[];
};

function snapshotOf(user: any): AuthUserSnapshot {
  return {
    uid: String((user && user.uid) || ""),
    email: String((user && user.email) || ""),
    displayName: String((user && user.displayName) || ""),
    photoURL: String((user && user.photoURL) || ""),
  };
}

/** Sync snapshot of the signed-in user (null when signed out/init failed). */
export function authCurrentUser(): AuthCurrentUser | null {
  const auth = getAuthInstance();
  const user = auth && auth.currentUser;
  if (!user) return null;
  return {
    ...snapshotOf(user),
    emailVerified: !!(user && user.emailVerified),
    providerIds: Array.isArray(user.providerData)
      ? user.providerData.map((p: any) => String((p && p.providerId) || ""))
      : [],
  };
}

/** Sync uid of the signed-in user ("" when signed out). */
export function currentAuthUid(): string {
  const auth = getAuthInstance();
  return String(((auth && auth.currentUser && auth.currentUser.uid) || "") as string);
}

export function hasAuthCurrentUser(): boolean {
  return !!authCurrentUser();
}

async function waitAuthStateReady(auth: any, uid?: string): Promise<void> {
  if (auth && auth.currentUser && (!uid || auth.currentUser.uid === uid)) return;
  try {
    if (auth && auth.authStateReady) await auth.authStateReady();
  } catch {
    return;
  }
}

export async function authSignOut(): Promise<void> {
  const { auth } = initFirebase();
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

export async function updateAuthProfile(patch: { displayName?: string; photoURL?: string }): Promise<void> {
  const { auth } = initFirebase();
  if (!auth || !auth.currentUser) return;
  const { updateProfile } = await import("firebase/auth");
  await updateProfile(auth.currentUser, patch as any);
}

export type CreateEmailAccountResult =
  | { kind: "signed-in"; uid: string }
  | { kind: "created"; uid: string }
  | { kind: "existing"; uid: string };

/**
 * Signup mechanics: reuse an already-signed-in matching account, otherwise
 * create it — and when the email is taken, sign in with the password and
 * report `existing` so the page can decide what to show. Re-throws the
 * original create error when the password does not match the existing
 * account.
 */
export async function createOrSignInEmailAccount(
  email: string,
  password: string,
  displayName: string
): Promise<CreateEmailAccountResult> {
  const { auth } = initFirebase();
  if (!auth) throw new Error("Firebase Authentication প্রস্তুত নয়।");
  const already = auth.currentUser;
  const alreadyEmail = String((already && already.email) || "").trim().toLowerCase();
  if (already && already.uid && alreadyEmail === email) {
    await waitAuthStateReady(auth);
    return { kind: "signed-in", uid: already.uid };
  }
  const { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } = await import("firebase/auth");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      return { kind: "created", uid: cred.user.uid };
    }
    await waitAuthStateReady(auth, cred.user.uid);
    return { kind: "created", uid: cred.user.uid };
  } catch (createErr) {
    if (String((createErr as any)?.code || "") !== "auth/email-already-in-use") throw createErr;
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch {
      throw createErr;
    }
    await waitAuthStateReady(auth, cred.user.uid);
    return { kind: "existing", uid: cred.user.uid };
  }
}

/**
 * Password sign-in, optionally linking a pending Google credential to the
 * freshly signed-in user. Returns a snapshot shaped like { user: {...} } so
 * callers read cred.user.uid / .displayName / .photoURL / .email.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  linkCredential?: unknown
): Promise<{ user: AuthUserSnapshot; linked: boolean }> {
  const { auth } = initFirebase();
  if (!auth) throw Object.assign(new Error("network"), { code: "auth/network-request-failed" });
  const { signInWithEmailAndPassword, linkWithCredential } = await import("firebase/auth");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  let linked = false;
  if (linkCredential) {
    try {
      await linkWithCredential(cred.user, linkCredential as any);
      linked = true;
    } catch (e) {
      console.warn("google link on login:", (e as any)?.code || "", (e as Error)?.message || "", e);
    }
  }
  return { user: snapshotOf(cred.user), linked };
}

export async function reauthenticateCurrentWithPassword(password: string, emailHint?: string): Promise<void> {
  const { auth } = initFirebase();
  const user = auth && auth.currentUser;
  if (!user) throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
  const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || emailHint || "", password));
}

export async function updateAuthEmail(newEmail: string): Promise<void> {
  const { auth } = initFirebase();
  const user = auth && auth.currentUser;
  if (!user) throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
  const { updateEmail } = await import("firebase/auth");
  await updateEmail(user, newEmail);
}

export async function deleteAuthCurrentUser(): Promise<void> {
  const { auth } = initFirebase();
  const user = auth && auth.currentUser;
  if (!user) throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
  const { deleteUser } = await import("firebase/auth");
  await deleteUser(user);
}
