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
  assert.match(home, /resolveEmailForLogin\s*\(\s*authFlowIo\s*,\s*identifier\s*\)/);
  assert.match(home, /signInWithEmailAndPassword\s*\(\s*auth\s*,\s*email\s*,\s*password\s*\)/);
  assert.match(home, /auth\/user-not-found/);
  assert.match(home, /এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি/);
});

test("Login normalizes identifier: trims surrounding whitespace and lowercases (email + username)", () => {
  // Leading/trailing spaces are stripped and the value is lowercased for both
  // email and username; the password is taken verbatim (never trimmed).
  assert.match(
    home,
    /const\s+identifier\s*=\s*String\s*\(\s*\$\(\s*"#username"\s*\)\s*\.value\s*\|\|\s*""\s*\)\s*\.trim\s*\(\s*\)\s*\.toLowerCase\s*\(\s*\)/
  );
  assert.match(home, /const\s+password\s*=\s*\$\(\s*"#password"\s*\)\s*\.value\s*;/);
});

test("Username login resolves the account email via loginIndex then signs in", () => {
  assert.match(home, /resolveEmailForLogin\s*\(\s*authFlowIo\s*,\s*identifier\s*\)/);
  assert.doesNotMatch(home, /if\s*\(\s*!email\.includes\s*\(\s*"@"\s*\)\s*\)\s*\{[\s\S]*?resolveEmailByIdentifier/);
});

test("loginIndex entries are claimed at signup and backfilled at login", () => {
  // signup path: index the username/phone so username login works immediately
  assert.match(home, /finalizeEmailSignup\s*\(\s*authFlowIo\s*,\s*\{/);
  // signup path: authFlowIo.claimLogin calls claimLoginEntries so loginIndex is indexed
  assert.match(home, /claimLogin:\s*\(\s*email\s*,\s*username\s*,\s*phone\s*\)\s*=>\s*claimLoginEntries\s*\(\s*email\s*,\s*username\s*,\s*phone\s*\)/);
  // login path: backfill the index for accounts created before it existed
  assert.match(home, /backfillLoginIndex\s*\(\s*authFlowIo\s*,\s*email\s*,\s*profile\.username\s*,\s*profile\.phone\s*\)/);
});
