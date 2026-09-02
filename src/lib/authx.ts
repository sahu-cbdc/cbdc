

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword,
  type Auth,
  type User,
  type UserCredential,
  type AuthCredential,
} from "firebase/auth";
import { subscribeAuthUser } from "./authState";
import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  type ActionCodeSettings,
} from "firebase/auth";
import { NODES } from "./firebase";
import { apiUpsertProfile } from "./api";
import { getRow, findBy, probeRow, type Row } from "./rtdb";
import { isValidDob, toEnglishDigits } from "./age";




export function authErrorCode(err: unknown): string {
  try {
    const anyErr = err as any;
    if (anyErr && typeof anyErr.code === "string" && anyErr.code) return anyErr.code;
    const m = anyErr && typeof anyErr.message === "string" ? anyErr.message : "";
    const found = m.match(/\(?(auth\/[a-z0-9-]+)\)?/i);
    if (found) return found[1].toLowerCase();
  } catch {
    
  }
  return "";
}


export const CONFIG_NOT_FOUND_MESSAGE =
  "Firebase Authentication কনফিগারেশন খুঁজে পাওয়া যায়নি। " +
  "কারণ: প্রজেক্টের Auth সার্ভিসটি এখনো সার্ভারে পুরোপুরি সক্রিয় হয়নি, অথবা " +
  "অ্যাপটি অন্য/পুরোনো Firebase প্রজেক্ট বা সীমাবদ্ধ (restricted) API key দিয়ে চলছে। " +
  "সমাধান: ① Firebase Console → Authentication → Sign-in method-এ Email/Password ও " +
  "Google চালু করে Save করুন (পরিবর্তন কার্যকর হতে কয়েক মিনিট লাগতে পারে), " +
  "② Google Cloud Console → APIs & Services-এ 'Identity Toolkit API' Enabled আছে কিনা দেখুন, " +
  "③ Project settings-এর API key-এ restriction থাকলে বর্তমান ওয়েবসাইটের ডোমেইনটি allowed রাখুন, " +
  "④ সাইটের সর্বশেষ build deploy করে ব্রাউজার হার্ড-রিফ্রেশ (Ctrl+Shift+R) করুন।";


export const AUTHORIZED_HOSTS = ["chawkbazarbloodclub.com", "www.chawkbazarbloodclub.com"] as const;


export function currentHost(): string {
  try {
    return String(window.location.host || "").toLowerCase();
  } catch {
    return "";
  }
}


export function isKnownAuthorizedHost(host: string = currentHost()): boolean {
  const h = String(host || "").toLowerCase().replace(/[:/].*$/, "");
  return (AUTHORIZED_HOSTS as readonly string[]).includes(h);
}

const UNAUTHORIZED_DOMAIN_MESSAGE = (host: string) =>
  `এই ডোমেইন (${host || "বর্তমান সাইট"}) থেকে লগইনের অনুমতি নেই। Firebase Console → ` +
  `Authentication → Settings → Authorized domains-এ এই ডোমেইনটি যোগ করুন। ` +
  `সাইটের মূল অনুমোদিত domain: ${AUTHORIZED_HOSTS.join(", ")}।`;

const KNOWN_HOST_UNAUTHORIZED_MESSAGE = (host: string) =>
  `এই ডোমেইন (${host}) Firebase Console-এ Authorized domain হিসেবেই সেট থাকলেও ` +
  `Authentication এখনো এটি থেকে লগইনের অনুমতি দিচ্ছে না। সম্ভাব্য কারণ: অ্যাপটি অন্য/পুরোনো ` +
  `Firebase project-এর config নিয়ে চলছে, অথবা Authorized domains পরিবর্তন এখনো কার্যকর হয়নি। ` +
  `Project settings-এর সর্বশেষ config ও Authentication → Authorized domains যাচাই করুন।`;

type MessageOptions = {
  
  wrongCredentials?: string;
  
  fallback?: string;
};


