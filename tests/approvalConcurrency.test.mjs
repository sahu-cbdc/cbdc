/**
 * Concurrency / idempotency / settings-OFF wiring — static regression guards
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  The pure logic (donationLog.ts) and the server apply handler
 *  (server/applyApi.ts) are exercised live by other suites. This suite asserts
 *  that the *wiring* is present and intact so double-click / repeated-approve /
 *  rapid bulk actions can never create duplicate data (items 1, 2, 3, 11).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");

test("Admin decide(): in-flight guard prevents duplicate/race processing", () => {
  const admin = read("src/pages/Admin.tsx");
  assert.match(admin, /const decidingKeys=new Set<string>\(\);/);
  assert.match(admin, /function decideKey\(id,q\)\{/);
  assert.match(admin, /if\(decidingKeys\.has\(dkey\)\)return false;/);
  assert.match(admin, /decidingKeys\.add\(dkey\);/);
  assert.match(admin, /decidingKeys\.delete\(dkey\);/);
  /* key covers the same donation event (owner|date|place) & same donor/group owner */
  assert.match(admin, /q\.kind==="donation"\)return "donation\|"/);
  assert.match(admin, /q\.kind==="donor"\)return "donor\|"/);
  assert.match(admin, /q\.kind==="group"\)return "group\|"/);
});

test("Moderator decide(): in-flight guard prevents duplicate/race processing", () => {
  const moder = read("src/pages/Moderator.tsx");
  assert.match(moder, /const decidingKeys=new Set<string>\(\);/);
  assert.match(moder, /if\(decidingKeys\.has\(dkey\)\)return false;/);
  assert.match(moder, /decidingKeys\.add\(dkey\);/);
  assert.match(moder, /decidingKeys\.delete\(dkey\);/);
});

test("Approve/cancel buttons are disabled while a decision is in-flight (Admin & Moderator)", () => {
  for (const f of ["src/pages/Admin.tsx", "src/pages/Moderator.tsx"]) {
    const src = read(f);
    assert.match(src, /if\(s\.q\("#rv_yes"\)\.disabled\)return;/);
    assert.match(src, /setBusy\(true\)/);
    assert.match(src, /s\.q\("#rv_yes"\)\.disabled=b;/);
  }
});

test("Admin approved-donation delete is idempotent and blocks double-click", () => {
  const admin = read("src/pages/Admin.tsx");
  assert.match(admin, /let deleting=false;/);
  assert.match(admin, /if\(deleting\)return;/);
  assert.match(admin, /deleting=true;s\.q\("#ad_del"\)\.disabled=true;/);
  /* re-delete of an already-removed record is a no-op, not an error */
  assert.match(admin, /DB\.donations\.some\(x=>String\(x\.id\)===String\(r\.id\)\)/);
  assert.match(admin, /"রেকর্ড আগেই মুছে গেছে"/);
});

test("Doner panel routes settings-OFF actions through the server apply endpoint", () => {
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /import \{ requestDirectApply \} from "\.\.\/lib\/applyRequest";/);
  /* donor application */
  assert.match(doner, /requestDirectApply\("donor",\{\}\)/);
  /* blood group change */
  assert.match(doner, /requestDirectApply\("bloodGroup",\{to,reason,proof:up\.url\}\)/);
  /* donation verification */
  assert.match(doner, /requestDirectApply\("donation",\{date,place,bags,proof,patient:pat,note\}\)/);
  /* fallback: staff-only local write still exists so nothing regresses */
  assert.match(doner, /await isStaffUser\(uid\)\)\{/);
});

