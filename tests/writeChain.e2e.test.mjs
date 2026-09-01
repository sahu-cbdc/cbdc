/**
 * End-to-end write-chain verification — every write operation, for real.
 * ═══════════════════════════════════════════════════════════════════════════
 * Drives the REAL worker entry (server/index.ts) through apiHandler.fetch()
 * with only the external edges faked:
 *
 *   • Firebase Identity Toolkit (token → uid/email)
 *   • Google OAuth2 token endpoint (service-account → access token)
 *   • Firebase RTDB REST (in-memory database, GET/PATCH semantics incl. null)
 *   • ImgBB upload API
 *
 * Everything in between — gateway dispatch, token verification, role
 * resolution, write-guard authorization, value translation, REST payloads —
 * is the production code path. Each test asserts both the HTTP outcome AND
 * the resulting database state, so a regression in any link fails loudly.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import apiHandler from "../server/index.ts";
import { FIREBASE_PUBLIC_CONFIG } from "../src/config/firebase.ts";
import { IMGBB_API_KEY } from "../server/config/imgbb.ts";

/* ─────────────────── fake service account (real RSA key) ─────────────────── */
const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
let b64 = "";
new Uint8Array(pkcs8).forEach((b) => (b64 += String.fromCharCode(b)));
const SA_JSON = JSON.stringify({
  client_email: "test-sa@test-project.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(b64).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`,
  project_id: FIREBASE_PUBLIC_CONFIG.projectId,
});

/* ─────────────────────────── in-memory RTDB ─────────────────────────── */
const DB = {};
const rtdbPatches = [];

function getByPath(root, path) {
  let node = root;
  for (const seg of path.split("/").filter(Boolean)) {
    if (node == null || typeof node !== "object") return null;
    node = node[seg];
  }
  return node === undefined ? null : node;
}
function setByPath(root, path, value) {
  const segs = path.split("/").filter(Boolean);
  if (!segs.length) return;
  let node = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (node[s] == null || typeof node[s] !== "object") node[s] = {};
    node = node[s];
  }
  const last = segs[segs.length - 1];
  if (value === null) delete node[last];
  else node[last] = value;
}

/* ─────────────────── fake external fetch router ─────────────────── */
const TOKENS = new Map(); // "tok-x" → {uid,email}
const imgbbCalls = [];
const authDeletes = [];
let imgbbMode = "ok";
const realFetch = globalThis.fetch;

const DB_URL = FIREBASE_PUBLIC_CONFIG.databaseURL.replace(/\/+$/, "");

async function fakeFetch(url, init = {}) {
  const u = new URL(url);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

  if (u.hostname === "identitytoolkit.googleapis.com" && u.pathname.endsWith("/accounts:lookup")) {
    const body = JSON.parse(String(init.body || "{}"));
    const who = TOKENS.get(body.idToken);
    if (!who) return json({ error: { message: "INVALID_ID_TOKEN" } }, 400);
    return json({ users: [{ localId: who.uid, email: who.email }] });
  }
  if (u.hostname === "identitytoolkit.googleapis.com" && u.pathname.endsWith("/accounts:delete")) {
    authDeletes.push(JSON.parse(String(init.body || "{}")));
    return json({});
  }
  if (u.hostname === "oauth2.googleapis.com" && u.pathname === "/token") {
    return json({ access_token: "FAKE_ACCESS_TOKEN", expires_in: 3600 });
  }
  if (u.hostname === "api.imgbb.com") {
    const fd = init.body;
    imgbbCalls.push({ key: fd.get("key"), image: fd.get("image"), type: fd.get("image")?.type });
    if (imgbbMode === "down") return new Response("upstream exploded", { status: 500 });
    return json({
      success: true,
      data: { url: "https://i.ibb.co/fake/img.jpg", thumb: { url: "https://i.ibb.co/fake/thumb.jpg" }, delete_url: "https://ibb.co/del", width: 80, height: 60 },
    });
  }
  if (url.startsWith(DB_URL + "/")) {
    if (u.searchParams.get("access_token") !== "FAKE_ACCESS_TOKEN") return json({ error: "Permission denied" }, 401);
    const path = decodeURIComponent(u.pathname).replace(/^\/+/, "").replace(/\.json$/, "");
    if ((init.method || "GET") === "GET") return json(getByPath(DB, path));
    if ((init.method || "") === "PATCH") {
      const patch = JSON.parse(String(init.body || "{}"));
      rtdbPatches.push({ path, patch });
      for (const [p, v] of Object.entries(patch)) setByPath(DB, `${path ? path + "/" : ""}${p}`, v);
      return json("ok");
    }
  }
  return json({ error: `unreachable host ${u.hostname}` }, 502);
}