export function authErrorMessage(err: unknown, opts: MessageOptions = {}): string {
  const code = authErrorCode(err);
  const wrong = opts.wrongCredentials || "ইমেইল/ইউজার নেইম অথবা পাসওয়ার্ড সঠিক নয়।";

  switch (code) {
    
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return wrong;
    case "auth/too-many-requests":
      return "অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন অথবা পাসওয়ার্ড রিসেট করুন।";
    case "auth/user-disabled":
      return "এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।";

    
    case "auth/email-already-in-use":
      return "এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।";
    case "auth/invalid-email":
      return "ইমেইল ঠিকানাটি সঠিক নয়।";
    case "auth/weak-password":
      return "পাসওয়ার্ড খুব দুর্বল, কমপক্ষে ৬ অক্ষর দিন।";

    
    case "auth/network-request-failed":
      return "নেটওয়ার্ক সংযোগ নেই। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
    case "auth/internal-error":
    case "auth/timeout":
      return "Firebase সার্ভারে অস্থায়ী সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

    
    case "auth/popup-closed-by-user":
      return "লগইন উইন্ডোটি বন্ধ হয়ে গেছে, তাই প্রক্রিয়া সম্পন্ন হয়নি। আবার চেষ্টা করুন।";
    case "auth/cancelled-popup-request":
      return "পূর্বের লগইন উইন্ডোটি বাতিল করা হয়েছে। আবার চেষ্টা করুন।";
    case "auth/popup-blocked":
      return "ব্রাউজার পপ-আপ উইন্ডো ব্লক করেছে। পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "এই ব্রাউজার/মোডে (যেমন প্রাইভেট ব্রাউজিং) লগইন সমর্থিত নয়। অন্য ব্রাউজার ব্যবহার করুন।";
    case "auth/account-exists-with-different-credential":
      return "এই Google ইমেইল দিয়ে আগেই একটি অ্যাকাউন্ট তৈরি করা হয়েছে (ভিন্ন পদ্ধতিতে)। " +
        "নতুন অ্যাকাউন্ট না তৈরি করে অনুগ্রহ করে ইমেইল/পাসওয়ার্ড দিয়ে লগইন করুন — " +
        "চাইলে লগইন করার পর সেটিংস থেকে এই Google অ্যাকাউন্টটিও যুক্ত করে নিতে পারবেন।";

    
    case "auth/configuration-not-found":
      return CONFIG_NOT_FOUND_MESSAGE;
    case "auth/unauthorized-domain": {
      const host = currentHost();
      if (host && isKnownAuthorizedHost(host)) return KNOWN_HOST_UNAUTHORIZED_MESSAGE(host);
      return UNAUTHORIZED_DOMAIN_MESSAGE(host);
    }
    case "auth/unauthorized-continue-uri":
      return "লগইনের পর ফেরার ঠিকানাটি অনুমোদিত নয়। Firebase Console-এ Authorized domains যাচাই করুন।";
    case "auth/operation-not-allowed":
      return "এই সাইন-ইন পদ্ধতিটি Firebase Console-এ চালু নেই। Authentication → Sign-in method-এ চালু করুন।";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return "Firebase API key সঠিক নয় বা নিষ্ক্রিয়। Project settings-এর সর্বশেষ config যাচাই করুন।";
    case "auth/app-not-authorized":
    case "auth/app-not-installed":
      return "এই অ্যাপটি Firebase Authentication ব্যবহারের জন্য অনুমোদিত নয়। API key-এর restriction যাচাই করুন।";
    case "auth/missing-email":
      return "ইমেইল ঠিকানা দেওয়া হয়নি।";
    case "auth/requires-recent-login":
      return "নিরাপত্তার জন্য এই কাজটি করতে নতুন করে লগইন করতে হবে। লগআউট করে আবার লগইন করুন।";
    case "auth/quota-exceeded":
      return "অস্থায়ীভাবে অনুরোধের সীমা অতিক্রম করেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
    default:
      break;
  }

  if (!code) {
    
    const msg = err && typeof (err as any).message === "string" ? String((err as any).message) : "";
    if (msg && !/auth\/|Firebase:|firebase/i.test(msg) && msg.length <= 240) return msg;
  }
  try {
    
    console.warn("[auth] unmapped firebase error:", code || (err as any)?.message || err);
  } catch {
    
  }
  return opts.fallback || "অপ্রত্যাশিত সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
}



