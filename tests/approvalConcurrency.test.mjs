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
