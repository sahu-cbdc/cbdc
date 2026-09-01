/**
 * Admin delete — সার্ভার কনফিগারেশন preflight (FIREBASE_SERVICE_ACCOUNT)
 * ═══════════════════════════════════════════════════════════════════════════
 * নতুন `POST /api/admin/config-check` endpoint + Admin panel-এর bulk-delete
 * preflight-এর functional ও wiring টেস্ট:
 *
 *   • secret কনফিগার না থাকলে লিংকড-লগইন ডোনারের ডিলিট **শুরুই হয় না** —
 *     "মুছে ফেলা হচ্ছে… (১/১)" দেখিয়ে পরে config-error দেখানোর আংশিক/
 *     বিভ্রান্তিকর state আর নেই;
 *   • config-check-ও token + active admin role যাচাই করে (নন-অ্যাডমিন 403);
 *   • secret-এর মান কখনো ফেরত যায় না — শুধু configured কি না (boolean)।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ApiError, handleAdminConfigCheck } from "../server/deleteApi.ts";
import { serviceAccountConfigured } from "../server/authAdmin.ts";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");

/* ── in-memory io ──────────────────────────────────────────────────── */
function makeIo({ callerUid = "ADMIN_0123456789abcdef", role = "admin", status = "active" } = {}) {
  return {
    async verifyToken(tok) { return tok === "tok" ? { uid: callerUid } : null; },
    async get(p) {
      if (p === `admins/${callerUid}` && role) return { uid: callerUid, role, status };
      return null;
    },
    async list() { return null; },
    async apply() { return true; },
    async deleteAuthUser() { return "unconfigured"; },
  };
}

test("config-check: active admin gets an honest configured=true/false boolean", async () => {
  for (const configured of [true, false]) {
    const out = await handleAdminConfigCheck({ idToken: "tok" }, makeIo(), {
      serviceAccountConfigured: configured,
      imgbbConfigured: true,
    });
    assert.deepEqual(out, { ok: true, serviceAccountConfigured: configured, imgbbConfigured: true });
  }
});

test("config-check: missing/invalid token → 401", async () => {
  await assert.rejects(
    () => handleAdminConfigCheck({ idToken: "" }, makeIo(), { serviceAccountConfigured: true }),
    (e) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(
    () => handleAdminConfigCheck({ idToken: "bad" }, makeIo(), { serviceAccountConfigured: true }),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("config-check: non-admin (moderator/none/disabled) → 403", async () => {
  for (const io of [makeIo({ role: "moderator" }), makeIo({ role: "" }), makeIo({ status: "disabled" })]) {
    await assert.rejects(
      () => handleAdminConfigCheck({ idToken: "tok" }, io, { serviceAccountConfigured: true }),
      (e) => e instanceof ApiError && e.status === 403,
    );
  }
});

test("serviceAccountConfigured: detects raw JSON and base64 secrets, rejects garbage", () => {
  const sa = JSON.stringify({
    client_email: "svc@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
    project_id: "demo",
  });
  assert.equal(serviceAccountConfigured({ FIREBASE_SERVICE_ACCOUNT: sa }), true);
  assert.equal(serviceAccountConfigured({ FIREBASE_SERVICE_ACCOUNT: Buffer.from(sa).toString("base64") }), true);
  assert.equal(serviceAccountConfigured({ FIREBASE_SERVICE_ACCOUNT: "" }), false);
  assert.equal(serviceAccountConfigured({ FIREBASE_SERVICE_ACCOUNT: "not-json" }), false);
  assert.equal(serviceAccountConfigured({}), false);
});

/* ── wiring: Worker, dev middleware, client, Admin panel ───────────── */

test("worker + dev middleware both mount /api/admin/config-check", () => {
  const worker = read("server/index.ts");
  const vite = read("vite.config.ts");
  assert.match(worker, /api[\\\/]+admin[\\\/]+config-check/);
  assert.match(worker, /handleAdminConfigCheck\(/);
  assert.match(worker, /serviceAccountConfigured\(env\)/);
  assert.match(vite, /api\/admin\/config-check/);
  assert.match(vite, /handleAdminConfigCheck\(/);
  assert.match(vite, /serviceAccountConfigured\(serverEnv\)/);
});

test("client: checkDeleteServerConfig exists and treats unknown servers as null (no false block)", () => {
  const lib = read("src/lib/accountDelete.ts");
  assert.match(lib, /export async function checkDeleteServerConfig/);
  assert.match(lib, /api\/admin\/config-check/);
  assert.match(lib, /return \{ configured: null \};/);
});

test("Admin panel bulk delete: preflight aborts BEFORE any delete when secret is missing", () => {
  const admin = read("src/pages/Admin.tsx");
  assert.match(admin, /const needsAuthDelete=list\.some\(/);
  assert.match(admin, /const cfg=await checkDeleteServerConfig\(\);/);
  assert.match(admin, /if\(cfg\.configured===false\)\{/);
  /* preflight অবশ্যই ডিলিট লুপের আগে */
  const pre = admin.indexOf("checkDeleteServerConfig()");
  const loop = admin.indexOf('deleteOneEntity(d,"donor")');
  assert.ok(pre > 0 && loop > pre, "preflight runs before the per-entity delete loop");
});

test("Admin panel bulk delete: busy lock + disabled button + unmatched selections reported", () => {
  const admin = read("src/pages/Admin.tsx");
  assert.match(admin, /let bulkDeleteBusy=false;/);
  assert.match(admin, /if\(bulkDeleteBusy\)return;/);
  assert.match(admin, /tdel\.disabled=true;tdel\.textContent="মুছে ফেলা হচ্ছে…";/);
  assert.match(admin, /const missing=ids\.filter\(id=>!found\.has\(id\)\);/);
  assert.match(admin, /বর্তমান তালিকায় নেই/);
  /* ব্যর্থ হলে সফলগুলোই কেবল নির্বাচন থেকে সরে */
  assert.match(admin, /done\.forEach\(r=>donorIdSel\.delete\(String\(r\.donorId\)\)\);/);
  /* তালিকা-থেকে-সরানো (scope list) — একই busy lock */
  assert.match(admin, /async function removeDonorsFromList\(ids\)\{\s*if\(bulkDeleteBusy\)return false;/);
});
