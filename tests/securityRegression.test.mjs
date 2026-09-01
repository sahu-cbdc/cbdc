/**
 * Security regression suite — API-only write architecture.
 * ═══════════════════════════════════════════════════════════════════
 * Behavioral + source pins for the guarantees the migration introduced:
 *
 *   • public submit is allow-list based (no mass-assignment of
 *     role/verified/donorId/ownerUid from the request payload),
 *   • the write guard blocks IDOR (user A touching user B's records),
 *     privilege escalation (self role/donorStatus/donorId writes) and
 *     admin-row takeover,
 *   • server data access never uses the caller's ID token against RTDB
 *     (service account only), so locked rules cannot break admin flows.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handlePublicSubmit from "../server/publicApi.ts";
import apiHandler from "../server/index.ts";
import { ApiError } from "../server/deleteApi.ts";
import { authorizeDataWrite, callerRoleFromAdminRow } from "../server/writeGuard.ts";

const read = (p) => readFileSync(p, "utf8");

function makePublicIo({ verified = null, listRows = {} } = {}) {
  const patched = {};
  return {
    patched,
    io: {
      verifyToken: async () => verified,
      get: async (path) => {
        if (path === "settings/app") return null;
        return null;
      },
      list: async (node) => listRows[node] ?? null,
      patch: async (paths) => Object.assign(patched, paths),
    },
  };
}

test("public submit: donor-registration strips untrusted payload fields (allow-list only)", async () => {
  const { io, patched } = makePublicIo({ verified: { uid: "user-a", email: "a@x.test" }, listRows: { donors: {}, members: {} } });
  const res = await handlePublicSubmit(
    {
      kind: "donor-registration",
      payload: {
        name: "করিম",
        bloodGroup: "O+",
        gender: "male",
        dob: "2000-01-01",
        area: "চকবাজার",
        phone: "01712345678",
        role: "admin",
        verified: true,
        donorId: "CBDC-2026-0001",
        permissions: ["*"],
        status: "approved",
        ownerUid: "victim-uid",
        uid: "spoof-uid",
        junk: "x".repeat(64),
      },
    },
    io,
    "token",
  );
  assert.equal(res.duplicate, false);
  const member = Object.entries(patched).find(([k]) => k.startsWith("members/"))?.[1];
  assert.ok(member, "member row written");
  assert.equal(member.status, "pending", "status is always server-pending");
  assert.equal(member.uid, "user-a", "uid comes from the verified token");
  assert.equal(member.ownerUid, "user-a", "ownerUid comes from the verified token");
  for (const banned of ["role", "verified", "donorId", "permissions", "junk"]) {
    assert.equal(member[banned], undefined, `payload.${banned} must not be persisted`);
  }
});

test("public submit: anonymous registration keeps ownerUid empty and status pending", async () => {
  const { io, patched } = makePublicIo();
  await handlePublicSubmit(
    {
      kind: "donor-registration",
      payload: {
        name: "রহিম",
        bloodGroup: "A+",
        gender: "male",
        dob: "1999-05-05",
        area: "বাকলিয়া",
        phone: "01812345678",
        ownerUid: "attacker-uid",
        uid: "attacker-uid",
        status: "approved",
      },
    },
    io,
    "",
  );
  const member = Object.entries(patched).find(([k]) => k.startsWith("members/"))?.[1];
  assert.ok(member);
  assert.equal(member.uid, undefined);
  assert.equal(member.ownerUid, undefined, "anonymous rows carry no spoofable owner");
  assert.equal(member.status, "pending");
  const queueRow = Object.entries(patched).find(([k]) => k.startsWith("queue/"))?.[1];
  assert.equal(queueRow.ownerUid, "");
});

test("public submit: emergency request requires a verified login", async () => {
  const { io } = makePublicIo({ verified: null });
  await assert.rejects(
    () => handlePublicSubmit({ kind: "emergency-request", payload: {} }, io, ""),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

function makeGuardIo(db = {}) {
  return {
    get: async (path) => (path in db ? db[path] : null),
  };
}

const donorA = callerRoleFromAdminRow(null, "user-a", "a@x.test");
const donorB = callerRoleFromAdminRow(null, "user-b", "b@x.test");

test("write guard: IDOR — user A cannot edit/delete user B's member row", async () => {
  const io = makeGuardIo({ "members/m1": { id: "m1", uid: "user-b", ownerUid: "user-b", status: "approved" } });
  await assert.rejects(
    () => authorizeDataWrite(donorA, { writes: { "members/m1": { name: "spoof" } } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
  await assert.rejects(
    () => authorizeDataWrite(donorA, { writes: { "members/m1": null } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("write guard: IDOR — user A cannot edit user B's request or read-protected rows", async () => {
  const io = makeGuardIo({ "requests/r1": { id: "r1", ownerUid: "user-b", status: "pending" } });
  await assert.rejects(
    () => authorizeDataWrite(donorA, { writes: { "requests/r1": { note: "x" } } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("write guard: privilege escalation — self role/donorStatus/donorId locked", async () => {
  const io = makeGuardIo({ "users/user-a": { uid: "user-a", role: "donor", bloodGroup: "O+" } });
  for (const [writes, label] of [
    [{ "users/user-a": { role: "admin" } }, "whole-row role"],
    [{ "users/user-a/role": "admin" }, "sub-path role"],
    [{ "users/user-a/donorStatus": "approved" }, "donorStatus"],
    [{ "users/user-a/donorId": "CBDC-2026-0009" }, "donorId"],
  ]) {
    await assert.rejects(
      () => authorizeDataWrite(donorA, { writes }, io),
      (e) => e instanceof ApiError && e.status === 403,
      label,
    );
  }
});

test("write guard: admins-row takeover blocked for non-admin callers", async () => {
  const io = makeGuardIo({});
  await assert.rejects(
    () => authorizeDataWrite(donorA, { writes: { "admins/user-a": { role: "admin", status: "active" } } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("write guard: non-staff cannot create donation records; moderator create-only holds", async () => {
  const donation = { livesSaved: 1, donorId: "CBDC-2026-0001", ownerUid: "user-a", date: "2026-08-01", place: "হাসপাতাল" };
  await assert.rejects(
    () => authorizeDataWrite(donorA, { writes: { "donations/d1": donation } }, makeGuardIo({})),
    (e) => e instanceof ApiError && e.status === 403,
  );
  const mod = callerRoleFromAdminRow({ role: "moderator", status: "active" }, "mod-1", "m@x.test");
  const plan = await authorizeDataWrite(mod, { writes: { "donations/d1": donation } }, makeGuardIo({}));
  assert.equal(plan.patch["donations/d1"].livesSaved, 1);
  const io = makeGuardIo({ "donations/d1": donation });
  await assert.rejects(
    () => authorizeDataWrite(mod, { writes: { "donations/d1": { ...donation, bags: 5 } } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("write guard: legitimate self writes still pass", async () => {
  const io = makeGuardIo({ "users/user-a": { uid: "user-a", role: "donor", phone: "01700000000" } });
  const plan = await authorizeDataWrite(donorA, { writes: { "users/user-a/phone": "01711111111" } }, io);
  assert.equal(plan.patch["users/user-a/phone"], "01711111111");
  const q = await authorizeDataWrite(
    donorA,
    { writes: { "queue/q9": { kind: "donation", ownerUid: "user-a" } } },
    makeGuardIo({ "users/user-a": { uid: "user-a", bloodGroup: "O+" } }),
  );
  assert.equal(q.patch["queue/q9"].kind, "donation");
});

test("write guard: user B cannot pivot onto user A's users row via data/write", async () => {
  const io = makeGuardIo({ "users/user-a": { uid: "user-a" } });
  await assert.rejects(
    () => authorizeDataWrite(donorB, { writes: { "users/user-a": { phone: "01700000000" } } }, io),
    (e) => e instanceof ApiError && e.status === 403,
  );
});

test("httpIo: admin delete/dedupe IO uses the service account, never the caller's token", () => {
  const src = read("server/httpIo.ts");
  assert.match(src, /export function makeHttpIo\(env: HttpEnv, fetchImpl: typeof fetch = fetch\): DeleteIo/);
  assert.match(src, /const priv = makePrivilegedIo\(env, undefined, fetchImpl\)/);
  assert.doesNotMatch(src, /\?auth=/, "no user-token REST auth param may remain");
  const server = read("server/index.ts");
  assert.doesNotMatch(server, /makeHttpIo\(env, idToken\)/);
  const vite = read("vite.config.ts");
  assert.doesNotMatch(vite, /makeHttpIo\(serverEnv, idToken\)/);
});

test("dev middleware: unknown /api routes return the same JSON 404 as the Worker", () => {
  const vite = read("vite.config.ts");
  assert.ok(
    vite.includes('if (/^\\/api\\//i.test(apiPath)) {') && /send\(res, 404,[\s\S]*?খুঁজে পাওয়া যায়নি/.test(vite),
    "dev middleware must answer unknown /api with the JSON 404, not fall through",
  );
  const server = read("server/index.ts");
  assert.match(server, /status: 404, corsHeaders/);
});

test("gateway: exactly four central API endpoints — auth/data/admin/media", () => {
  const index = read("server/index.ts");
  const client = read("src/config/api.ts");
  for (const gw of ["auth", "data", "admin", "media"]) {
    assert.ok(index.includes(String.raw`${gw}: /\/api\/${gw}$/i`), `server gateway ${gw} registered`);
    assert.ok(client.includes(`${gw}: "api/${gw}"`), `client gateway ${gw}`);
  }
});

test("gateway: legacy one-off endpoint routes are gone (server + client)", () => {
  const server = read("server/index.ts");
  for (const legacy of [
    "api/data/write",
    "api/account/profile",
    "api/account/claim-",
    "api/donor/apply",
    "api/donor/id",
    "api/public/submit",
    "api/images/upload",
    "api/admin/delete",
    "api/admin/dedupe",
    "api/admin/config-check",
  ]) {
    assert.ok(!server.includes(legacy), `server must not reference legacy route ${legacy}`);
  }
  for (const f of ["api", "imgbb", "applyRequest", "accountDelete", "rtdb", "identity"]) {
    const lib = read(`src/lib/${f}.ts`);
    for (const legacy of [
      "api/data/write",
      "api/account/",
      "api/donor/apply",
      "api/donor/id",
      "api/public/submit",
      "api/images/upload",
      "api/admin/",
    ]) {
      assert.ok(!lib.includes(legacy), `${f}.ts must use API_GATEWAYS, not ${legacy}`);
    }
  }
});


test("gateway: ops dispatch — protected ops need a token, public-submit stays anonymous", async () => {
  const anon = await apiHandler.fetch(
    new Request("https://x/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "write", writes: {} }),
    }),
    {},
  );
  assert.equal(anon.status, 401, "op=write without a token must 401");

  const publicSubmit = await apiHandler.fetch(
    new Request("https://x/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "public-submit", kind: "donor-registration", payload: {} }),
    }),
    {},
  );
  assert.notEqual(publicSubmit.status, 401, "anonymous public-submit must pass the gateway (validation decides)");
  assert.equal((await publicSubmit.json()).ok, false, "empty payload fails validation, not auth");

  const unknownOp = await apiHandler.fetch(
    new Request("https://x/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ op: "nope" }),
    }),
    {},
  );
  assert.equal(unknownOp.status, 400, "unknown op → 400 JSON, never a fall-through");
});

test("config: single source — public values live ONLY in src/config, secrets ONLY server-side", () => {
  const serverCfg = read("server/config.ts");
  assert.match(serverCfg, /from "\.\.\/src\/config\/firebase\.ts"/, "server imports the shared public config");
  assert.match(serverCfg, /FIREBASE_PUBLIC_CONFIG\.apiKey/, "web key resolved from the shared source");
  for (const secret of ["FIREBASE_SERVICE_ACCOUNT", "IMGBB_API_KEY"]) {
    assert.match(serverCfg, new RegExp("e\\." + secret), `server reads ${secret} from env only`);
  }
  assert.doesNotMatch(serverCfg, /AIza/, "no hardcoded key value in server config");
  assert.doesNotMatch(serverCfg, /BEGIN PRIVATE KEY/);
  const index = read("server/index.ts");
  assert.match(index, /serverConfig\(env\)/, "router resolves config centrally");
  const httpIo = read("server/httpIo.ts");
  assert.match(httpIo, /from ".\/config.ts"/, "httpIo uses the central config");
  const fbCfg = read("src/config/firebase.ts");
  assert.match(fbCfg, /FIREBASE_PUBLIC_CONFIG/, "client firebase config lives in src/config");
  assert.match(fbCfg, /safe to bundle/, "documented as safe-to-bundle public config");
  assert.doesNotMatch(fbCfg, /SERVICE_ACCOUNT|IMGBB/, "no server secrets in the public config");
  assert.doesNotMatch(fbCfg, /import\.meta\.env/, "no build-env override — the file is the single source");
  const wrangler = read("wrangler.jsonc");
  assert.doesNotMatch(wrangler, /AIza/, "wrangler.jsonc must not duplicate the Firebase key");
  const lib = read("src/lib/firebase.ts");
  assert.match(lib, /FIREBASE_PUBLIC_CONFIG/, "client SDK init uses the shared config");
  assert.doesNotMatch(lib, /apiKey:\s*"/, "no inline key value in lib code");
});

test("pages: no direct Firebase SDK, ImgBB, or raw endpoint fetch in components", () => {
  for (const f of ["Home", "Admin", "Moderator", "Doner"]) {
    const page = read(`src/pages/${f}.tsx`);
    assert.doesNotMatch(page, /import\(["']firebase\//, `${f}: dynamic firebase SDK import`);
    assert.doesNotMatch(page, /from ["']firebase\//, `${f}: static firebase SDK import`);
    assert.doesNotMatch(page, /api\.imgbb\.com/, `${f}: direct ImgBB call`);
    assert.doesNotMatch(page, /fetch\(\s*appBase\(\)/, `${f}: raw endpoint fetch — pages use lib helpers`);
  }
  const authActions = read("src/lib/authActions.ts");
  assert.match(authActions, /createOrSignInEmailAccount/, "auth session actions centralized");
  assert.match(authActions, /reauthenticateWithCredential/, "re-auth lives in the helper");
  const siteCfg = read("src/lib/siteConfig.ts");
  assert.match(siteCfg, /INTERNAL_ENDPOINTS\.siteConfigSource/, "site-config channel lives in a helper");
});

test("imgbb: public config single-sourced in src/config/imgbb.ts; key stays server-side", () => {
  const cfg = read("src/config/imgbb.ts");
  assert.match(cfg, /IMGBB_PUBLIC_CONFIG/, "dedicated imgbb config file");
  assert.match(cfg, /uploadMaxBytes/, "upload ceiling defined here");
  assert.doesNotMatch(cfg, /[keyKey]\s*[:=]\s*["'][A-Za-z0-9]{10,}/, "no key VALUE in the public config");
  assert.doesNotMatch(cfg, /api\.imgbb\.com\/1\/upload\?key=/, "no keyed ImgBB URL");
  const lib = read("src/lib/imgbb.ts");
  assert.match(lib, /IMGBB_PUBLIC_CONFIG\.compression\.maxDimension/, "client compression uses the config");
  const api = read("server/imagesApi.ts");
  assert.match(api, /MAX_UPLOAD_BYTES = IMGBB_PUBLIC_CONFIG\.uploadMaxBytes/, "server limit single-sourced");
  const vite = read("vite.config.ts");
  assert.match(vite, /gateway === "media" \? IMGBB_PUBLIC_CONFIG\.uploadMaxBytes/, "dev middleware limit single-sourced");
  const dup = read("server/imagesApi.ts") + read("vite.config.ts") + read("src/lib/imgbb.ts");
  assert.doesNotMatch(dup, /8 \* 1024 \* 1024/, "no duplicated 8MB literal");
  assert.doesNotMatch(dup, /maxDim = 1600/, "no duplicated compression default");
});

test("secrets: no service-account material in client sources", () => {
  const src = read("src/lib/firebase.ts") + read("src/lib/api.ts") + read("src/lib/imgbb.ts");
  assert.doesNotMatch(src, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(src, /FIREBASE_SERVICE_ACCOUNT/);
  assert.doesNotMatch(src, /IMGBB_API_KEY\s*[:=]/);
  assert.doesNotMatch(src, /private_key/i);
});
