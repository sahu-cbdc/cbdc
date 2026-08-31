/**
 * Access & Role — realtime save/apply + data-safety regression guards
 * ═══════════════════════════════════════════════════════════════════════════
 * Root causes fixed (এই টেস্টগুলো সেগুলোকে পাহারা দেয়):
 *
 *  ১. Admin.tsx → refreshAccounts(): আগে তালিকা সবসময় পুরোনো DB.accounts
 *     snapshot দিয়ে seed হতো এবং stale (cached) role টাটকা listener role-এর
 *     ওপরে অগ্রাধিকার পেত — ফলে Save-এর পর অন্য প্যানেলে/demote-এ Refresh না
 *     করা পর্যন্ত পুরোনো ভূমিকা দেখাত, আর মুছে ফেলা অ্যাকাউন্ট stale seed
 *     থেকে ফিরে আসত (publishSharedState হয়ে RTDB `accounts`-এও resurrect হতো)।
 *
 *  ২. Admin.tsx → roleManageSheet(): Save-এ কোনো in-flight guard ছিল না,
 *     নেটওয়ার্ক ঝুলে গেলে বোতাম চিরকাল আটকে থাকত, logAudit ব্যর্থ হলে সফল
 *     save-ও error দেখাত।
 *
 *  ৩. Moderator.tsx → accessSheet(): role write গুলো fire-and-forget ছিল
 *     (silent .catch) + পুরো shared-store persist() — ডাটাবেসে লেখা ব্যর্থ
 *     হলেও সবুজ "সফল" toast, আর persist() ব্যর্থ হলে sheet আটকে থাকত।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const admin = read("src/pages/Admin.tsx");
const moderator = read("src/pages/Moderator.tsx");

/* ── ১. refreshAccounts: টাটকা listener ডেটাই একমাত্র উৎস ─────────────── */

