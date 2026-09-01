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
  assert.match(home, /isProfileComplete\(existingProfile\)/);
  assert.match(home, /outcome\.reason === "email-conflict"/);
});

test("signup submit locks immediately, loads, then unlocks in finally", () => {
  assert.match(home, /let signupBusy = false/);
  assert.match(home, /if\(signupBusy\) return/);
  assert.match(home, /submitBtn\.innerHTML = "তৈরি হচ্ছে\.\.\."/);
  const click = home.indexOf('if(signupBusy) return');
  const loading = home.indexOf("showAppLoading();", click);
  const create = home.indexOf("createUserWithEmailAndPassword", loading);
  const dups = home.indexOf('lookupLoginKey("username",o.username)', loading);
  assert.ok(click >= 0 && loading > click && dups > loading && create > dups);
  assert.match(home, /}finally\{\s*signupBusy = false/);
  assert.match(home, /submitBtn\.disabled = false/);
});

test("signup duplicate lookups run in parallel without dropping uniqueness", () => {
  assert.match(home, /Promise\.all\(\[/);
  assert.match(home, /NODES\.users, "email", o\.email/);
  assert.match(home, /NODES\.users, "phone"/);
  assert.match(home, /NODES\.users, "username", o\.username/);
  assert.match(home, /NODES\.members, "phone"/);
  assert.match(home, /NODES\.members, "username", o\.username/);
  assert.match(home, /lookupLoginKey\("username",o\.username\)/);
});

test("login submit locks while in-flight and unlocks in finally", () => {
  assert.match(home, /let loginBusy = false/);
  assert.match(home, /if\(loginBusy\) return/);
  assert.match(home, /_btn\.innerHTML="লগইন হচ্ছে\.\.\."/);
  assert.match(home, /}finally\{\s*loginBusy = false/);
});

test("signup duplicate check treats loginIndex email / current uid as self", () => {
  assert.match(home, /duplicateRowIsSelf/);
  assert.match(home, /\{ uid: dupOwnerUid, email: o\.email \}/);
});

test("guest donor register always writes ownerUid so queue rules allow pending", () => {
  assert.match(home, /ownerUid: registrationUid \|\| ""/);
});

test("identity claim re-claims own uid, retries, and defers writes to the server", () => {
  assert.match(identity, /export function nextIdentityUid/);
  assert.match(identity, /current !== cleanUid/);
  assert.match(identity, /for \(let i = 0; i < 3; i\+\+\)/);
  /* ক্লেইম এখন সার্ভারে CAS দিয়ে হয় — ক্লায়েন্ট আর লোকালি apply করে না */
  assert.match(identity, /apiClaimEmail\(address\)/);
  const profile = read("server/profileApi.ts");
  const claim = profile.slice(profile.indexOf("export async function handleClaimEmail"));
  assert.match(claim, /cur === uid\) return \{ ok: true, status: "claimed" \}/);
  assert.match(claim, /const verify = await io\.get\(path\)/);
});

test("identityIndex claim may re-claim own uid; release deletes own entry (server-side)", () => {
  assert.match(rules, /"\.write": false/);
  const profile = read("server/profileApi.ts");
  const claim = profile.slice(profile.indexOf("export async function handleClaimEmail"));
  /* নিজের uid হলে re-claim ok; অন্যের uid হলে conflict */
  assert.match(claim, /cur !== uid\) \{[\s\S]*?status: "conflict"/);
  /* release শুধু নিজের entry-ই মুছে */
  assert.match(claim, /cur === uid\) \{[\s\S]*?await io\.patch\(\{ \[path\]: null \}\)/);
});
