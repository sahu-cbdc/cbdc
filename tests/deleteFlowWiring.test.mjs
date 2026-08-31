/**
 * Donor delete — UI/иerv-er wiring regression guards (no partial delete)
 * ═══════════════════════════════════════════════════════════════════════════
 * Static assertions that the atomic-delete + no-false-success + duplicate-click
 * protection wiring stays intact across the client, server and dev middleware.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const api = read("server/deleteApi.ts");
const admin = read("src/pages/Admin.tsx");
const vite = read("vite.config.ts");
const authAdmin = read("server/authAdmin.ts");

test("server: auth 'unconfigured' ABORTS the whole delete (no partial delete)", () => {
  assert.match(api, /authIo === "unconfigured"\) \{[\s\S]*?throw new ApiError\(\s*503,/);
  assert.match(api, /কিছুই মোছা হয়নি.*আংশিক ডিলিট প্রতিরোধ/);
  /* 'missing'/'deleted' still allow RTDB deletion (complete delete) */
  assert.doesNotMatch(api, /authIo === "missing"\) \{[\s\S]*?throw/);
});

test("server: account re-delete is idempotent (records gone + auth gone → ok, removed 0)", () => {
  assert.match(api, /if \(!Object\.keys\(paths\)\.length\) \{/);
  assert.match(api, /removed: 0,/);
});

test("authAdmin: NOT_FOUND bodies → 'missing', and transient OAuth retry exists", () => {
  assert.match(authAdmin, /USER_NOT_FOUND\|EMAIL_NOT_FOUND\|PHONE_NUMBER_NOT_FOUND\|NOT_FOUND/);
  assert.match(authAdmin, /authDeleteStatus\(/);
  assert.match(authAdmin, /fetchAccessTokenOnce\(sa, fetchImpl\);\s*}/); // retry path
  assert.match(authAdmin, /const isTransient = String\(\(first as Error\)\?\.message \|\| ""\)\.includes\("OAuth2 token"\)/);
});

test("client: duplicate delete click blocked via deletingEntities guard + local UI removal", () => {
  assert.match(admin, /const deletingEntities=new Set<string>\(\);/);
  assert.match(admin, /deletingEntities\.has\(key\)\)return \{ok:false,skipped:true\};/);
  assert.match(admin, /deletingEntities\.delete\(key\);/);
  /* immediate local removal so the deleted donor disappears without refresh */
  assert.match(admin, /donorIdRows=donorIdRows\.filter\(x=>String\(x&&\(x\.id\|\|x\.donorId\)\|\|""\)\.trim\(\)!==donorId\);/);
  assert.match(admin, /DB\.donors=DB\.donors\.filter\(x=>String\(x&&x\.id\|\|""\)\.trim\(\)!==donorId\);/);
});

test("dev middleware: loads FIREBASE_SERVICE_ACCOUNT from .env (loadEnv)", () => {
  assert.match(vite, /import \{ defineConfig, loadEnv, type Plugin \} from "vite";/);
  assert.match(vite, /const env = loadEnv\(mode, process\.cwd\(\), ""\);/);
  assert.match(vite, /FIREBASE_SERVICE_ACCOUNT: env\.FIREBASE_SERVICE_ACCOUNT \|\| process\.env\.FIREBASE_SERVICE_ACCOUNT \|\| ""/);
  assert.match(vite, /cbdcDeleteApi\(devServerEnv\)/);
});