test("Server + dev middleware expose /api/donor/apply (settings-OFF direct processing)", () => {
  const server = read("server/index.ts");
  assert.match(server, /import \{ handleDonorApply \} from "\.\/applyApi\.ts";/);
  assert.match(server, /import \{ makeApplyIo/);
  assert.match(server, /isApply = path\.endsWith\("\/api\/donor\/apply"\)/);
  assert.match(server, /handleDonorApply\([\s\S]*?\.\.\.body, idToken \},[\s\S]*?makeApplyIo/);
  const vite = read("vite.config.ts");
  assert.match(vite, /import \{ handleDonorApply \} from "\.\/server\/applyApi";/);
  assert.match(vite, /isApplyApi = apiPath\.endsWith\("\/api\/donor\/apply"\)/);
  assert.match(vite, /handleDonorApply\([\s\S]*?\.\.\.payload, idToken \},[\s\S]*?makeApplyIo/);
});

test("Approval-settings single source stays consistent (settings/app.rules)", () => {
  /* Doner reads all four flags live from settings/app — no reload needed (item 10). */
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /watchRow\(NODES\.settings,"app"/);
  assert.match(doner, /donorApproval:rules\.donorApproval!==false/);
  assert.match(doner, /donationApproval:rules\.donationApproval!==false/);
  assert.match(doner, /emergencyApproval:rules\.emergencyApproval!==false/);
  assert.match(doner, /bloodGroupApproval:rules\.bloodGroupApproval!==false/);
  /* server apply handler reads the same node */
  const apply = read("server/applyApi.ts");
  assert.match(apply, /getRow\(SETTINGS_NODE, SETTINGS_ID\)/);
  assert.match(apply, /ruleOn\(settings, "donorApproval"\)/);
  assert.match(apply, /ruleOn\(settings, "bloodGroupApproval"\)/);
  assert.match(apply, /ruleOn\(settings, "donationApproval"\)/);
});

test("Bulk approve/cancel runs once: busy lock + immediate button disable (Admin & Moderator)", () => {
  for (const f of ["src/pages/Admin.tsx", "src/pages/Moderator.tsx"]) {
    const src = read(f);
    assert.match(src, /let bulkBusy=false;/, f + ": bulkBusy flag");
    assert.match(src, /if\(bulkBusy\)return;/, f + ": second bulk request rejected");
    assert.match(src, /okBtn\.disabled=true;okBtn\.textContent="প্রসেস হচ্ছে…";/, f + ": buttons disabled/loading immediately");
    assert.match(src, /finally\{\s*bulkBusy=false;/, f + ": lock always released");
  }
});

test("Approved-donation edit/manual-add buttons lock against double click", () => {
  const admin = read("src/pages/Admin.tsx");
  /* editApprovedDonation + donorAction addDon: both #ad_ok handlers guard on disabled */
  const locks = admin.match(/const btn=s\.q\("#ad_ok"\);\s*\n?\s*if\(btn\.disabled\)return;/g) || [];
  assert.ok(locks.length >= 2, "Admin edit + manual-add both guarded (found " + locks.length + ")");
  const moder = read("src/pages/Moderator.tsx");
  assert.match(moder, /const btn=s\.q\("#ad_ok"\);\s*\n?\s*if\(btn\.disabled\)return;/, "Moderator manual-add guarded");
});

test("Moderator manual donation-add uses the shared donation log (no bag-increment corruption)", () => {
  const moder = read("src/pages/Moderator.tsx");
  assert.match(moder, /writeApprovedDonation\(record,null,donationIo\)/, "authoritative donations record written");
  assert.match(moder, /id:safeDonationId\(d\.ownerUid\|\|"",dt,pl\)/, "deterministic event id (same event → same id)");
  assert.doesNotMatch(moder, /d\.donations=\(Number\(d\.donations\)\|\|0\)\+bags/, "old bags-increment removed — stats recomputed from records");
  assert.match(moder, /d\.donations=stats\.lives;d\.totalDonations=stats\.lives;d\.totalBags=stats\.bags;/, "stats come from recompute");
});

test("Doner panel honours OFF strictly — a failed direct apply never falls back to the queue", () => {
  const doner = read("src/pages/Doner.tsx");
  /* donor application: server failure (non approvalRequired) throws a flagged error */
  assert.match(doner, /Object\.assign\(new Error\("অনুমোদন সেটিং অনুযায়ী আবেদনটি সরাসরি অনুমোদিত হওয়ার কথা[\s\S]*?\{settingsOff:true\}\)/);
  assert.match(doner, /err&&err\.settingsOff&&err\.message\?err\.message:/);
  /* blood-group change: fail() with clear message instead of silent queue */
  assert.match(doner, /return fail\("অনুমোদন সেটিং অনুযায়ী গ্রুপ পরিবর্তন সরাসরি কার্যকর হওয়ার কথা/);
  /* donation verification: er() with clear message instead of silent pending */
  assert.match(doner, /return er\("অনুমোদন সেটিং অনুযায়ী রক্তদানটি সরাসরি যাচাইকৃত হওয়ার কথা/);
  /* the queue path stays legal only when the server itself says approvalRequired */
  const strictChecks = doner.match(/if\(!\(serverApply&&serverApply\.approvalRequired\)\)\{/g) || [];
  assert.ok(strictChecks.length >= 2, "strict approvalRequired checks present (found " + strictChecks.length + ")");
  assert.match(doner, /else if\(!\(sa&&sa\.approvalRequired\)\)\{/);
});

test("Settings save is a partial multi-path update — settings/app never wiped", () => {
  for (const f of ["src/pages/Admin.tsx", "src/pages/Moderator.tsx"]) {
    const src = read(f);
    assert.match(src, /\$\{NODES\.settings\}\/app\/rules/, f + ": rules written under settings/app/rules");
    assert.match(src, /\$\{NODES\.settings\}\/app\/autoApproveEmergency/, f + ": legacy flag kept in sync");
    assert.doesNotMatch(src, /setRow\(NODES\.settings,"app"/, f + ": no full-node replace");
  }
});

test("Server apply handler has an in-flight lock (uid|action) — duplicate request gets 429", () => {
  const apply = read("server/applyApi.ts");
  assert.match(apply, /const inflightApply = new Set<string>\(\);/);
  assert.match(apply, /const lockKey = uid \+ "\|" \+ action;/);
  assert.match(apply, /if \(inflightApply\.has\(lockKey\)\)/);
  assert.match(apply, /new ApiError\(429/);
  assert.match(apply, /finally \{\s*inflightApply\.delete\(lockKey\);\s*\}/);
});
