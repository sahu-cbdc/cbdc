/**
 * CBDC — Google Sign-In / Firebase Authentication audit
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  এই স্ক্রিপ্টটি request-এর ১৫টি check static source-level-এ যাচাই করে:
 *    ১. Google দিয়ে নতুন Account তৈরি (GoogleAuthProvider + popup/redirect)
 *    ২. Google দিয়ে existing Account login
 *    ৩. একই Google account-এ duplicate account তৈরি হয় না
 *    ৪. Firebase Authentication-এ user তৈরি হয় (official Firebase Web SDK)
 *    ৫. Firebase UID primary identity হিসেবে ব্যবহৃত হয় (`users/{uid}`)
 *    ৬. Existing Email/Password Login/Signup অক্ষত
 *    ৭. Firebabe Realtime Database ব্যবহৃত হয়
 *    ৮. Admin/Moderator/User role system অক্ষত
 *    ৯./১০. chawkbazarbloodclub.com ও www... Authorized domains verify
 *    ১১. Authentication-এর জন্য unnecessary full-page reload নেই
 *    ১২. Duplicate auth listener নেই (single `onAuthStateChanged`)
 *    ১৩. Frontend-এ কোনো secret credential নেই
 *    ১৪. Google Error handling (popup/cancel/blocked/unauthorized/config/dup/network)
 *    ১৫. Google Login UI/UX element অপরিবর্তিত (btn-google Login/Signup)
 *
 * Run with:  npm run verify-google-auth
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (src, re) => re.test(src);

console.log("\n── ১–৫. Google Sign-In official Firebase Web SDK ──");
const authx = read("src/lib/authx.ts");
const authState = read("src/lib/authState.ts");
const firebase = read("src/lib/firebase.ts");

ok(has(authx, /import\s*\{[^}]*GoogleAuthProvider[\s\S]*?\}\s*from\s*["']firebase\/auth["']/),
  "GoogleAuthProvider — official Firebase Web SDK import");
ok(has(authx, /signInWithPopup\s*\(/) && has(authx, /signInWithRedirect\s*\(/) && has(authx, /getRedirectResult\s*\(/),
  "popup + redirect Google শুধু Firebase SDK-এর official flow ব্যবহার করে");
ok(has(authx, /new GoogleAuthProvider\(\)/) && has(authx, /setCustomParameters\(\{\s*prompt:\s*["']select_account["']\s*\}/),
  "Google account selection prompt ('select_account')");
ok(!/google\.accounts|gapi(?:\.|\s+\.)|token\s*:\s*["'][A-Za-z0-9-_]{15,}/.test(authx),
  "কোনো manual Google Cloud OAuth / gapi / raw token flow নেই");

ok(has(authx, /ensureUserProfile\s*\(/) && has(authx, /getRow\s*\(\s*NODES\.users\s*,\s*user\.uid\s*\)/) &&
  has(authx, /setRow\s*\(\s*NODES\.users\s*,\s*user\.uid\s*,/) &&
  has(authx, /updateRow\s*\(\s*NODES\.users\s*,\s*user\.uid\s*,/),
  "Firebase UID → RTDB `users/{uid}` (primary identity), existing row-এ merge");
ok(has(authx, /if\s*\(\s*!existing\s*\)/) && has(authx, /existing\.donorId|existing\.donorStatus/) &&
  has(authx, /donorStatus\s*=\s*["']pending["']/),
  "new Google user → account তৈরি, existing user → profile merge (duplicate নয়)");

ok(has(authx, /findUserByUid|findUserByEmail|continueGoogleAuth|findBy\s*\(\s*NODES\.users/) ||
   has(read("src/pages/Home.tsx"), /findUserByUid\s*\(\s*p\.uid\s*\)/),
  "existing Google account → UID/email দিয়ে আগের account-ই ব্যবহৃত হয়");

console.log("\n── ৬–৮. Email/Password + RTDB + role system অক্ষত ──");
const home = read("src/pages/Home.tsx");
ok(has(home, /signInWithEmailAndPassword\s*\(/) && has(home, /createUserWithEmailAndPassword\s*\(/),
  "Email/Password Login ও Signup (firebase/auth) অক্ষত");
ok(has(firebase, /getDatabase\s*\(/) && has(read("src/lib/rtdb.ts"), /from\s*["']firebase\/database["']/),
  "Firebase Realtime Database ব্যবহৃত (src/lib/rtdb.ts)");
ok(has(authx, /resolveUserRole\s*\(/) && has(authx, /panelForRole\s*\(/) &&
  has(authx, /NODES\.admins/) && has(authx, /staff\.role|r\s*===\s*["']admin["']|["']admin["']\s*:\s*["']admin["']/),
  "Admin/Moderator/User role system (admins/{uid} → resolveUserRole → panelForRole)");

console.log("\n── ৯–১০. Authorized domains (production) ──");
ok(has(authx, /["']chawkbazarbloodclub\.com["']/) && has(authx, /["']www\.chawkbazarbloodclub\.com["']/),
  "AUTHORIZED_HOSTS-এ দুটি production domain আছে");
ok(has(authx, /isKnownAuthorizedHost\s*\(/) && has(authx, /currentHost\s*\(/),
  "currentHost + isKnownAuthorizedHost helper আছে");
ok(has(authx, /auth\/unauthorized-domain/) && has(authx, /AUTHORIZED_HOSTS\.join/),
  "unauthorized-domain হলে user-friendly bangla message (দুটি domain উল্লেখসহ)");

console.log("\n── ১১. Authentication-এর জন্য unnecessary page reload নেই ──");
ok(!/\blocation\.reload\s*\(/.test(authx) && !/window\.location\.reload\s*\(/.test(authx),
  "src/lib/authx.ts — Google flow-এ কোনো reload নেই");
ok(!/\bwindow\.location\.(assign|href)\s*=/.test(authx),
  "Google sign-in helper নিজে full page navigation করে না (login→panel navigation ছাড়া)");
ok(has(authState, /onAuthStateChanged\s*\(/) && !/navigateToPage|location\.reload|location\.assign/.test(authState),
  "auth-state observer কেন্দ্রীয় ও reload-mukta");

console.log("\n── ১২. Duplicate auth listener নেই ──");
const srcFiles = ["src/lib/authState.ts", "src/lib/store.ts", "src/lib/authx.ts",
  "src/pages/Home.tsx", "src/pages/Doner.tsx", "src/pages/Admin.tsx", "src/pages/Moderator.tsx"];
const authListenerCalls = srcFiles
  .map((f) => ({ f, n: [...read(f).matchAll(/onAuthStateChanged\s*\(/g)].length }));
const totalListenerCalls = authListenerCalls.reduce((s, x) => s + x.n, 0);
ok(totalListenerCalls === 1,
  "source-এ ঠিক একটি `onAuthStateChanged(` কল আছে", authListenerCalls.filter((x) => x.n > 0).map((x) => `${x.f}=${x.n}`).join(", "));
ok(!has(read("src/pages/Admin.tsx"), /const\s*\{\s*onAuthStateChanged\s*\}/) &&
   !has(read("src/pages/Moderator.tsx"), /const\s*\{\s*onAuthStateChanged\s*\}/) &&
   !has(read("src/pages/Doner.tsx"), /const\s*\{\s*onAuthStateChanged\s*\}/),
  "Home/Admin/Moderator/Doner নিজে আর raw onAuthStateChanged লিসেনার নিবন্ধন করে না");
ok(has(authState, /subscribeAuthUser\s*\(/) && has(authState, /waitForAuthUser\s*\(/),
  "সব জায়গা একই shared listener-এর subscriber (subscribeAuthUser / waitForAuthUser)");

console.log("\n── ১৩. Frontend-এ কোনো secret credential নেই ──");
const clientSrc = ["src/lib/authx.ts", "src/lib/authState.ts", "src/lib/firebase.ts", "src/lib/store.ts",
  "src/pages/Home.tsx", "src/pages/Doner.tsx", "src/pages/Admin.tsx", "src/pages/Moderator.tsx"]
  .map(read).join("\n");
const serverSrc = ["server/index.ts", "server/httpIo.ts", "server/deleteApi.ts"].map(read).join("\n");
ok(!/client_secret|clientSecret|service_account|private_key\s*[:=]|BEGIN \w*PRIVATE KEY/i.test(clientSrc),
  "client source-এ OAuth client secret / service-account / private key নেই");
ok(!/from\s*["']firebase\-admin["']|require\s*\(\s*["']firebase\-admin["']\s*\)|admin\.credential/i.test(clientSrc + serverSrc),
  "Firebase Admin SDK কোথাও নেই (client বা server)");
const PREFIX = "AIzaSyBxUlGig2NtQLf6tZMRwK6xxzjScNIqbrM";
const firebaseApiKeys = [...firebase.matchAll(/AIza[0-9A-Za-z_-]{35}/g)].map((m) => m[0]);
ok(firebaseApiKeys.every((k) => k === PREFIX), "client-এ শুধু এই প্রজেক্টের public web API key আছে", firebaseApiKeys.join(", "));
ok(has(firebase, /public client-side identifiers/) || has(firebase, /public-safe/),
  "config public-safe — document আছে");

console.log("\n── ১৪. Google Error handling ──");
const errorCodes = [
  "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/popup-blocked",
  "auth/unauthorized-domain", "auth/configuration-not-found", "auth/account-exists-with-different-credential",
  "auth/network-request-failed", "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
];
for (const code of errorCodes) {
  ok(has(authx, new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))),
    `error handled: ${code}`);
}
ok(has(read("src/pages/Home.tsx"), /handleGoogleAuthError\s*\(/) &&
   has(read("src/pages/Home.tsx"), /auth\/popup-closed-by-user/) &&
   has(read("src/pages/Home.tsx"), /auth\/account-exists-with-different-credential/),
  "Google UI-তে cancel/duplicate-credential ব্যবহারকারীবান্ধব বার্তা দেখায়");

console.log("\n── ১৫. Google Login UI/UX element অপরিবর্তিত ──");
ok(has(home, /id="btnGoogleLogin"/) && has(home, /id="btnGoogleSignup"/),
  "Google Login ও Signup বাটন existing ID-তে আছে");
ok(has(home, /btnGoogleLogin|btnGoogleSignup/) && has(home, /\.btn-google/),
  "existing `.btn-google` style ও click handler ব্যবহৃত (নতুন UI নয়)");
ok(has(home, /"Google দিয়ে লগইন করুন"/) && has(home, /"Google দিয়ে অ্যাকাউন্ট তৈরি করুন"/),
  "Client-facing Google button text অপরিবর্তিত");

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL GOOGLE AUTH CHECKS PASSED");
process.exit(failures ? 1 : 0);