export type GoogleProfile = { uid: string; email: string; name: string; photo: string };


export function profileFromFirebaseUser(u: { uid?: string; email?: string | null; displayName?: string | null; photoURL?: string | null; providerData?: ReadonlyArray<{ email?: string | null; displayName?: string | null; photoURL?: string | null } | null> } | null): GoogleProfile {
  const out: GoogleProfile = { uid: "", email: "", name: "", photo: "" };
  if (!u) return out;
  out.uid = String(u.uid || "");
  out.email = String(u.email || "");
  out.name = String(u.displayName || "");
  out.photo = String(u.photoURL || "");
  try {
    for (const p of u.providerData || []) {
      if (!p) continue;
      if (!out.email && p.email) out.email = String(p.email);
      if (!out.name && p.displayName) out.name = String(p.displayName);
      if (!out.photo && p.photoURL) out.photo = String(p.photoURL);
    }
  } catch {
    
  }
  return out;
}

const GOOGLE_INTENT_KEY = "cbdc.pendingGoogleIntent";


export function setGoogleIntent(intent: "login" | "signup" | null): void {
  try {
    if (intent) sessionStorage.setItem(GOOGLE_INTENT_KEY, intent);
    else sessionStorage.removeItem(GOOGLE_INTENT_KEY);
  } catch {
    
  }
}

const GOOGLE_PROFILE_KEY = "cbdc.pendingGoogleProfile";


export function setPendingGoogleProfile(profile: GoogleProfile | null): void {
  try {
    if (profile && profile.uid) sessionStorage.setItem(GOOGLE_PROFILE_KEY, JSON.stringify(profile));
    else sessionStorage.removeItem(GOOGLE_PROFILE_KEY);
  } catch {
    
  }
}

export function getPendingGoogleProfile(): GoogleProfile | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.uid === "string" && p.uid) {
      return {
        uid: p.uid,
        email: p.email || "",
        name: p.name || "",
        photo: p.photo || "",
      };
    }
  } catch {
    
  }
  return null;
}


export function isPhoneOk(value: unknown): boolean {
  return /^01[3-9]\d{8}$/.test(toEnglishDigits(value).replace(/\s/g, ""));
}


export function isProfileComplete(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const name = String(profile.name || "").trim();
  return name.length >= 2 && isPhoneOk(profile.phone) && isValidDob(profile.dob);
}


export function photoForUid(
  profile: Record<string, unknown> | null | undefined,
  googlePhoto?: string
): string {
  const existing = String(profile?.photoURL || profile?.photo || "").trim();
  if (existing) return existing;
  return String(googlePhoto || "").trim();
}


export async function loadUserProfile(uid: string): Promise<Record<string, any> | null> {
  if (!uid) return null;
  try {
    return await getRow(NODES.users, uid);
  } catch (e) {
    console.warn("loadUserProfile:", (e as Error)?.message);
    return null;
  }
}


export function shouldPreferRedirect(): boolean {
  try {
    const ua = navigator.userAgent || "";
    if (/\b(FBAN|FBAV|Instagram|Messenger|Line\/|TikTok)\b/i.test(ua)) return true; 
    if (/iPhone|iPad|iPod/i.test(ua)) return true; 
  } catch {
    
  }
  return false;
}


const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/network-request-failed", 
]);

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}