test("Admin refreshAccounts: stale seed only BEFORE users+admins are ready", () => {
  assert.match(admin, /if\(!dataReady\("users","admins"\)\)\s*\(DB\.accounts\|\|\[\]\)\.forEach\(a=>by\.set/);
  /* আগের শর্তহীন seed আর নেই */
  assert.doesNotMatch(admin, /const by=new Map\(\);\s*\(DB\.accounts\|\|\[\]\)\.forEach/);
});

test("Admin refreshAccounts: fresh users-listener role WINS over cached role", () => {
  /* আগে ছিল: role:by.get(uid)?.role||u.role||"user" (stale জেতে) — এখন উল্টো */
  assert.match(admin, /accountUsers\.forEach\(u=>\{[^}]*role:u\.role\|\|by\.get\(uid\)\?\.role\|\|"user"/);
  assert.doesNotMatch(admin, /role:by\.get\(uid\)\?\.role\|\|u\.role\|\|"user"/);
  /* admins-listener role আগের মতোই টাটকা অগ্রাধিকারে থাকে */
  assert.match(admin, /accountAdmins\.forEach\(a=>\{[^}]*role:a\.role\|\|by\.get\(uid\)\?\.role\|\|"mod"/);
});

/* ── ২. Admin roleManageSheet: guard + no-hang + সৎ ফলাফল ─────────────── */

test("Admin role save: in-flight guard blocks duplicate/concurrent saves", () => {
  assert.match(admin, /const savingRoles=new Set\(\);/);
  assert.match(admin, /if\(savingRoles\.has\(saveKey\)\)return;/);
  assert.match(admin, /finally\{savingRoles\.delete\(saveKey\);\}/);
});

test("Admin role save: write has a timeout so the Save button can never hang forever", () => {
  assert.match(admin, /const withTimeout=\(p,ms,msg\)=>Promise\.race\(/);
  assert.match(admin, /await withTimeout\(updatePaths\(paths\),15000/);
  /* fallback-read গুলোতেও টাইমআউট */
  assert.match(admin, /withTimeout\(getRow\(NODES\.users,String\(uid\)\),12000\)/);
  assert.match(admin, /withTimeout\(getRow\(NODES\.admins,String\(uid\)\),12000\)/);
});

test("Admin role save: audit-log failure does NOT fail a successful save", () => {
  assert.match(admin, /try\{await withTimeout\(logAudit\("ভূমিকা পরিবর্তন"/);
  assert.match(admin, /catch\(e\)\{console\.warn\("role audit:"/);
});

test("Admin role save: loading state set and restored on failure (no stuck button)", () => {
  assert.match(admin, /btn\.disabled=true;btn\.textContent="সংরক্ষণ হচ্ছে…";/);
  assert.match(admin, /btn\.disabled=false;btn\.innerHTML=btnHtml;/);
});

test("Admin role save: role change writes users/{uid}/role + admins/{uid} in ONE atomic multi-path update", () => {
  assert.match(admin, /const paths=\{\[`users\/\$\{uid\}\/role`\]:roleValue\};/);
  assert.match(admin, /paths\[`\$\{NODES\.admins\}\/\$\{uid\}`\]=null;/); // demote → staff record removed
  assert.match(admin, /paths\[`\$\{NODES\.admins\}\/\$\{uid\}`\]=staff;/); // promote → staff record set
});

test("Admin role save: existing identity/donor data is never overwritten with blanks", () => {
  assert.match(admin, /const firstFilled=\(\.\.\.vals\)=>/);
  assert.match(admin, /Object\.keys\(identity\)\.forEach\(k=>\{if\(identity\[k\]\)staff\[k\]=identity\[k\]\}\);/);
  /* demote-এ staff identity users/{uid}-এ কপি হয় শুধু ফাঁকা ফিল্ডে */
  assert.match(admin, /if\(identity\[k\]&&!String\(\(liveUser&&liveUser\[k\]\)\|\|""\)\.trim\(\)\)paths\[`users\/\$\{uid\}\/\$\{k\}`\]=identity\[k\];/);
});

/* ── ৩. Moderator accessSheet: atomic + awaited + সৎ error ────────────── */

test("Moderator access save: atomic awaited updatePaths — no fire-and-forget writes", () => {
  assert.match(moderator, /await updatePaths\(paths\);/);
  assert.doesNotMatch(moderator, /setRow\(NODES\.admins, a\.uid,[\s\S]{0,400}?\.catch\(e=>console\.warn\("role grant:/);
  assert.doesNotMatch(moderator, /removeRow\(NODES\.admins, a\.uid\)\.catch\(e=>console\.warn\("role revoke:/);
  assert.doesNotMatch(moderator, /updateRow\(NODES\.users, a\.uid, \{role:staffRole\}\)\.catch/);
});

test("Moderator access save: no full-store persist() that could reject and freeze the sheet", () => {
  assert.doesNotMatch(moderator, /await persist\(\);s\.close\(\);renderSub\("access"\)/);
  assert.match(moderator, /s\.close\(\);renderSub\("access"\);paintNav\(\);paintTop\(\);/);
});

test("Moderator access save: duplicate-request guard + loading state + honest failure toast", () => {
  assert.match(moderator, /let acSaving=false;/);
  assert.match(moderator, /if\(acSaving\)return;/);
  assert.match(moderator, /ok\.disabled=true;ok\.textContent=tp\("সংরক্ষণ হচ্ছে…","Saving…"\);/);
  assert.match(moderator, /ok\.disabled=false;ok\.innerHTML=okHtml;/);
  assert.match(moderator, /শুধু অ্যাডমিন করতে পারেন/);
  assert.match(moderator, /finally\{acSaving=false;\}/);
});

test("Moderator access save: local role/UI state changes only AFTER the database write succeeds", () => {
  /* accessSheet-এর নিজের block-এ anchor — অন্য জায়গার updatePaths নয় */
  const anchor = moderator.indexOf("paths[`${NODES.admins}/${a.uid}`]=null;");
  assert.ok(anchor > 0, "accessSheet atomic paths block exists");
  const idx = moderator.indexOf("await updatePaths(paths);", anchor);
  assert.ok(idx > anchor, "accessSheet awaits the atomic write");
  const after = moderator.slice(idx, idx + 800);
  assert.match(after, /a\.role=pick;/);
  /* আগের মতো write-এর আগে a.role বদলানো হয় না */
  const before = moderator.slice(Math.max(0, idx - 1600), idx);
  assert.doesNotMatch(before, /const before=a\.role;\s*a\.role=pick;/);
});

/* ── ৪. Realtime role routing (সব প্যানেলের নিজস্ব live gate অক্ষত) ───── */

test("all three panels redirect the affected user to the right panel on live role change", () => {
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /navigateToPage\(rowRole === "admin" \? "admin" : "moderator"\)/);
  assert.match(admin, /const target=panelForRole\(resolved\.role\);\s*if\(target!==PANEL\.id\)/);
  assert.match(moderator, /const target=panelForRole\(resolved\.role\);\s*if\(target!==PANEL\.id\)/);
});
