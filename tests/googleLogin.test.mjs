import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const home = readFileSync(path.join(process.cwd(), "src/pages/Home.tsx"), "utf8");
const authx = readFileSync(path.join(process.cwd(), "src/lib/authx.ts"), "utf8");

test("Google login and signup buttons are wired to the Google flow", () => {
  // Existing buttons must remain (no UI change) and each must drive googleSignIn.
  assert.match(home, /id="btnGoogleLogin"/);
  assert.match(home, /id="btnGoogleSignup"/);
  assert.match(home, /Google দিয়ে লগইন করুন/);
  assert.match(home, /Google দিয়ে অ্যাকাউন্ট তৈরি করুন/);
  assert.match(home, /googleSignIn\s*\(\s*"login"\s*\)/);
  assert.match(home, /googleSignIn\s*\(\s*"signup"\s*\)/);
  // Both complete the same post-auth flow (continueGoogleAuth).
  assert.match(home, /continueGoogleAuth\s*\(\s*p\s*,\s*"login"\s*\)/);
  assert.match(home, /continueGoogleAuth\s*\(\s*p\s*,\s*"signup"\s*\)/);
});

test("googleSignIn drives Firebase Google auth and captures the profile", () => {
  // popup first, redirect fallback handled inside authx.
  assert.match(home, /googleSignInWithFallback\s*\(\s*auth\s*,/);
  // Build the GoogleProfile from the Firebase user and persist it for the
  // signup form (which may reload the page).
  assert.match(home, /profileFromFirebaseUser\s*\(\s*u\s*\)/);
  assert.match(home, /setPendingGoogleProfile\s*\(\s*profile\s*\)/);
});

test("Google auth uses popup with redirect fallback and consumes the redirect result", () => {
  assert.match(authx, /signInWithPopup\s*\(\s*auth\s*,\s*buildGoogleProvider\s*\(\s*\)\s*\)/);
  assert.match(authx, /signInWithRedirect\s*\(\s*auth\s*,\s*buildGoogleProvider\s*\(\s*\)\s*\)/);
  assert.match(authx, /getRedirectResult\s*\(\s*auth\s*\)/);
  // intent survives the redirect round-trip via sessionStorage.
  assert.match(authx, /setGoogleIntent\s*\(\s*intent\s*\)/);
});

test("Successful Google auth redirects to the logged-in page", () => {
  // finishLogin dispatches by role and navigates to the panel.
  assert.match(home, /panelForRole\s*\(\s*r\s*\)/);
  assert.match(home, /navigateToPage\s*\(\s*page\s*\)/);
  // Existing account is reused (no duplicate) and completes via finishFromRtdb.
  assert.match(home, /finishFromRtdb\s*\(\s*p\s*,\s*member\s*,/);
  assert.match(home, /ensureUserProfile\s*\(/);
});

test("Google redirect is resumed on boot via consumeGoogleRedirect", () => {
  assert.match(home, /resumeGoogleRedirect\s*\(\)/);
  assert.match(home, /consumeGoogleRedirect\s*\(\s*auth\s*\)/);
  assert.match(home, /cbdc\.pendingGoogleIntent/);
});