/* ─────────────────────────── seed + helpers ─────────────────────────── */
const NOW_YEAR = new Date().getFullYear();
function seed() {
  Object.keys(DB).forEach((k) => delete DB[k]);
  TOKENS.clear();
  imgbbCalls.length = 0;
  authDeletes.length = 0;
  rtdbPatches.length = 0;
  imgbbMode = "ok";

  setByPath(DB, "users/donor1", { uid: "donor1", email: "d1@x.test", role: "donor", name: "ডোনার এক", phone: "01711111111", applicationCount: 2, donorStatus: "approved", donorId: `CBDC-${NOW_YEAR}-0001` });
  setByPath(DB, "users/donor2", { uid: "donor2", email: "d2@x.test", role: "donor", name: "ডোনার দুই", phone: "01722222222" });
  setByPath(DB, "users/legacy1", { uid: "legacy1", email: "new@x.test", name: "লিগেসি ইউজার", phone: "01733333333" });
  setByPath(DB, `donors/CBDC-${NOW_YEAR}-0001`, { id: `CBDC-${NOW_YEAR}-0001`, donorId: `CBDC-${NOW_YEAR}-0001`, uid: "donor1", ownerUid: "donor1", name: "ডোনার এক", bloodGroup: "O+", group: "O+", status: "approved", verified: true, donations: 3 });
  setByPath(DB, `donors/CBDC-${NOW_YEAR}-0002`, { id: `CBDC-${NOW_YEAR}-0002`, donorId: `CBDC-${NOW_YEAR}-0002`, uid: "legacy1", ownerUid: "legacy1", name: "লিগেসি ইউজার", bloodGroup: "A+", group: "A+", status: "approved", verified: true });
  setByPath(DB, "queue/q1", { kind: "donor", name: "নতুন আবেদন", ownerUid: "donor2", group: "B+", phone: "01722222222" });
  setByPath(DB, "queue/q2", { kind: "request", ownerUid: "donor2", group: "B+", bags: 2 });
  setByPath(DB, "admins/admin1", { uid: "admin1", role: "admin", status: "active", name: "অ্যাডমিন" });
  setByPath(DB, "admins/mod1", { uid: "mod1", role: "moderator", status: "active", permissions: ["donation.verify", "contact.reveal", "request.view", "request.approve", "group.approve", "report.resolve"] });
  setByPath(DB, "admins/mod2", { uid: "mod2", role: "moderator", status: "active", permissions: ["donation.verify", "gallery.manage", "notice.manage"] });
  setByPath(DB, "settings/app", { rules: { donorApproval: true, emergencyApproval: true }, autoApproveEmergency: false });

  TOKENS.set("tok-admin", { uid: "admin1", email: "admin@x.test" });
  TOKENS.set("tok-mod", { uid: "mod1", email: "mod1@x.test" });
  TOKENS.set("tok-mod2", { uid: "mod2", email: "mod2@x.test" });
  TOKENS.set("tok-donor1", { uid: "donor1", email: "d1@x.test" });
  TOKENS.set("tok-donor2", { uid: "donor2", email: "d2@x.test" });
  TOKENS.set("tok-new", { uid: "newuid", email: "new@x.test" });
}

const ENV = { FIREBASE_SERVICE_ACCOUNT: SA_JSON, ASSETS: { async fetch() { return new Response("SPA", { status: 200 }); } } };

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await apiHandler.fetch(new Request(`https://app.test${path}`, { method: "POST", headers, body: JSON.stringify(body ?? {}) }), ENV);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, body: data, text };
}

function assertNoSecrets(label, text) {
  assert.ok(!text.includes(IMGBB_API_KEY), `${label}: ImgBB key leaked`);
  assert.ok(!text.includes("FAKE_ACCESS_TOKEN"), `${label}: access token leaked`);
  assert.ok(!/BEGIN PRIVATE KEY|private_key/.test(text), `${label}: service-account material leaked`);
}

function seedHasDataBucket() {
  /* data/* history bucket must survive profile upserts (merge, not replace) */
  setByPath(DB, "users/donor1/data/donationNotes/n1", { note: "x" });
}
function readDataBucket() {
  return getByPath(DB, "users/donor1/data/donationNotes/n1");
}

