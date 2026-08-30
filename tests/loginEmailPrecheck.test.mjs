import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const home = readFileSync(path.join(process.cwd(), "src/pages/Home.tsx"), "utf8");

test("Login with email goes straight to signInWithEmailAndPassword (no fetchSignInMethodsForEmail precheck)", () => {
  // fetchSignInMethodsForEmail returns an empty list when Email Enumeration
  // Protection is enabled, so a precheck would wrongly report "no account found"
  // even for valid credentials. The login flow must not gate on it.
  assert.doesNotMatch(home, /signInMethodsForEmail\s*\(/);           // no precheck call remains
  assert.doesNotMatch(home, /import\s*\{[\s\S]*?signInMethodsForEmail/); // helper no longer imported
});

test("Login still resolves email before signing in and reports auth errors", () => {
  assert.match(home, /resolveEmailByIdentifier\s*\(\s*email\s*\)/);
  assert.match(home, /signInWithEmailAndPassword\s*\(\s*auth\s*,\s*email\s*,\s*password\s*\)/);
  assert.match(home, /auth\/user-not-found/);
  assert.match(home, /এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি/);
});
