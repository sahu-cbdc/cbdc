/**
 * Account-creation wiring: orphan-auth recovery, self-duplicate check,
 * identity claim reducer, guest donor queue write.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const home = read("src/pages/Home.tsx");
const identity = read("src/lib/identity.ts");
const rules = read("database.rules.json");

test("signup resumes a previous Auth user instead of aborting on email-already-in-use", () => {
  assert.match(home, /createUserWithEmailAndPassword/);
  assert.match(home, /auth\/email-already-in-use/);
  assert.match(home, /signInWithEmailAndPassword/);
  assert.match(home, /alreadyEmail === o\.email/);
  assert.match(home, /isProfileComplete\(existingMember\)/);
  assert.match(home, /outcome\.reason === "email-conflict"/);
});

test("signup duplicate check treats loginIndex email / current uid as self", () => {
  assert.match(home, /duplicateRowIsSelf/);
  assert.match(home, /\{ uid: dupOwnerUid, email: o\.email \}/);
});

test("guest donor register always writes ownerUid so queue rules allow pending", () => {
  assert.match(home, /ownerUid: registrationUid \|\| ""/);
});

test("identity claim re-claims own uid, retries, and does not apply locally", () => {
  assert.match(identity, /export function nextIdentityUid/);
  assert.match(identity, /current !== cleanUid/);
  assert.match(identity, /applyLocally:\s*false/);
  assert.match(identity, /for \(let i = 0; i < 3; i\+\+\)/);
});

test("identityIndex claim may re-claim own uid; validate allows delete", () => {
  assert.match(rules, /newData\.val\(\) === auth\.uid/);
  assert.match(rules, /!newData\.exists\(\) \|\| \(newData\.isString\(\)/);
});