export async function googleSignInWithFallback(
  auth: Auth,
  intent: "login" | "signup"
): Promise<UserCredential | null> {
  if (shouldPreferRedirect()) {
    setGoogleIntent(intent);
    await signInWithRedirect(auth, buildGoogleProvider());
    return null; 
  }
  try {
    return await signInWithPopup(auth, buildGoogleProvider());
  } catch (err) {
    const code = authErrorCode(err);
    if (REDIRECT_FALLBACK_CODES.has(code)) {
      
      try {
        setGoogleIntent(intent);
        await signInWithRedirect(auth, buildGoogleProvider());
        return null;
      } catch (redirectErr) {
        
        console.warn("Google redirect fallback failed:", redirectErr);
        throw err;
      }
    }
    throw err;
  }
}


export async function consumeGoogleRedirect(
  auth: Auth
): Promise<{ profile: GoogleProfile; intent: "login" | "signup" } | null> {
  let intent: "login" | "signup" = "login";
  let hadIntent = false;
  try {
    const raw = sessionStorage.getItem(GOOGLE_INTENT_KEY);
    if (raw === "signup") intent = "signup";
    hadIntent = !!raw;
  } catch {
    
  }
  let result: UserCredential | null = null;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    setGoogleIntent(null);
    console.warn(
      "[google-redirect] getRedirectResult threw:",
      (err as any)?.code,
      (err as any)?.message
    );
    throw err;
  }
  if (!result || !result.user) {
    
    const current = auth.currentUser;
    if (current && current.uid) {
      console.warn(
        "[google-redirect] getRedirectResult returned null but auth.currentUser is signed in — resuming from currentUser.",
        current.uid
      );
      return {
        profile: profileFromFirebaseUser(current),
        intent,
      };
    }
    if (hadIntent) setGoogleIntent(null); 
    console.warn(
      "[google-redirect] getRedirectResult returned null and no signed-in user." +
        " pendingIntent=" + (hadIntent ? intent : "none") +
        ". সম্ভাব্য কারণ: তৃতীয়-পক্ষ কুকি/স্টোরেজ ব্লক, auth-handler ফলাফল সংরক্ষণ না করা," +
        " অথবা redirect বিঘ্নিত হওয়া।"
    );
    return null;
  }
  const u = result.user;
  return {
    profile: profileFromFirebaseUser(u),
    intent,
  };
}


export function onAuthUserChanged(_auth: Auth, cb: (user: User | null) => void): () => void {
  void _auth; 
  return subscribeAuthUser(cb);
}




export function userHasPasswordProvider(
  user: { providerData?: ReadonlyArray<{ providerId?: string } | null> } | null | undefined
): boolean {
  try {
    return (user?.providerData || []).some(
      (p) => !!p && (p.providerId === "password" || p.providerId === "firebase")
    );
  } catch {
    return false;
  }
}


export function googleCredentialFromError(
  err: unknown
): { email: string; credential: AuthCredential } | null {
  try {
    const e = err as any;
    const email = String(e?.customData?.email || e?.email || "").trim().toLowerCase();
    const credential = e?.credential as AuthCredential | undefined;
    if (!email || !credential) return null;
    return { email, credential };
  } catch {
    return null;
  }
}


export async function setOrChangePassword(
  user: User,
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const address = String(email || "").trim().toLowerCase();
  const next = String(newPassword || "");
  if (!address || !next) throw new Error("পাসওয়ার্ড দেওয়া হয়নি।");
  if (userHasPasswordProvider(user)) {
    if (!currentPassword) throw new Error("বর্তমান পাসওয়ার্ড দিন।");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(address, currentPassword));
    await updatePassword(user, next);
    return false;
  }
  
  await linkWithCredential(user, EmailAuthProvider.credential(address, next));
  return true;
}




export async function ensureUserProfile(
  user: {
    uid: string;
    email?: string;
    name?: string;
    photo?: string;
    dob?: string;
    phone?: string;
    gender?: string;
    area?: string;
    district?: string;
    username?: string;
    address?: string;
    bloodGroup?: string;
    donorId?: string;
    donorStatus?: string;
    lastDonation?: string;
    whatsapp?: string;
    health?: string;
    available?: boolean;
    appliedAt?: string;
    cardTheme?: string;
  },
  extra: { provider?: string; existing?: Record<string, any> | null } = {}
): Promise<void> {
  if (!user || !user.uid) return;
  await apiUpsertProfile(user as Record<string, any>, {
    provider: extra.provider,
    mode: extra.existing === null ? "create" : "upsert",
  });
}