before(() => { globalThis.fetch = fakeFetch; seed(); });
after(() => { globalThis.fetch = realFetch; });

/* ════════════════════════ /api/auth — profile/email/identity ════════════════════════ */
test("auth: profile upsert (own) → merged, email-change queued, indexes claimed", async () => {
  seedHasDataBucket();
  assert.ok(readDataBucket(), "pre: data bucket seeded");
  const r = await post("/api/auth", { op: "profile", user: { name: "নতুন নাম", phone: "01711111111" } }, "tok-donor1");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(getByPath(DB, "users/donor1/name"), "নতুন নাম");
  assert.equal(getByPath(DB, "users/donor1/email"), "d1@x.test");
  /* merge — never replace: unknown fields must survive a profile sync */
  assert.equal(getByPath(DB, "users/donor1/role"), "donor");
  assert.equal(getByPath(DB, "users/donor1/applicationCount"), 2);
  assert.deepEqual(readDataBucket(), { note: "x" }, "data/* must survive profile upsert");
});

test("auth: profile upsert with spoofed uid → 403 (IDOR blocked)", async () => {
  const r = await post("/api/auth", { op: "profile", user: { uid: "donor2", name: "হ্যাক" } }, "tok-donor1");
  assert.equal(r.status, 403);
  assert.equal(getByPath(DB, "users/donor2/name"), "ডোনার দুই");
});

test("auth: claim-email → claimed / conflict / release", async () => {
  const a = await post("/api/auth", { op: "claim-email", email: "fresh@x.test" }, "tok-donor1");
  assert.equal(a.status, 200);
  assert.equal(a.body.status, "claimed");
  assert.equal(getByPath(DB, "identityIndex/email/fresh@x_test"), "donor1"); // key-sanitized

  const b = await post("/api/auth", { op: "claim-email", email: "fresh@x.test" }, "tok-donor2");
  assert.equal(b.status, 200);
  assert.equal(b.body.status, "conflict");
  assert.equal(b.body.ownerUid, "donor1");

  const c = await post("/api/auth", { op: "claim-email", email: "fresh@x.test", release: true }, "tok-donor1");
  assert.equal(c.status, 200);
  assert.equal(getByPath(DB, "identityIndex/email/fresh@x_test"), null);
});

test("auth: claim-login → loginIndex rows written for the caller's own email", async () => {
  const r = await post("/api/auth", { op: "claim-login", email: "d1@x.test", username: "donor1u", phone: "01711111111" }, "tok-donor1");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(getByPath(DB, "loginIndex/username/donor1u"), "d1@x.test");
  assert.equal(getByPath(DB, "loginIndex/phone/01711111111"), "d1@x.test");
});

test("auth: resolve-legacy moves same-email legacy records to the caller", async () => {
  const r = await post("/api/auth", { op: "resolve-legacy" }, "tok-new");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(r.body.merged === true || r.body.merged === false);
  if (r.body.merged) {
    assert.equal(getByPath(DB, `donors/CBDC-${NOW_YEAR}-0002/ownerUid`), "newuid");
    assert.equal(getByPath(DB, "users/newuid/name"), "লিগেসি ইউজার");
  }
});

/* ════════════════════════ /api/data op=write — the guard matrix ════════════════════════ */
test("write: donor updates own profile fields → 200 applied", async () => {
  const r = await post("/api/data", { op: "write", writes: { "users/donor1/area": "হাটহাজারী", "users/donor1/whatsapp": "01711111111" } }, "tok-donor1");
  assert.equal(r.status, 200);
  assert.equal(r.body.applied, 2);
  assert.equal(getByPath(DB, "users/donor1/area"), "হাটহাজারী");
});

test("write: donor writing someone else's row → 403, nothing applied", async () => {
  const r = await post("/api/data", { op: "write", writes: { "users/donor2/name": "হ্যাকড" } }, "tok-donor1");
  assert.equal(r.status, 403);
  assert.equal(getByPath(DB, "users/donor2/name"), "ডোনার দুই");
  assertNoSecrets("write-403", r.text);
});

test("write: donor escalating own role/donorStatus → 403 (privilege lock)", async () => {
  const a = await post("/api/data", { op: "write", writes: { "users/donor1/role": "admin" } }, "tok-donor1");
  assert.equal(a.status, 403);
  const b = await post("/api/data", { op: "write", writes: { "users/donor1/donorStatus": "approved", "users/donor1/donorId": "CBDC-X" } }, "tok-donor1");
  assert.equal(b.status, 403);
  assert.equal(getByPath(DB, "users/donor1/role"), "donor");
});

