/**
 * Donor/Account delete — Firebase Auth atomicity, idempotency & robustness
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Root cause fixed: আগে `FIREBASE_SERVICE_ACCOUNT` কনফিগার না থাকলে (auth
 * "unconfigured") server RTDB ডাটা মুছে ফেলত আর **লগইন অ্যাকাউন্ট রেখে দিত** —
 * এই mismatch-ই Donor UI/Auth-এ stale/duplicate record ও partial delete সৃষ্টি
 * করত। এখন:
 *   • লগইন মুছা সম্ভব না হলে (`unconfigured`/`failed`) → **কিছুই মোছা হয় না**
 *     (atomic — partial delete নয়);
 *   • "deleted"/"missing" হলেই RTDB মোছা হয় (সম্পূর্ণ delete);
 *   • Account-scope re-delete (আগেই মুছে গেছে) → no-op সফল (idempotent);
 *   • authAdmin-এ transient OAuth retry + NOT_FOUND → "missing" (নয় "failed")।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { ApiError, handleAdminEntityDelete } from "../server/deleteApi.ts";
import { authDeleteStatus, deleteAuthUserWithServiceAccount } from "../server/authAdmin.ts";

/* ── in-memory DeleteIo ────────────────────────────────────────────── */
function makeIo(authOutcome, seed = {}) {
  const data = {
    "admins/ADMIN_0123456789abcdef": { uid: "ADMIN_0123456789abcdef", role: "admin", status: "active" },
    "donors/DONOR-001": { id: "DONOR-001", ownerUid: "USER_0123456789abcdef", name: "রহিম" },
    "users/USER_0123456789abcdef": { uid: "USER_0123456789abcdef", name: "রহিম", email: "rahim@example.com" },
    "accounts/AC-1": { id: "AC-1", ownerUid: "USER_0123456789abcdef" },
    ...seed,
  };
  const applied = [];
  const io = {
    async verifyToken() { return { uid: "ADMIN_0123456789abcdef" }; },
    async get(p) { return data[p] !== undefined ? data[p] : null; },
    async list(node) {
      const out = {};
      for (const [p, v] of Object.entries(data)) if (p.startsWith(node + "/")) out[p.slice(node.length + 1)] = v;
      return out;
    },
    async apply(paths) { for (const p of Object.keys(paths)) applied.push(p); return true; },
    async deleteAuthUser() { return authOutcome; },
  };
  return { io, applied };
}

test("DONOR delete: auth 'unconfigured' (no service account) → nothing deleted, 503 error", async () => {
  const { io, applied } = makeIo("unconfigured");
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "donor", donorId: "DONOR-001", uid: "USER_0123456789abcdef", idToken: "tok" }, io),
    (e) => e instanceof ApiError && e.status === 503,
  );
  assert.equal(applied.length, 0, "no RTDB path deleted when login can't be removed — no partial delete");
});

test("ACCOUNT delete: auth 'unconfigured' → nothing deleted, 503 error (no DB-data-without-login)", async () => {
  const { io, applied } = makeIo("unconfigured");
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "account", uid: "USER_0123456789abcdef", idToken: "tok" }, io),
    (e) => e instanceof ApiError && e.status === 503,
  );
  assert.equal(applied.length, 0, "account data NOT deleted when login cannot be removed");
});

test("DONOR delete: auth 'failed' → nothing deleted, 502 error", async () => {
  const { io, applied } = makeIo("failed");
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "donor", donorId: "DONOR-001", uid: "USER_0123456789abcdef", idToken: "tok" }, io),
    (e) => e instanceof ApiError && e.status === 502,
  );
  assert.equal(applied.length, 0);
});

test("DONOR delete: auth 'deleted' → RTDB fully deleted (login + data consistent)", async () => {
  const { io, applied } = makeIo("deleted");
  const result = await handleAdminEntityDelete(
    { scope: "donor", donorId: "DONOR-001", uid: "USER_0123456789abcdef", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true);
  assert.equal(result.auth, "deleted");
  const set = new Set(applied);
  assert.ok(set.has("donors/DONOR-001"));
  assert.ok(set.has("users/USER_0123456789abcdef"));
  assert.ok(set.has("accounts/AC-1"));
});

test("DONOR delete: auth 'missing' (no linked login) → RTDB deleted, complete delete", async () => {
  const { io, applied } = makeIo("missing");
  const result = await handleAdminEntityDelete(
    { scope: "donor", donorId: "DONOR-001", uid: "USER_0123456789abcdef", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true);
  assert.equal(result.auth, "missing");
  assert.ok(applied.includes("donors/DONOR-001"), "donor removed when no login existed");
});

test("ACCOUNT delete is idempotent: records already gone + auth missing → ok, removed 0", async () => {
  /* Re-delete: users/admins/accounts সবই আগে মুছে গেছে (seed শুধু admin রেকর্ড)। */
  const { io, applied } = makeIo("missing", {
    // no user/admins/accounts for the target uid
  });
  const result = await handleAdminEntityDelete(
    { scope: "account", uid: "SOME_OTHER_0123456789abcd", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true, "re-delete of already-deleted account is a no-op, not an error");
  assert.equal(result.removed, 0);
  assert.equal(result.auth, "missing");
  assert.equal(applied.length, 0);
});

/* ── authAdmin robustness ──────────────────────────────────────────── */

test("authAdmin status mapping: 200 → deleted; NOT_FOUND codes → missing; other → failed", () => {
  assert.equal(authDeleteStatus(200, ""), "deleted");
  assert.equal(authDeleteStatus(404, "no such user"), "missing");
  assert.equal(authDeleteStatus(400, '{"error":{"message":"USER_NOT_FOUND"}}'), "missing");
  assert.equal(authDeleteStatus(400, '{"error":{"message":"EMAIL_NOT_FOUND"}}'), "missing");
  assert.equal(authDeleteStatus(403, "PERMISSION_DENIED"), "failed");
  assert.equal(authDeleteStatus(500, "boom"), "failed");
});

test("authAdmin: USER_NOT_FOUND body → 'missing' (already gone), not 'failed'", async () => {
  /* Real PKCS#8 key — WebCrypto sign করতে হবে। */
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("oauth2.googleapis.com/token")) {
      return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }), text: async () => "" };
    }
    return {
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "USER_NOT_FOUND" } }),
      text: async () => JSON.stringify({ error: { message: "USER_NOT_FOUND" } }),
    };
  };
  const sa = { client_email: "svc@example.iam.gserviceaccount.com", private_key: pem };
  const out = await deleteAuthUserWithServiceAccount(sa, "proj", "uid-123", fetchImpl);
  assert.equal(out, "missing");
  assert.ok(calls.some((u) => u.includes("accounts:delete")), "admin delete endpoint called");
});

test("authAdmin: HTTP 200 → 'deleted'", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const fetchImpl = async (url) => {
    if (url.includes("oauth2.googleapis.com/token")) {
      return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }), text: async () => "" };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
  const sa = { client_email: "svc@example.iam.gserviceaccount.com", private_key: pem };
  const out = await deleteAuthUserWithServiceAccount(sa, "proj", "uid-123", fetchImpl);
  assert.equal(out, "deleted");
});
