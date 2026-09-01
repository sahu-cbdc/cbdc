/**
 * API routing — every /api/... request MUST be intercepted by the Worker
 * ═══════════════════════════════════════════════════════════════════════════
 * Regression tests: reserved /api/ endpoints and unknown /api/ routes must
 * NEVER fall through to env.ASSETS.fetch() / the Website SPA fallback.
 *
 *   • A browser GET to a POST-only protected endpoint (`/api/donor/apply`)
 *     must return a proper JSON 405 Method Not Allowed — not the Website HTML.
 *   • Unknown / nonexistent `/api/...` routes must return an API-style JSON
 *     404 — not the Website homepage.
 *   • Non-API paths (e.g. `/`) must still serve the Website (unchanged).
 *
 * The fake `env.ASSETS` records whether it was ever called, so a regression
 * (routing an /api path into the SPA fallback) fails loudly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import apiHandler from "../server/index.ts";

const read = (p) => readFileSync(p, "utf8");

const SPA_HTML = "<!doctype html><html><body>Website SPA</body></html>";

function makeEnv() {
  const calls = [];
  const env = {
    calls,
    ASSETS: {
      async fetch(request) {
        calls.push(new URL(request.url).pathname);
        return new Response(SPA_HTML, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  };
  return env;
}

async function fetchRaw(env, path, method, init = {}) {
  return apiHandler.fetch(new Request("https://example.test" + path, { method, ...init }), env);
}

test("GET /api/donor/apply → 405 JSON, never reaches Website SPA fallback", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/donor/apply", "GET");
  assert.equal(res.status, 405, "POST-only endpoint must return 405");
  const contentType = res.headers.get("content-type") || "";
  assert.match(contentType, /application\/json/, "must be a JSON response");
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "POST only");
  assert.equal(env.calls.length, 0, "env.ASSETS.fetch() must never be called for an /api path");
});

test("GET /api/donor/apply with ASSETS present → 405 JSON, never SPA HTML", async () => {
  /* Same request but explicitly with a working ASSETS (SPA) environment. */
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/donor/apply", "GET");
  const text = await res.text();
  assert.equal(res.status, 405);
  assert.match(text, /"error":"POST only"/);
  assert.doesNotMatch(text, /<!doctype html|Website SPA/);
  assert.equal(env.calls.length, 0, "SPA fallback must not be reached");
});

test("unknown /api route → 404 JSON, never Website homepage/SPA", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/donor/nonexistent", "GET");
  assert.equal(res.status, 404);
  const contentType = res.headers.get("content-type") || "";
  assert.match(contentType, /application\/json/, "must be an API-style JSON 404");
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /খুঁজে পাওয়া যায়নি|পাওয়া যায়নি/);
  assert.equal(env.calls.length, 0, "SPA fallback must not be reached for unknown /api routes");
});

test("unknown /api route (POST) → 404 JSON, never Website homepage/SPA", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/unknown/endpoint", "POST", { body: "{}" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  assert.equal(env.calls.length, 0, "SPA fallback must not be reached");
});

test("non-API path still serves the Website SPA (behavior unchanged)", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/", "GET");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  assert.equal(await res.text(), SPA_HTML);
  assert.deepEqual(env.calls, ["/"], "non-API path routed to ASSETS as before");
});

test("non-API deep path (client-side route) still serves the Website SPA", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/donor/dashboard", "GET");
  assert.equal(res.status, 200);
  assert.deepEqual(env.calls, ["/donor/dashboard"], "non-API SPA fallback preserved");
});

test("POST-only endpoint rejects other verbs too (PUT/DELETE → 405 JSON)", async () => {
  for (const method of ["PUT", "DELETE", "PATCH", "GET"]) {
    const env = makeEnv();
    const res = await fetchRaw(env, "/api/donor/apply", method);
    assert.equal(res.status, 405, `${method} must be rejected`);
    assert.match(res.headers.get("content-type") || "", /application\/json/);
    assert.equal(env.calls.length, 0);
  }
});

test("OPTIONS preflight on /api path is still handled by the Worker (not SPA)", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/donor/apply", "OPTIONS", {
    headers: { Origin: "https://chawkbazarbloodclub.com", "Access-Control-Request-Method": "POST" },
  });
  assert.ok([204, 403].includes(res.status));
  assert.equal(env.calls.length, 0, "preflight must not fall through to SPA");
});

test("GET /api/donor/apply with browser navigate header → still 405 JSON, never SPA", async () => {
  const env = makeEnv();
  const res = await fetchRaw(env, "/api/donor/apply", "GET", {
    headers: { "Sec-Fetch-Mode": "navigate" },
  });
  assert.equal(res.status, 405);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  assert.equal(env.calls.length, 0, "navigation request to /api must be handled by the Worker");
});

/* ── Deployment config: the Worker MUST be invoked first for /api/* ── */

test("wrangler.jsonc routes /api/* to the Worker before SPA fallback (run_worker_first)", () => {
  const cfg = read("wrangler.jsonc");
  assert.match(cfg, /"run_worker_first"\s*:\s*\[\s*"\/api\/\*"/, "run_worker_first must include /api/*");
  assert.match(cfg, /"not_found_handling"\s*:\s*"single-page-application"/, "SPA fallback preserved");
  assert.match(cfg, /"main"\s*:\s*"server\/index\.ts"/, "Worker entry is server/index.ts");
  assert.match(cfg, /"binding"\s*:\s*"ASSETS"/, "ASSETS binding exposed to Worker code");
  assert.doesNotMatch(cfg, /"run_worker_first"\s*:\s*true\b/, "must not be global worker-first (keeps non-API asset serving fast)");
});