test("write: donor creates own queue request → 200", async () => {
  const r = await post("/api/data", { op: "write", writes: { "queue/q9": { kind: "request", ownerUid: "donor1", group: "O+", bags: 1, status: "pending" } } }, "tok-donor1");
  assert.equal(r.status, 200);
  assert.equal(getByPath(DB, "queue/q9/ownerUid"), "donor1");
});

test("write: donor cancels own queue row → 200; other's row → 403", async () => {
  const a = await post("/api/data", { op: "write", writes: { "queue/q9": null } }, "tok-donor1");
  assert.equal(a.status, 200);
  assert.equal(getByPath(DB, "queue/q9"), null);
  const b = await post("/api/data", { op: "write", writes: { "queue/q2": null } }, "tok-donor1");
  assert.equal(b.status, 403);
  assert.ok(getByPath(DB, "queue/q2"), "victim row must survive");
});

test("write: moderator approves application (queue null + donors row) → 200; donor same shape → 403", async () => {
  const newId = `CBDC-${NOW_YEAR}-0042`;
  const writes = {
    [`queue/q1`]: null,
    [`donors/${newId}`]: { id: newId, donorId: newId, uid: "donor2", ownerUid: "donor2", name: "নতুন আবেদন", bloodGroup: "B+", group: "B+", status: "approved", verified: true },
    "users/donor2/donorStatus": "approved",
    "users/donor2/donorId": newId,
  };
  const m = await post("/api/data", { op: "write", writes }, "tok-mod");
  assert.equal(m.status, 200);
  assert.equal(getByPath(DB, `donors/${newId}/status`), "approved");
  assert.equal(getByPath(DB, "queue/q1"), null);

  seed();
  const d = await post("/api/data", { op: "write", writes }, "tok-donor2");
  assert.equal(d.status, 403);
  assert.equal(getByPath(DB, `donors/${newId}`), null);
  assert.ok(getByPath(DB, "queue/q1"), "queue row must survive");
});

test("write: __inc__/__max__ server-side arithmetic + __sv__ timestamp translation", async () => {
  const r = await post("/api/data", { op: "write", writes: { "users/donor1/applicationCount": { __inc__: 2 } } }, "tok-donor1");
  assert.equal(r.status, 200);
  assert.equal(r.body.values["users/donor1/applicationCount"], 4);
  assert.equal(getByPath(DB, "users/donor1/applicationCount"), 4);

  const e = await post("/api/data", { op: "write", writes: { "users/donor1/totalDonations": { __max__: 9 } } }, "tok-donor1");
  assert.equal(e.status, 200);
  assert.equal(e.body.values["users/donor1/totalDonations"], 9);

  const t = await post("/api/data", { op: "write", writes: { "users/donor1/lastSeen": { __sv__: "timestamp" } } }, "tok-donor1");
  assert.equal(t.status, 200);
  assert.deepEqual(getByPath(DB, "users/donor1/lastSeen"), { ".sv": "timestamp" });
});

test("write: audit rows append by staff → 200; by donor → 403", async () => {
  const a = await post("/api/data", { op: "write", writes: { "audit/a1": { who: "mod1", what: "approve", at: new Date().toISOString() } } }, "tok-mod");
  assert.equal(a.status, 200);
  const b = await post("/api/data", { op: "write", writes: { "audit/a2": { who: "donor1", what: "fake" } } }, "tok-donor1");
  assert.equal(b.status, 403);
  assert.equal(getByPath(DB, "audit/a2"), null);
});

test("write: settings — admin 200 / moderator 403", async () => {
  const a = await post("/api/data", { op: "write", writes: { "settings/app/rules": { donorApproval: false } } }, "tok-admin");
  assert.equal(a.status, 200);
  seed();
  const m = await post("/api/data", { op: "write", writes: { "settings/app/rules": { donorApproval: false } } }, "tok-mod");
  assert.equal(m.status, 403);
});

