/**
 * Security & API-hardening regression tests
 * ═══════════════════════════════════════════════════════════════════════════
 *  Coverage (no real Firebase needed — injectable IO + static guards):
 *
 *   1. Secret leakage  — ImgBB key/service-account/private key কখনো client
 *                        bundle (.env / src) ও server response-এ যায় না।
 *   2. CORS architecture — allowlist-ভিত্তিক; CORS auth নয়; `*` ব্যবহার হয় না।
 *   3. Intelligent abuse protection — fixed normal-user quota নয়; শুধু spawn
 *                        flooding 429 দেয়; legitimate usage unlimited।
 *   4. Server-side authentication & authorization (401/403) — delete / dedupe /
 *                        apply / images-upload; IDOR (client-পাঠানো uid) দমন।
 *   5. Firebase Rules consistency — settings/imgbb আর public-readable নয়;
 *                        settings/app পাবলিক; server-এ সব protected API token দাবি।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ApiError } from "../server/deleteApi.ts";
import { handleAdminEntityDelete, handleAdminConfigCheck } from "../server/deleteApi.ts";
import { handleAdminDedupe } from "../server/dedupeApi.ts";
import { handleDonorApply } from "../server/applyApi.ts";
import { handleImageUpload } from "../server/imagesApi.ts";
import {
  corsForRequest,
  parseAllowedOrigins,
  normalizeOrigin,
  isAllowedOrigin,
  DEFAULT_CORS_ORIGINS,
} from "../server/cors.ts";
import { createAbuseGuard, guardKey } from "../server/abuseGuard.ts";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");

function apiErrorStatus(fn) {
  try {
    return { status: null };
  } catch (e) {
    return { status: e && (e.status || e.statusCode) };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   1. SECRET LEAKAGE — browser bundle / source
   ═══════════════════════════════════════════════════════════════════════ */

