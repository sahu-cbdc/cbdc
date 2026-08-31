/**
 * Item 10 — Realtime sync & single source of truth regression suite
 * ═══════════════════════════════════════════════════════════════════════════
 * Covers:
 *   1. shared store donor converters — round-trip safe (Admin/Moderator
 *      persist() কোনো donor ফিল্ড মুছে দিতে পারে না — appliedAt/createdAt/
 *      health/fcmToken/cardTheme/updatedAt ইত্যাদি অক্ষত থাকে)
 *   2. live role change — Admin/Moderator/Doner প্যানেল users/{uid}/role-এ
 *      বদল দেখে reload ছাড়াই সঠিক প্যানেলে চলে যায় (loop-guard সহ)
 *   3. linked account sync — Admin/Moderator ডোনার রেকর্ড বদলালে
 *      users/{ownerUid}-ও একই তথ্যে হালনাগাদ হয় (কোনো প্যানেল stale নয়)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const store = read("src/lib/store.ts");
const admin = read("src/pages/Admin.tsx");
const moderator = read("src/pages/Moderator.tsx");
const doner = read("src/pages/Doner.tsx");

/* ══════════ 1. Round-trip safe donor converters ══════════ */

test("Store converters preserve every donor field through an Admin round trip", () => {
  const to = store.slice(store.indexOf("const toAdminDonor"), store.indexOf("const fromAdminDonor"));
  const from = store.slice(store.indexOf("const fromAdminDonor"), store.indexOf("const toDonerDonor"));
  /* toAdminDonor — source row spread হয়, canonical key পরে override করে */
  assert.match(to, /const toAdminDonor = \(d: any\) => \(\{\s*\.\.\.d,/);
  /* fromAdminDonor — spread + শুধু `age` (computed) বাদ; বাকি সব ফিল্ড অক্ষত */
  assert.match(from, /const out: any = \{ \.\.\.d \};/);
  assert.match(from, /delete out\.age/);
  assert.match(from, /Object\.assign\(out, \{/);
  /* Doner converters-ও একই নিয়ম */
  const toD = store.slice(store.indexOf("const toDonerDonor"), store.indexOf("const fromDonerDonor"));
  const fromD = store.slice(store.indexOf("const fromDonerDonor"), store.indexOf("const store = {"));
  assert.match(toD, /const toDonerDonor = \(d: any\) => \(\{\s*\.\.\.d,/);
  assert.match(fromD, /const fromDonerDonor = \(d: any\) => \(\{\s*\.\.\.d,/);
});

test("Admin/Moderator publishSharedState still routes donors through the store (single source)", () => {
  /* Admin ও Moderator দুটোতেই একই lossy-path নেই — store converter-ই একমাত্র
     round trip, এবং তা এখন field-preserving */
  assert.match(admin, /st\.donors=DB\.donors\.map\(CBDCShared\.fromAdminDonor\)/);
  assert.match(moderator, /st\.donors=DB\.donors\.map\(CBDCShared\.fromAdminDonor\)/);
});

/* ══════════ 2. Live role change ══════════ */

test("Admin panel reacts to its own role/permission change live (no reload)", () => {
  const wm = admin.slice(admin.indexOf("let meSeenRole"), admin.indexOf("function deviceId"));
  assert.match(wm, /let meSeenRole=""/);
  assert.match(wm, /watchRow\(NODES\.users,uid,async \(row\)=>/);
  assert.match(wm, /const rawRole=String\(\(row&&row\.role\)\|\|""\)\.toLowerCase\(\)/);
  assert.match(wm, /if\(rawRole!==meSeenRole\)/);
  assert.match(wm, /resolveUserRole\(\{uid:ME\.uid,email:ME\.email,name:ME\.name\},\{knownProfile:row\|\|null\}\)/);
  assert.match(wm, /const target=panelForRole\(resolved\.role\)/);
  assert.match(wm, /if\(target!==PANEL\.id\)/);
  assert.match(wm, /navigateToPage\(target\)/);
  /* permission বদল → nav ছাড়াই মেনু repaint */
  assert.match(wm, /const staffRow=accountAdmins\.find/);
  assert.match(wm, /permsChanged\|\|nr!==ME\.role/);
  assert.match(wm, /paintNav\(\);paintTop\(\)/);
});

test("Moderator panel reacts to its own role/permission change live (no reload)", () => {
  const wm = moderator.slice(moderator.indexOf("let meSeenRole"), moderator.indexOf("function deviceId"));
  assert.match(wm, /let meSeenRole=""/);
  assert.match(wm, /watchRow\(NODES\.users,uid,async \(row\)=>/);
  assert.match(wm, /const rawRole=String\(\(row&&row\.role\)\|\|""\)\.toLowerCase\(\)/);
  assert.match(wm, /resolveUserRole\(\{uid:ME\.uid,email:ME\.email,name:ME\.name\},\{knownProfile:row\|\|null\}\)/);
  assert.match(wm, /if\(target!==PANEL\.id\)/);
  assert.match(wm, /navigateToPage\(target\)/);
  /* কাঁচা admins rows রাখা হয় নিজের permission live দেখতে */
  assert.match(moderator, /let moderatorAdminRows:any\[\]=\[\]/);
  assert.match(moderator, /moderatorAdminRows=rows;/);
  assert.match(wm, /moderatorAdminRows\|\|\[\]\)\.find/);
});

test("Doner panel reacts to promotion live and never loops on incomplete promotion", () => {
  /* লগইনে role-এর বর্তমান মান ধরে রাখা হয় — প্রথম callback-এ ভুয়া navigation নয় */
  assert.match(doner, /let donerSeenRole=""/);
  assert.match(doner, /donerSeenRole = String\(\(row && row\.role\) \|\| ""\)\.toLowerCase\(\);/);
  const wp = doner.slice(doner.indexOf("function watchMyProfile"), doner.indexOf("(async function syncAuthSession"));
  assert.ok(wp.length > 0, "watchMyProfile slice not empty");
  assert.match(wp, /const rowRole = String\(\(row && row\.role\) \|\| ""\)\.toLowerCase\(\);/);
  assert.match(wp, /rowRole !== donerSeenRole/);
  assert.match(wp, /navigateToPage\(rowRole === "admin" \? "admin" : "moderator"\)/);
  /* একই মানে আবার navigation হয় না — bounce loop guard */
  assert.match(wp, /if \(rowRole === "donor" \|\| rowRole === "user" \|\| rowRole === ""\) donerSeenRole = rowRole;/);
});

/* ══════════ 3. Linked account sync (stale-data fix) ══════════ */

test("Admin donor edits sync the linked account so no panel shows stale data", () => {
  assert.match(admin, /const LINKED_ACCOUNT_KEY:Record<string,string>=\{\s*name:"name",gender:"gender",dob:"dob",phone:"phone",group:"bloodGroup",area:"area",last:"lastDonation"\s*\}/);
  assert.match(admin, /async function syncLinkedDonorAccount\(d,key,v\)\{/);
  const edit = admin.slice(admin.indexOf("function editDonorField"), admin.indexOf("function donorAction"));
  assert.match(edit, /const RTDB_DONOR_KEY:Record<string,string>=\{group:"bloodGroup",last:"lastDonationDate"\}/);
  assert.match(edit, /await syncLinkedDonorAccount\(d,key,v\)/);
  /* donorForm edit — linked অ্যাকাউন্টে name/gender/dob/area/phone/bloodGroup/lastDonation */
  const form = admin.slice(admin.indexOf("function donorForm"), admin.indexOf("function donorAction") === -1 ? admin.length : admin.indexOf("/* ══════════════════ APPROVED"));
  assert.match(form, /const owner=String\(\(d&&\(d\.ownerUid\|\|d\.uid\)\)\|\|""\)\.trim\(\);/);
  assert.match(form, /bloodGroup:o\.group,lastDonation:o\.last/);
  assert.match(form, /await updateRow\(NODES\.users,owner,up\)/);
});

test("Moderator donor edits sync the linked account so no panel shows stale data", () => {
  assert.match(moderator, /const LINKED_ACCOUNT_KEY:Record<string,string>=\{\s*name:"name",gender:"gender",dob:"dob",phone:"phone",group:"bloodGroup",area:"area",last:"lastDonation"\s*\}/);
  assert.match(moderator, /async function syncLinkedModeratorAccount\(d,key,v\)\{/);
  const edit = moderator.slice(moderator.indexOf("function editDonorField"), moderator.indexOf("function donorAction"));
  assert.match(edit, /await syncLinkedModeratorAccount\(d,key,v\)/);
  const form = moderator.slice(moderator.indexOf("function donorForm"), moderator.indexOf("/* ---------- live requests"));
  assert.match(form, /bloodGroup:o\.group,lastDonation:o\.last/);
  assert.match(form, /await updateRow\(NODES\.users,owner,up\)/);
});

/* ══════════ 4. Doner panel live donor-record sync ══════════ */

test("Doner panel own donor record syncs admin-controlled fields live (no reload)", () => {
  const rec = doner.slice(doner.indexOf("function startDonorRecListener"), doner.indexOf("function watchMyProfile"));
  assert.match(rec, /STORE\.donor\.bloodGroup=String\(row\.bloodGroup\|\|row\.group\|\|""\)/);
  assert.match(rec, /STORE\.donor\.whatsapp=String\(row\.whatsapp\|\|""\)/);
  assert.match(rec, /STORE\.donor\.health=String\(row\.health\|\|""\)/);
  assert.match(rec, /STORE\.donor\.available=!!row\.available/);
});
