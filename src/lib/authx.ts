/**
 * CBDC — কেন্দ্রীয় Firebase Authentication হেল্পার
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  এই মডিউলে থাকে:
 *    ১. authErrorMessage() — Firebase-এর raw error code কখনোই ইউজারকে সরাসরি
 *       না দেখিয়ে বাংলা ও পরিষ্কার বার্তা দেয়। auth/configuration-not-found-এর
 *       জন্য আলাদা diagnostic বার্তা।
 *    ২. googleSignInWithFallback() — ডেস্কটপে signInWithPopup, আর মোবাইল ব্রাউজার /
 *       পপ-আপ ব্লক / webview-এ প্রয়োজন হলে স্বয়ংক্রিয়ভাবে signInWithRedirect।
 *    ৩. consumeGoogleRedirect() — redirect দিয়ে ফেরার পর ফলাফল পুনরুদ্ধার
 *       (getRedirectResult) — intent ("login"|"signup")-সহ।
 *    ৪. ensureUserProfile() — login/signup সফল হলে Realtime Database-এর
 *       `users/{uid}` নোডে প্রোফাইল তৈরি/আপডেট (merge) — আগের role/status নষ্ট হয় না।
 *    ৫. onAuthUserChanged() — auth state লিসেনারের ছোট wrapper।
 *    ৬. resolveUserRole() — role কোথা থেকে আসে তার একমাত্র সিদ্ধান্তকেন্দ্র
 *       (RTDB `admins` → তারপর `users`)।
 *    ৭. requestPasswordReset() / completePasswordReset() — Firebase-এর built-in
 *       password reset link ব্যবহার করে (কোনো custom OTP backend নেই)।
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  type ActionCodeSettings,
} from "firebase/auth";
import { NODES } from "./firebase";
import { getRow, updateRow, setRow, findBy, nowIso } from "./rtdb";
import { isValidDob, toEnglishDigits } from "./age";

/* ═══════════════════════════════════════════════════════════════════
   ১. বাংলা error message
   ═══════════════════════════════════════════════════════════════════ */