export type AppRole = "donor" | "moderator" | "admin";

export interface ResolvedRole {
  role: AppRole;
  name: string;
  permissions: string[] | Record<string, unknown>;
  
  staff: Record<string, any> | null;
}


function normaliseRole(raw: unknown): AppRole | null {
  const r = String(raw || "").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "moderator" || r === "mod") return "moderator";
  if (r === "donor" || r === "user" || r === "member") return "donor";
  return null;
}


export async function resolveUserRole(
  user: { uid?: string; email?: string; name?: string } | null | undefined,
  opts: { knownProfile?: Record<string, any> | null } = {}
): Promise<ResolvedRole> {
  const out: ResolvedRole = { role: "donor", name: user?.name || "", permissions: [], staff: null };
  if (!user) return out;
  const uid = String(user.uid || "");
  const email = String(user.email || "").toLowerCase();

  
  const [adminsRead, profile] = await Promise.all([
    uid ? probeRow(NODES.admins, uid) : Promise.resolve({ row: (null as Row | null), denied: false }),
    opts.knownProfile !== undefined
      ? Promise.resolve({ row: (opts.knownProfile || null) as Row | null, denied: false })
      : uid
        ? probeRow(NODES.users, uid)
        : Promise.resolve({ row: (null as Row | null), denied: false }),
  ]);

  let staff: Record<string, any> | null = adminsRead.row;
  
  if (!staff && !adminsRead.denied && email) {
    try {
      staff = await findBy(NODES.admins, "email", email);
    } catch (e) {
      console.warn("role lookup (admins email):", (e as Error)?.message);
    }
  }
  if (staff && staff.status !== "disabled") {
    const r = normaliseRole(staff.role);
    if (r === "admin" || r === "moderator") {
      out.role = r;
      out.name = staff.name || out.name;
      out.permissions = staff.permissions || [];
      out.staff = staff;
      return out;
    }
  }

  let userData: Record<string, any> | null = profile.row;
  if (!userData && !profile.denied && email) {
    try {
      userData = await findBy(NODES.users, "email", email);
    } catch (e) {
      console.warn("role lookup (users email):", (e as Error)?.message);
    }
  }
  if (userData) {
    out.name = userData.name || out.name;
    
    out.role = "donor";
  }
  return out;
}


export function panelForRole(role: unknown): "doner" | "moderator" | "admin" {
  const r = normaliseRole(role) || "donor";
  if (r === "admin") return "admin";
  if (r === "moderator") return "moderator";
  return "doner";
}




export function resetActionSettings(): ActionCodeSettings | undefined {
  try {
    const origin = window.location.origin;
    let base = window.location.pathname || "/";
    const m = base.match(/^(.*?\/)(?:reset-password|forgot-password|login|signup|doner|admin|moderator)(?:\/.*)?$/i);
    base = m ? m[1] : base.endsWith("/") ? base : base.replace(/[^/]*$/, "");
    return { url: origin + base + "reset-password", handleCodeInApp: false };
  } catch {
    return undefined;
  }
}


export async function requestPasswordReset(auth: Auth, email: string): Promise<void> {
  const address = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw new Error("সঠিক ইমেইল ঠিকানা দিন।");
  }
  const settings = resetActionSettings();
  try {
    await sendPasswordResetEmail(auth, address, settings);
  } catch (err) {
    
    if (authErrorCode(err) === "auth/unauthorized-continue-uri") {
      await sendPasswordResetEmail(auth, address);
      return;
    }
    throw err;
  }
}


export async function verifyResetCode(auth: Auth, oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, String(oobCode || ""));
}


export async function completePasswordReset(
  auth: Auth,
  oobCode: string,
  newPassword: string
): Promise<void> {
  await confirmPasswordReset(auth, String(oobCode || ""), String(newPassword || ""));
}