test("secret: ImgBB key never read/bundled client-side (imgbb.ts)", () => {
  const src = read("src/lib/imgbb.ts");
  assert.match(src, /api\/images\/upload/);
  /* key আর client-এ পড়া হয় না — কোনো env/cache/direct-upload নেই */
  assert.match(src, /getImgbbKey/); // admin status read (RTDB admin-only)
  assert.match(src, /server-side|server-ই|server secret/); // doc
  assert.doesNotMatch(src, /getEnvImgbbKey/);
  assert.doesNotMatch(src, /cbdc\.imgbb\.key/); // localStorage cache removed
  assert.doesNotMatch(src, /localStorage\.setItem|localStorage\.getItem/);
  assert.doesNotMatch(src, /api\.imgbb\.com\/1\/upload/); // no direct ImgBB from client
  assert.doesNotMatch(src, /fetch\(.["']https:\/\/api\.imgbb/);
});

test("secret: .env has no committed ImgBB key value", () => {
  const env = read(".env");
  assert.doesNotMatch(env, /8a5458f04438f111f2150bb73ee7499d/);
  assert.doesNotMatch(env, /VITE_IMGBB_API_KEY\s*=\s*[A-Za-z0-9]/);
  assert.match(env, /IMGBB_API_KEY=/);
});

test("secret: wrangler vars are public-only (no secret value)", () => {
  const w = read("wrangler.jsonc");
  assert.doesNotMatch(w, /IMGBB_API_KEY"\s*:\s*"/);
  assert.doesNotMatch(w, /FIREBASE_SERVICE_ACCOUNT"\s*:\s*"/);
  assert.doesNotMatch(w, /BEGIN PRIVATE KEY/);
  assert.match(w, /"FIREBASE_API_KEY"\s*:\s*"AIza/);
});

test("secret: no service-account/private-key in client source", () => {
  const src = read("src/lib/imgbb.ts") + read("src/lib/firebase.ts");
  assert.doesNotMatch(src, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(src, /private_key\s*:/);
  assert.doesNotMatch(src, /client_email\s*:/);
});

/* ═══════════════════════════════════════════════════════════════════════
   2. CORS ARCHITECTURE
   ═══════════════════════════════════════════════════════════════════════ */

test("cors: allowlisted origin gets ACAO, disallowed gets none", () => {
  const allowed = parseAllowedOrigins();
  const ok = corsForRequest("https://chawkbazarbloodclub.com", "POST", allowed);
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "https://chawkbazarbloodclub.com");
  assert.equal(ok.preflight, false);

  const www = corsForRequest("https://www.chawkbazarbloodclub.com", "POST", allowed);
  assert.equal(www.headers["Access-Control-Allow-Origin"], "https://www.chawkbazarbloodclub.com");

  const evil = corsForRequest("https://evil.example", "POST", allowed);
  assert.equal(evil.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(evil.preflight, false);
});

test("cors: no origin (same-origin/curl) → no CORS headers", () => {
  const r = corsForRequest(null, "POST", parseAllowedOrigins());
  assert.deepEqual(r.headers, {});
  assert.equal(r.preflight, false);
});

test("cors: preflight OPTIONS returns preflight true + allow-methods/headers", () => {
  const r = corsForRequest("https://chawkbazarbloodclub.com", "OPTIONS", parseAllowedOrigins(), "POST");
  assert.equal(r.preflight, true);
  assert.equal(r.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(r.headers["Access-Control-Allow-Headers"], "Authorization, Content-Type");
  assert.ok(r.headers["Access-Control-Max-Age"]);
});

test("cors: never emits bare '*' ACAO", () => {
  const r = corsForRequest("https://chawkbazarbloodclub.com", "POST", parseAllowedOrigins());
  assert.notEqual(r.headers["Access-Control-Allow-Origin"], "*");
});

test("cors: env ALLOWED_ORIGINS appends + case/trailing-slash normalized", () => {
  const allowed = parseAllowedOrigins("  https://app.example.com/, HTTPS://APP.EXAMPLE.COM  ");
  assert.ok(isAllowedOrigin("https://app.example.com", allowed));
  assert.ok(isAllowedOrigin("https://app.example.com/", allowed));
  assert.equal(normalizeOrigin("https://APP.example.com/"), "https://app.example.com");
  assert.equal(parseAllowedOrigins("not a url").length, DEFAULT_CORS_ORIGINS.length);
});

/* ═══════════════════════════════════════════════════════════════════════
   3. INTELLIGENT ABUSE PROTECTION (not a fixed user quota)
   ═══════════════════════════════════════════════════════════════════════ */

test("abuse: allows normal usage, blocks only sustained burst", () => {
  const guard = createAbuseGuard({ max: 3, windowMs: 60_000 });
  const key = guardKey("user-1", "api");
  assert.equal(guard.check(key), true);
  assert.equal(guard.check(key), true);
  assert.equal(guard.check(key), true);
  assert.equal(guard.check(key), false); // burst exceeds max
  assert.equal(guard.count(key), 3);
});

test("abuse: per-key isolation (multi-user legitimate usage unlimited)", () => {
  const guard = createAbuseGuard({ max: 2, windowMs: 60_000 });
  const a = guardKey("user-a", "api");
  const b = guardKey("user-b", "api");
  assert.equal(guard.check(a), true);
  assert.equal(guard.check(a), true);
  assert.equal(guard.check(a), false);
  assert.equal(guard.check(b), true); // different user unaffected
  assert.equal(guard.check(b), true);
});

test("abuse: clear() resets state", () => {
  const guard = createAbuseGuard({ max: 2, windowMs: 60_000 });
  const key = guardKey("user-1", "api");
  guard.check(key);
  guard.check(key);
  assert.equal(guard.check(key), false);
  guard.clear();
  assert.equal(guard.check(key), true);
});

test("abuse: generous threshold default means legitimate usage not blocked", () => {
  /* default 300/min — a human click-speed never approaches it */
  const guard = createAbuseGuard();
  for (let i = 0; i < 250; i++) assert.equal(guard.check(guardKey("u", "api")), true);
  assert.equal(guard.check(guardKey("u", "api")), true);
});

/* ═══════════════════════════════════════════════════════════════════════
   4. SERVER-SIDE AUTHENTICATION & AUTHORIZATION
   ═══════════════════════════════════════════════════════════════════════ */

function makeIo({ uid = null, role = "admin", status = "active", donorSeed = {}, userSeed = {} } = {}) {
  const data = {
    admins: {},
    users: userSeed,
    donors: donorSeed,
    members: {},
    queue: {},
    donations: {},
    requests: {},
    reports: {},
    accounts: {},
    settings: { app: { rules: {} } },
    _meta: {},
    identityIndex: { email: {} },
  };
  if (uid) data.admins[uid] = { role, status };
  return {
    async verifyToken(token) {
      if (token === "bad") return null;
      if (token === "user-token") return { uid: "user-1", email: "a@b.c" };
      return { uid: uid || "admin-1", email: "admin@x.y" };
    },
    async get(p) {
      const parts = p.split("/").filter(Boolean);
      let cur = data;
      for (const part of parts) {
        if (cur == null || typeof cur !== "object") return null;
        cur = cur[part];
      }
      return cur && typeof cur === "object" ? { ...cur, id: parts[parts.length - 1] } : cur;
    },
    async list(node) {
      const parts = node.split("/").filter(Boolean);
      let cur = data;
      for (const part of parts) {
        if (cur == null || typeof cur !== "object") return null;
        cur = cur[part];
      }
      return cur && typeof cur === "object" ? cur : null;
    },
    async apply(paths) { void paths; return true; },
    async deleteAuthUser() { return "deleted"; },
  };
}

test("delete: unauthenticated (invalid token) throws 401", async () => {
  const io = makeIo({ uid: null });
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "account", uid: "user-1", idToken: "bad" }, io),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("delete: non-admin role throws 403 (privilege escalation blocked)", async () => {
  const io = makeIo({ uid: "mod-1", role: "moderator" });
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "account", uid: "user-1", idToken: "t" }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("delete: IDOR — client-supplied uid != server owner → 409, nothing deleted", async () => {
  const io = makeIo({
    uid: "admin-1",
    role: "admin",
    donorSeed: { "CBDC-2026-0001": { id: "CBDC-2026-0001", ownerUid: "owner-real" } },
  });
  await assert.rejects(
    () =>
      handleAdminEntityDelete(
        { scope: "donor", donorId: "CBDC-2026-0001", uid: "client-other", idToken: "t" },
        io,
      ),
    (e) => e instanceof ApiError && e.status === 409,
  );
});

test("dedupe: non-admin role throws 403", async () => {
  const io = makeIo({ uid: "mod-1", role: "moderator" });
  await assert.rejects(
    () => handleAdminDedupe({ apply: false, idToken: "t" }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("apply: unauthenticated throws 401; invalid token throws 401", async () => {
  const io = makeIo();
  await assert.rejects(
    () => handleDonorApply({ idToken: "", action: "donor" }, io),
    (e) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(
    () => handleDonorApply({ idToken: "bad", action: "donor" }, io),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("authz: invalid/expired ID token → 401 across protected endpoints", async () => {
  /* Identity Toolkit-এ invalid/expired token-ও verifyToken → null → 401।
     নিচের tests এই رفتار যোগের জন্য verifyToken-কে "expired" token-এ null দিতে বলে। */
  const io = makeIo();
  io.verifyToken = async (t) => (t === "expired" || t === "bad" ? null : { uid: "admin-1" });
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "account", uid: "x", idToken: "expired" }, io),
    (e) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(
    () => handleDonorApply({ idToken: "expired", action: "donor" }, io),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("authz: normal donor (no admins record) cannot call admin delete (donor → admin blocked)", async () => {
  const io = makeIo();
  io.verifyToken = async () => ({ uid: "donor-user-1", email: "d@x.y" });
  /* `admins/donor-user-1` নেই → role "" → 403 */
  await assert.rejects(
    () => handleAdminEntityDelete({ scope: "account", uid: "x", idToken: "t" }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("config-check: non-admin throws 403, never leaks secret value", async () => {
  const io = makeIo({ uid: "mod-1", role: "moderator" });
  await assert.rejects(
    () => handleAdminConfigCheck({ idToken: "t" }, io, { serviceAccountConfigured: true }),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("images upload: no/invalid token → 401; no key → 503; key kept server-side", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  /* no token */
  await assert.rejects(
    () => handleImageUpload({ idToken: "" }, bytes, "image/jpeg", "x.jpg", makeIo() , async () => { throw new Error("no-op"); }),
    (e) => e instanceof ApiError && e.status === 401,
  );
  /* invalid token */
  const ioNull = makeIo();
  await assert.rejects(
    () => handleImageUpload({ idToken: "bad" }, bytes, "image/jpeg", "x.jpg", ioNull),
    (e) => e instanceof ApiError && e.status === 401,
  );
  /* no key on server */
  const ioNoKey = {
    verifyToken: async () => ({ uid: "u" }),
    getImgbbKey: async () => "",
  };
  await assert.rejects(
    () => handleImageUpload({ idToken: "t" }, bytes, "image/jpeg", "x.jpg", ioNoKey),
    (e) => e instanceof ApiError && e.status === 503,
  );
});

test("images upload: valid token + key → uploads, returns sanitized URL only", async () => {
  const io = {
    verifyToken: async () => ({ uid: "user-1" }),
    getImgbbKey: async () => "server-secret",
  };
  const seen = { key: "", name: "", mime: "" };
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api.imgbb.com/1/upload");
    const fd = init.body;
    seen.mime = fd.get("image").type;
    seen.name = fd.get("image").name;
    const fdKey = fd.get("key");
    seen.key = String(fdKey);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          data: { url: "https://i.imgur.com/abc.jpg", thumb: { url: "t.jpg" }, delete_url: "del", width: 640, height: 480 },
        };
      },
    };
  };
  const result = await handleImageUpload(
    { idToken: "t" },
    new Uint8Array([0xff, 0xd8, 0xff]),
    "image/jpeg",
    "pic.jpg",
    io,
    fetchImpl,
  );
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://i.imgur.com/abc.jpg");
  assert.equal(seen.key, "server-secret"); // key was NOT read from client
  /* secret never returned in the response */
  assert.equal(JSON.stringify(result).includes("server-secret"), false);
});

/* ═══════════════════════════════════════════════════════════════════════
   5. FIREBASE RULES + API WIRING
   ═══════════════════════════════════════════════════════════════════════ */

test("rules: settings/imgbb not public-read; settings/app stays public; no naked '*' CORS", () => {
  const rules = read("database.rules.json");
  /* imgbb block (নেস্টেড ব্রেস ছাড়া) — .read অবশ্যই admin-শর্ত */
  const imgbbBlock = (rules.match(/"imgbb":\s*\{[^}]*\}/) || [""])[0];
  assert.ok(imgbbBlock, "imgbb rules block present");
  assert.match(imgbbBlock, /"\.read": "auth != null/);
  assert.doesNotMatch(imgbbBlock, /"\.read": true/);
  /* app block — public read */
  const appBlock = (rules.match(/"app":\s*\{[^}]*\}/) || [""])[0];
  assert.ok(appBlock, "app rules block present");
  assert.match(appBlock, /"\.read": true/);
  const index = read("server/index.ts");
  assert.doesNotMatch(index, /Access-Control-Allow-Origin"\s*:\s*"\*/);
});

test("server: protected endpoints share Bearer-token auth + images endpoint present", () => {
  const index = read("server/index.ts");
  assert.match(index, /api\/images\/upload/);
  assert.match(index, /Authorization: Bearer/);
  assert.match(index, /handleImageUpload/);
  assert.match(index, /makeImagesIo/);
  assert.match(index, /createAbuseGuard/);
  assert.match(index, /corsForRequest/);
  /* all post endpoints funnel through a single token requirement */
  assert.match(index, /if \(!idToken\) return jsonResponse/);
});

test("server: no raw secret in response payloads (sanitized error paths)", () => {
  const deleteApi = read("server/deleteApi.ts");
  const applyApi = read("server/applyApi.ts");
  /* never re-emit the secret, only a boolean/state */
  assert.doesNotMatch(deleteApi, /FIREBASE_SERVICE_ACCOUNT[^)]*return|private_key/);
  assert.doesNotMatch(deleteApi, /JSON\.stringify\([^)]*secret/);
  assert.match(applyApi, /approvalRequired: true/); // behavior intact
});

test("rules: horizontal access blocked — User A cannot read/write User B's record", () => {
  const rules = read("database.rules.json");
  /* members/$id: read only if staff OR data.uid===auth.uid OR data.ownerUid===auth.uid */
  assert.match(rules, /data\.child\('uid'\)\.val\(\) === auth\.uid \|\| data\.child\('ownerUid'\)\.val\(\) === auth\.uid/);
  /* requests/$id: write only staff OR own ownerUid */
  assert.match(rules, /\(data\.exists\(\) && data\.child\('ownerUid'\)\.val\(\) === auth\.uid\)/);
  /* users/$uid: read/write only self OR admin */
  assert.match(rules, /"\.write": "auth != null && \(\$uid === auth\.uid \|\| root\.child\('admins'\)/);
  /* reports/$id: read only staff OR owner */
  assert.match(rules, /data\.child\('ownerUid'\)\.val\(\) === auth\.uid/);
});

test("API response leakage: server results never contain the ImgBB secret / service-account", async () => {
  const io = makeIo({ uid: "admin-1", role: "admin" });
  /* config-check returns only a boolean, never the secret value */
  const cfg = await handleAdminConfigCheck({ idToken: "t" }, io, { serviceAccountConfigured: true });
  assert.deepEqual(Object.keys(cfg).sort(), ["ok", "serviceAccountConfigured"]);
  assert.equal(JSON.stringify(cfg).includes("private_key"), false);
  assert.equal(JSON.stringify(cfg).includes("AIzaSy"), false);
  assert.equal(JSON.stringify(cfg).includes("8a5458"), false);
});