/** FirebaseError-এর `code` নিরাপদে বের করা (message ভেতরেও থাকতে পারে)। */
export function authErrorCode(err: unknown): string {
  try {
    const anyErr = err as any;
    if (anyErr && typeof anyErr.code === "string" && anyErr.code) return anyErr.code;
    const m = anyErr && typeof anyErr.message === "string" ? anyErr.message : "";
    const found = m.match(/\(?(auth\/[a-z0-9-]+)\)?/i);
    if (found) return found[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * auth/configuration-not-found — এটা UI message দিয়ে hide করা সমস্যা নয়।
 * এই বার্তাটি শুধু তখনই আসে যখন ব্যাকএন্ড (Identity Toolkit) সত্যিই প্রজেক্টের
 * auth কনফিগারেশন খুঁজে পায় না — তাই ইউজার/অ্যাডমিনকে করণীয় জানানোই সঠিক fix-এর
 * একমাত্র উপায়।
 */
export const CONFIG_NOT_FOUND_MESSAGE =
  "Firebase Authentication কনফিগারেশন খুঁজে পাওয়া যায়নি। " +
  "কারণ: প্রজেক্টের Auth সার্ভিসটি এখনো সার্ভারে পুরোপুরি সক্রিয় হয়নি, অথবা " +
  "অ্যাপটি অন্য/পুরোনো Firebase প্রজেক্ট বা সীমাবদ্ধ (restricted) API key দিয়ে চলছে। " +
  "সমাধান: ① Firebase Console → Authentication → Sign-in method-এ Email/Password ও " +
  "Google চালু করে Save করুন (পরিবর্তন কার্যকর হতে কয়েক মিনিট লাগতে পারে), " +
  "② Google Cloud Console → APIs & Services-এ 'Identity Toolkit API' Enabled আছে কিনা দেখুন, " +
  "③ Project settings-এর API key-এ restriction থাকলে বর্তমান ওয়েবসাইটের ডোমেইনটি allowed রাখুন, " +
  "④ সাইটের সর্বশেষ build deploy করে ব্রাউজার হার্ড-রিফ্রেশ (Ctrl+Shift+R) করুন।";

const UNAUTHORIZED_DOMAIN_MESSAGE = (host: string) =>
  `এই ডোমেইন (${host}) থেকে লগইনের অনুমতি নেই। Firebase Console → Authentication → ` +
  `Settings → Authorized domains-এ এই ডোমেইনটি যোগ করুন (যেমন: Cloudflare Pages/Workers-এর ` +
  `ঠিকানা অথবা কাস্টম ডোমেইন)।`;

type MessageOptions = {
  /** ভুল পাসওয়ার্ড/ইমেইলের ক্ষেত্রে প্রেক্ষাপট-নির্দিষ্ট বার্তা (যেমন পাসওয়ার্ড পরিবর্তনের সময়) */
  wrongCredentials?: string;
  /** অজানা ত্রুটির ডিফল্ট বার্তা */
  fallback?: string;
};

/**
 * Firebase auth error → বাংলায় পরিষ্কার বার্তা।
 * raw error code/message কখনোই ইউজারকে ফেরত দেয় না (নিজের তৈরি বাংলা বার্তা ছাড়া)।
 */
export function authErrorMessage(err: unknown, opts: MessageOptions = {}): string {
  const code = authErrorCode(err);
  const wrong = opts.wrongCredentials || "ইমেইল/ইউজার নেইম অথবা পাসওয়ার্ড সঠিক নয়।";

  switch (code) {
    /* ── লগইন ── */
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return wrong;
    case "auth/too-many-requests":
      return "অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন অথবা পাসওয়ার্ড রিসেট করুন।";
    case "auth/user-disabled":
      return "এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।";

    /* ── সাইন-আপ ── */
    case "auth/email-already-in-use":
      return "এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।";
    case "auth/invalid-email":
      return "ইমেইল ঠিকানাটি সঠিক নয়।";
    case "auth/weak-password":
      return "পাসওয়ার্ড খুব দুর্বল, কমপক্ষে ৬ অক্ষর দিন।";

    /* ── নেটওয়ার্ক / পরিবেশ ── */
    case "auth/network-request-failed":
      return "নেটওয়ার্ক সংযোগ নেই। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
    case "auth/internal-error":
    case "auth/timeout":
      return "Firebase সার্ভারে অস্থায়ী সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

    /* ── Google popup / redirect ── */
    case "auth/popup-closed-by-user":
      return "লগইন উইন্ডোটি বন্ধ হয়ে গেছে, তাই প্রক্রিয়া সম্পন্ন হয়নি। আবার চেষ্টা করুন।";
    case "auth/cancelled-popup-request":
      return "পূর্বের লগইন উইন্ডোটি বাতিল করা হয়েছে। আবার চেষ্টা করুন।";
    case "auth/popup-blocked":
      return "ব্রাউজার পপ-আপ উইন্ডো ব্লক করেছে। পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "এই ব্রাউজার/মোডে (যেমন প্রাইভেট ব্রাউজিং) লগইন সমর্থিত নয়। অন্য ব্রাউজার ব্যবহার করুন।";

    /* ── কনফিগারেশন (root-cause diagnostic) ── */
    case "auth/configuration-not-found":
      return CONFIG_NOT_FOUND_MESSAGE;
    case "auth/unauthorized-domain": {
      let host = "";
      try {
        host = window.location.host;
      } catch {
        /* SSR */
      }
      return UNAUTHORIZED_DOMAIN_MESSAGE(host || "বর্তমান সাইট");
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
    // নিজেদের তৈরি (বাংলা) ব্যবসায়িক বার্তা — যেমন "এই আইডির সাথে যুক্ত ইমেইল পাওয়া যায়নি।"
    const msg = err && typeof (err as any).message === "string" ? String((err as any).message) : "";
    if (msg && !/auth\/|Firebase:|firebase/i.test(msg) && msg.length <= 240) return msg;
  }
  try {
    // ডেভেলপারদের জন্য আসল কোড কনসোলে রাখি — UI-তে নয়।
    console.warn("[auth] unmapped firebase error:", code || (err as any)?.message || err);
  } catch {
    /* ignore */
  }
  return opts.fallback || "অপ্রত্যাশিত সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
}

/* ═══════════════════════════════════════════════════════════════════
   ২. Google সাইন-ইন — popup + redirect fallback
   ═══════════════════════════════════════════════════════════════════ */

export type GoogleProfile = { uid: string; email: string; name: string; photo: string };

const GOOGLE_INTENT_KEY = "cbdc.pendingGoogleIntent";

/** redirect-এ যাওয়ার আগে login না signup — সেটা মনে রাখা হয় (ট্যাব রিলোড বেঁচে যায়)। */
export function setGoogleIntent(intent: "login" | "signup" | null): void {
  try {
    if (intent) sessionStorage.setItem(GOOGLE_INTENT_KEY, intent);
    else sessionStorage.removeItem(GOOGLE_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

const GOOGLE_PROFILE_KEY = "cbdc.pendingGoogleProfile";

/** Google সাইন-ইন সফল হলে প্রোফাইল (uid/email/photo) মনে রাখা — signup ফর্ম রিলোডেও থাকে। */
export function setPendingGoogleProfile(profile: GoogleProfile | null): void {
  try {
    if (profile && profile.uid) sessionStorage.setItem(GOOGLE_PROFILE_KEY, JSON.stringify(profile));
    else sessionStorage.removeItem(GOOGLE_PROFILE_KEY);
  } catch {
    /* ignore */
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
    /* ignore */
  }
  return null;
}

/** ১১ সংখ্যার বাংলাদেশি মোবাইল (বাংলা অঙ্ক সহ)। */
export function isPhoneOk(value: unknown): boolean {
  return /^01[3-9]\d{8}$/.test(toEnglishDigits(value).replace(/\s/g, ""));
}

/**
 * Dashboard-এ ঢোকার জন্য ন্যূনতম প্রোফাইল: নাম + মোবাইল + জন্ম তারিখ।
 * এগুলো RTDB-তে থাকলে onboarding আর দেখানো হয় না।
 */
export function isProfileComplete(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const name = String(profile.name || "").trim();
  return name.length >= 2 && isPhoneOk(profile.phone) && isValidDob(profile.dob);
}

/** এই uid-এর সংরক্ষিত ছবি; না থাকলে (ঐচ্ছিক) Google ছবি। অন্য user-এর ছবি কখনোই ফেরত দেয় না। */
export function photoForUid(
  profile: Record<string, unknown> | null | undefined,
  googlePhoto?: string
): string {
  const existing = String(profile?.photoURL || profile?.photo || "").trim();
  if (existing) return existing;
  return String(googlePhoto || "").trim();
}

/** `users/{uid}` থেকে প্রোফাইল পড়া। */
export async function loadUserProfile(uid: string): Promise<Record<string, any> | null> {
  if (!uid) return null;
  try {
    return await getRow(NODES.users, uid);
  } catch (e) {
    console.warn("loadUserProfile:", (e as Error)?.message);
    return null;
  }
}

/**
 * মোবাইল ব্রাউজার ও ওয়েবভিউতে popup অবিশ্বাসী — সরাসরি redirect নিরাপদ।
 * (ইন-অ্যাপ ব্রাউজার যেমন Facebook/Instagram/Messenger webview-এ popup প্রায়ই ব্লক হয়।)
 */
export function shouldPreferRedirect(): boolean {
  try {
    const ua = navigator.userAgent || "";
    if (/\b(FBAN|FBAV|Instagram|Messenger|Line\/|TikTok)\b/i.test(ua)) return true; // webview
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** popup নিষ্ফলা হলে redirect করার উপযুক্ত কিনা — সেই error code গুলো। */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/network-request-failed", // মাঝে মাঝে popup channel আটকে গেলে এই code আসে
]);

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Google দিয়ে সাইন-ইন।
 *  - `intent`: "login" | "signup" — redirect fallback হলে sessionStorage-এ রাখা
 *    হয়, যাতে consumeGoogleRedirect() ফেরার পর ঠিক flow চালু রাখতে পারে।
 *  - রিটার্ন: UserCredential, অথবা `null` যদি redirect শুরু হয়ে যায়
 *    (পেজ এখন Google-এ চলে যাচ্ছে — পরবর্তী লোডে consumeGoogleRedirect() থামিয়ে দেবে)।
 *  - ব্যবহারকারী popup বন্ধ করলে error throw হয় (code: auth/popup-closed-by-user)।
 */
export async function googleSignInWithFallback(
  auth: Auth,
  intent: "login" | "signup"
): Promise<UserCredential | null> {
  if (shouldPreferRedirect()) {
    setGoogleIntent(intent);
    await signInWithRedirect(auth, buildGoogleProvider());
    return null; // সাধারণত এখানে আসে না — পেজ নেভিগেট করে যায়
  }
  try {
    return await signInWithPopup(auth, buildGoogleProvider());
  } catch (err) {
    const code = authErrorCode(err);
    if (REDIRECT_FALLBACK_CODES.has(code)) {
      // popup ব্যর্থ → redirect-এ fallback (মোবাইল/পপ-আপ-ব্লকার নিরাপদ)
      try {
        setGoogleIntent(intent);
        await signInWithRedirect(auth, buildGoogleProvider());
        return null;
      } catch (redirectErr) {
        // redirect-ও ব্যর্থ হলে আসল popup error-টা কার্যকর — সেটাই ফেরত দিই
        console.warn("Google redirect fallback failed:", redirectErr);
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Google redirect থেকে ফেরার পর ফলাফল পড়ে।
 *  - রিটার্ন: `{ profile, intent }` — redirect দিয়ে সফল login হলে,
 *    অথবা `null` — redirect হয়নি / সাফল্য ছাড়া ফিরেছে।
 *  - error throw করে যদি redirect ব্যর্থ হয় (UI-তে authErrorMessage দেখান)।
 */
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
    /* ignore */
  }
  let result: UserCredential | null = null;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    setGoogleIntent(null);
    throw err;
  }
  if (!result || !result.user) {
    if (hadIntent) setGoogleIntent(null); // বাতিল/ব্যর্থ redirect — অবশিষ্ট intent পরিষ্কার
    return null;
  }
  const u = result.user;
  return {
    profile: {
      uid: u.uid,
      email: u.email || "",
      name: u.displayName || "",
      photo: u.photoURL || "",
    },
    intent,
  };
}

/** Firebase-এ sign-in/sign-out state পরিবর্তনের ছোট wrapper। */
export function onAuthUserChanged(auth: Auth, cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/* ═══════════════════════════════════════════════════════════════════
   ৩. Realtime Database user profile upsert
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Login/signup সফল হলে `users/{uid}` প্রোফাইল তৈরি বা আপডেট করে।
 *  - merge আপডেট — তাই অ্যাডমিন-নির্ধারিত role/status বা আগের তথ্য নষ্ট হয় না।
 *  - নতুন রেকর্ডে role:"donor", status:"active" ডিফল্ট বসে।
 *  - এখানে লেখা হলে RTDB listener-এর কল্যাণে সব dashboard-এ সাথে সাথে দেখা যায়।
 */
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
    username?: string;
    address?: string;
  },
  extra: { provider?: string } = {}
): Promise<void> {
  if (!user || !user.uid) return;
  const existing = await getRow(NODES.users, user.uid);
  /* ছবি: আগে থেকে RTDB-তে থাকলে সেটাই রাখি — অন্য user বা খালি Google ছবি দিয়ে মুছে ফেলি না */
  const photoURL = String(existing?.photoURL || user.photo || "").trim();
  const base: Record<string, unknown> = {
    uid: user.uid,
    email: String(user.email || existing?.email || "").toLowerCase(),
    name: user.name || existing?.name || "",
    photoURL,
    updatedAt: nowIso(),
  };
  const keep = (incoming: unknown, prev: unknown) => {
    const v = String(incoming || "").trim();
    if (v) return v;
    const p = String(prev || "").trim();
    return p || undefined;
  };
  const dob = keep(user.dob, existing?.dob);
  const phone = keep(user.phone, existing?.phone);
  const gender = keep(user.gender, existing?.gender);
  const area = keep(user.area, existing?.area);
  const username = keep(user.username, existing?.username);
  const address = keep(user.address, existing?.address);
  if (dob) base.dob = dob;
  if (phone) base.phone = phone;
  if (gender) base.gender = gender;
  if (area) base.area = area;
  if (username) base.username = username;
  if (address) base.address = address;
  if (extra.provider) base.provider = extra.provider;
  if (!existing) {
    base.role = "donor";
    base.status = "active";
    base.createdAt = nowIso();
    await setRow(NODES.users, user.uid, base);
    return;
  }
  await updateRow(NODES.users, user.uid, base);
}

/* ═══════════════════════════════════════════════════════════════════
   ৪. Role — একটিই সিদ্ধান্তকেন্দ্র (RTDB)
   ═══════════════════════════════════════════════════════════════════ */

export type AppRole = "donor" | "moderator" | "admin";

export interface ResolvedRole {
  role: AppRole;
  name: string;
  permissions: string[] | Record<string, unknown>;
  /** RTDB `admins` নোডের রেকর্ড (থাকলে) — প্যানেলের designation/username ইত্যাদি। */
  staff: Record<string, any> | null;
}

/** RTDB-র role লেখা (super/mod ইত্যাদি) অ্যাপের তিনটি role-এ মেলানো। */
function normaliseRole(raw: unknown): AppRole | null {
  const r = String(raw || "").toLowerCase();
  if (r === "admin" || r === "super" || r === "superadmin") return "admin";
  if (r === "moderator" || r === "mod") return "moderator";
  if (r === "donor" || r === "user" || r === "member") return "donor";
  return null;
}

/**
 * একজন ব্যবহারকারীর কার্যকর role বের করা — **শুধু ডাটাবেস থেকে**।
 *
 *   ১. `admins/{uid}` — staff রেকর্ড (সবচেয়ে নির্ভরযোগ্য, uid দিয়ে)
 *   ২. `admins` node-এ email দিয়ে খোঁজা (uid এখনো ম্যাপ না হলে)
 *   ৩. `users/{uid}` — সাধারণ ব্যবহারকারী (role না থাকলে ডিফল্ট donor)
 *
 * `admins`-এ না থাকলে কেউ কখনো admin/moderator হতে পারে না — `users` নোডে
 * role লেখা থাকলেও তা গ্রাহ্য নয় (নিরাপত্তা)।
 */
export async function resolveUserRole(
  user: { uid?: string; email?: string; name?: string } | null | undefined
): Promise<ResolvedRole> {
  const out: ResolvedRole = { role: "donor", name: user?.name || "", permissions: [], staff: null };
  if (!user) return out;
  const uid = String(user.uid || "");
  const email = String(user.email || "").toLowerCase();

  let staff: Record<string, any> | null = null;
  try {
    if (uid) staff = await getRow(NODES.admins, uid);
    if (!staff && email) staff = await findBy(NODES.admins, "email", email);
  } catch (e) {
    console.warn("role lookup (admins):", (e as Error)?.message);
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

  try {
    let profile: Record<string, any> | null = uid ? await getRow(NODES.users, uid) : null;
    if (!profile && email) profile = await findBy(NODES.users, "email", email);
    if (profile) {
      out.name = profile.name || out.name;
      // users নোডে admin/moderator লেখা থাকলেও তা উপেক্ষা করা হয়
      out.role = "donor";
    }
  } catch (e) {
    console.warn("role lookup (users):", (e as Error)?.message);
  }
  return out;
}

/** role অনুযায়ী কোন পেজ/প্যানেল খুলবে — সব জায়গায় একই নিয়ম। */
export function panelForRole(role: unknown): "doner" | "moderator" | "admin" {
  const r = normaliseRole(role) || "donor";
  if (r === "admin") return "admin";
  if (r === "moderator") return "moderator";
  return "doner";
}

/* ═══════════════════════════════════════════════════════════════════
   ৫. পাসওয়ার্ড রিসেট — Firebase-এর built-in link (custom OTP নেই)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * রিসেট লিংকে ক্লিক করলে ব্যবহারকারী **এই সাইটেরই** সুন্দর reset পেজে আসবে
 * (`/reset-password?oobCode=…`)। Firebase Console → Authentication → Templates →
 * Password reset-এ "Customize action URL" হিসেবেও এই ঠিকানাটিই বসাতে হবে,
 * তাহলে ইমেইল ও ওয়েবসাইট — দুটোরই branding মিলে যাবে।
 */
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

/** ইমেইলে Firebase-এর password reset link পাঠায়। */
export async function requestPasswordReset(auth: Auth, email: string): Promise<void> {
  const address = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw new Error("সঠিক ইমেইল ঠিকানা দিন।");
  }
  const settings = resetActionSettings();
  try {
    await sendPasswordResetEmail(auth, address, settings);
  } catch (err) {
    // continue URL অনুমোদিত না হলে (auth/unauthorized-continue-uri) সাধারণ লিংকেই পাঠাই
    if (authErrorCode(err) === "auth/unauthorized-continue-uri") {
      await sendPasswordResetEmail(auth, address);
      return;
    }
    throw err;
  }
}

/** রিসেট লিংকের কোড যাচাই — বৈধ হলে সংশ্লিষ্ট ইমেইল ফেরত দেয়। */
export async function verifyResetCode(auth: Auth, oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, String(oobCode || ""));
}

/** নতুন পাসওয়ার্ড সেট করা (রিসেট লিংক থেকে)। */
export async function completePasswordReset(
  auth: Auth,
  oobCode: string,
  newPassword: string
): Promise<void> {
  await confirmPasswordReset(auth, String(oobCode || ""), String(newPassword || ""));
}