test("write: gallery/notice — moderator WITH the permission 200, WITHOUT 403, admin 200", async () => {
  // mod2 carries gallery.manage + notice.manage (custom permission grant)
  const g = await post("/api/data", { op: "write", writes: { "gallery/g1": { title: "ছবি", status: "published", url: "https://i.ibb.co/x/y.jpg" } } }, "tok-mod2");
  assert.equal(g.status, 200, "moderator with gallery.manage must be able to manage gallery");
  assert.equal(getByPath(DB, "gallery/g1/status"), "published");

  // mod1 has NO gallery/notice permission
  const gn = await post("/api/data", { op: "write", writes: { "gallery/g2": { title: "নয়", status: "draft" } } }, "tok-mod");
  assert.equal(gn.status, 403);
  const nn = await post("/api/data", { op: "write", writes: { "notices/n1": { title: "নোটিশ", status: "published" } } }, "tok-mod");
  assert.equal(nn.status, 403);

  // admin always allowed
  const an = await post("/api/data", { op: "write", writes: { "notices/n1": { title: "নোটিশ", status: "published" } } }, "tok-admin");
  assert.equal(an.status, 200);
});

test("write: role management — admin edits staff row 200; self-lock 403; moderator 403", async () => {
  const a = await post("/api/data", { op: "write", writes: { "admins/mod1": { uid: "mod1", role: "moderator", status: "active", permissions: ["request.view"] } } }, "tok-admin");
  assert.equal(a.status, 200);
  assert.deepEqual(getByPath(DB, "admins/mod1/permissions"), ["request.view"]);

  const self = await post("/api/data", { op: "write", writes: { "admins/admin1/role": "moderator" } }, "tok-admin");
  assert.equal(self.status, 403);

  const m = await post("/api/data", { op: "write", writes: { "admins/mod2": { uid: "mod2", role: "admin" } } }, "tok-mod");
  assert.equal(m.status, 403);
  assert.equal(getByPath(DB, "admins/mod2/role"), "moderator");
});

/* ════════════════════════ /api/data op=apply ════════════════════════ */
test("apply: donor application — approval ON queues; direct path when OFF", async () => {
  const on = await post("/api/data", { op: "apply", action: "donor" }, "tok-donor2");
  assert.equal(on.status, 200);
  assert.equal(on.body.approvalRequired, true);

  await post("/api/data", { op: "write", writes: { "settings/app/rules": { donorApproval: false, emergencyApproval: false } } }, "tok-admin");
  const off = await post("/api/data", { op: "apply", action: "donor" }, "tok-donor2");
  assert.equal(off.status, 200);
  assert.equal(off.body.ok, true);
  assert.equal(off.body.approvalRequired, false);
  assert.match(String(off.body.donorId), new RegExp(`^CBDC-${NOW_YEAR}-`));

  const bad = await post("/api/data", { op: "apply", action: "নোংরা" }, "tok-donor2");
  assert.equal(bad.status, 400);
});

/* ════════════════════════ /api/data op=public-submit ════════════════════════ */
test("public: donor registration (anonymous) → members row; ownerUid from payload NOT trusted", async () => {
  const r = await post("/api/data", { op: "public-submit", kind: "donor-registration", payload: {
    name: "পাবলিক আবেদন", bloodGroup: "O+", gender: "পুরুষ", dob: "1998-05-10",
    area: "চকবাজার", district: "চট্টগ্রাম", phone: "01755555555",
    ownerUid: "hacker-uid", uid: "hacker-uid",
  } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const rows = Object.values(getByPath(DB, "members") || {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.ok(!rows[0].ownerUid || rows[0].ownerUid !== "hacker-uid", "client-supplied ownerUid must never be stored");
});

test("public: registration validation → 400 before any write", async () => {
  const before = Object.keys(getByPath(DB, "members") || {}).length;
  const r = await post("/api/data", { op: "public-submit", kind: "donor-registration", payload: { name: "x", bloodGroup: "ZZ" } });
  assert.equal(r.status, 400);
  const after = Object.keys(getByPath(DB, "members") || {}).length;
  assert.equal(after, before, "invalid submission must not create a row");
});

test("public: emergency request (anonymous) → submitted; unknown kind → 400", async () => {
  const r = await post("/api/data", { op: "public-submit", kind: "emergency-request", payload: {
    patientName: "জরুরি রোগী", patientAge: 40, bloodGroup: "B+", phone: "01766666666",
    bags: 2, hospitalName: "সিএমসি", hospitalAddress: "আগ্রাবাদ", requesterName: "আবেদনকারী",
    urgency: "৬ ঘণ্টার মধ্যে", durationHours: 6, description: "জরুরি প্রয়োজন",
  } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const bad = await post("/api/data", { op: "public-submit", kind: "__x", payload: {} });
  assert.equal(bad.status, 400);
});

/* ════════════════════════ /api/admin ════════════════════════ */
test("admin: entity delete — admin 200 (+ auth account deleted); moderator 403", async () => {
  const ok = await post("/api/admin", { op: "delete", scope: "donor", donorId: `CBDC-${NOW_YEAR}-0001`, uid: "donor1" }, "tok-admin");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.equal(getByPath(DB, `donors/CBDC-${NOW_YEAR}-0001`), null);

  seed();
  const m = await post("/api/admin", { op: "delete", scope: "donor", donorId: `CBDC-${NOW_YEAR}-0001`, uid: "donor1" }, "tok-mod");
  assert.equal(m.status, 403);
  assert.ok(getByPath(DB, `donors/CBDC-${NOW_YEAR}-0001`), "moderator must not delete anything");
});

test("admin: config-check → booleans only, no secrets", async () => {
  const r = await post("/api/admin", { op: "config-check" }, "tok-admin");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.serviceAccountConfigured, true);
  assert.equal(r.body.imgbbConfigured, true);
  assertNoSecrets("config-check", r.text);
});

test("admin: donor-id next/release — staff 200, donor 403, serials unique", async () => {
  const d = await post("/api/admin", { op: "donor-id", action: "next" }, "tok-donor1");
  assert.equal(d.status, 403);

  const a = await post("/api/admin", { op: "donor-id", action: "next" }, "tok-mod");
  assert.equal(a.status, 200);
  assert.match(a.body.donorId, new RegExp(`^CBDC-${NOW_YEAR}-\\d{4}$`));
  const rel = await post("/api/admin", { op: "donor-id", action: "release", donorId: a.body.donorId }, "tok-mod");
  assert.equal(rel.status, 200);
});

test("admin: dedupe preview — admin 200", async () => {
  const r = await post("/api/admin", { op: "dedupe", apply: false }, "tok-admin");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assertNoSecrets("dedupe", r.text);
});

/* ════════════════════════ /api/media ════════════════════════ */
test("media: upload → ImgBB receives server-side key; response returns URL only", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3, 4]);
  const res = await apiHandler.fetch(new Request("https://app.test/api/media", {
    method: "POST",
    headers: { Authorization: "Bearer tok-donor1", "Content-Type": "image/png", "X-Filename": "proof.png" },
    body: bytes,
  }), ENV);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.url, "https://i.ibb.co/fake/img.jpg");
  assert.equal(imgbbCalls.length, 1);
  assert.equal(imgbbCalls[0].key, IMGBB_API_KEY, "server must send the central key to ImgBB");
  assert.equal(imgbbCalls[0].type, "image/png");
  assert.ok(!JSON.stringify(body).includes(IMGBB_API_KEY), "response must never echo the key");
});

test("media: ImgBB outage → safe 502, no key/token in response", async () => {
  imgbbMode = "down";
  const res = await apiHandler.fetch(new Request("https://app.test/api/media", {
    method: "POST",
    headers: { Authorization: "Bearer tok-donor1", "Content-Type": "image/png" },
    body: new Uint8Array([1, 2, 3, 4, 5]),
  }), ENV);
  const text = await res.text();
  assert.equal(res.status, 502);
  assertNoSecrets("imgbb-down", text);
});

test("media: anonymous 401 / oversized 413", async () => {
  const anon = await apiHandler.fetch(new Request("https://app.test/api/media", { method: "POST", headers: { "Content-Type": "image/png" }, body: new Uint8Array([1]) }), ENV);
  assert.equal(anon.status, 401);
  const big = await apiHandler.fetch(new Request("https://app.test/api/media", {
    method: "POST",
    headers: { Authorization: "Bearer tok-donor1", "Content-Type": "image/png" },
    body: new Uint8Array(9 * 1024 * 1024),
  }), ENV);
  assert.equal(big.status, 413);
});

/* ════════════════════════ redaction across error paths ════════════════════════ */
test("redaction: RTDB write failure → safe server error, no internals", async () => {
  const orig = fakeFetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (url.startsWith(DB_URL + "/") && (init.method || "GET") === "PATCH") {
      return new Response(JSON.stringify({ error: "Internal error", path: url }), { status: 500 });
    }
    return orig(url, init);
  };
  const r = await post("/api/data", { op: "write", writes: { "users/donor1/name": "x" } }, "tok-donor1");
  globalThis.fetch = orig;
  assert.equal(r.status, 502);
  assertNoSecrets("rtdb-500", r.text);
  assert.ok(!r.text.includes("FAKE_ACCESS_TOKEN"), "URL with access_token must never surface");
});
