# CBDC — Security & API Architecture Audit

Repository: `sahu-cbdc/cbdc` · Website: https://chawkbazarbloodclub.com
Date of audit: 2026-08-31 · Branch: `arena/01a05814-cbdc`

This document contains the **full security audit** (pre-change), the **vulnerabilities
found**, the **fixes implemented**, the **complete API inventory**, and the **final
verification report**. It intentionally does not claim that "only `server/index.ts`
was enough" — the audit ran across the whole repository, and several files were
updated.

---

## A. Security model (existing architecture — how the app enforces security)

The app is a **client-side Firebase app** with a thin **Cloudflare Worker** for
privileged operations. Security is enforced by **three independent layers**:

| Layer | What it is | Role |
|---|---|---|
| 1. **Firebase Authentication** | Email/password + Google sign-in | Establishes the **identity** (UID). Sessions via browser persistence. |
| 2. **Realtime Database Security Rules** | `database.rules.json` | **Authorization** for every direct browser `<-> DB` read/write. |
| 3. **Worker server API** | `server/index.ts` + handlers | **Privileged** operations that must not be trusted to the browser (delete, dedupe, admin verification, image-upload proxy). |

**Important:** the browser is *never* trusted for role/UID. The client sends a
Firebase **ID token**; the server (Worker) verifies it via Identity Toolkit and
re-derives the UID. For direct DB access, the RTDB rules re-derive auth.uid from the
token too, so a client cannot forge a UID or role.

### Security map (where each operation happens)

| Operation | Layer |
|---|---|
| Login / Session / Logout | Client Firebase Auth + `src/lib/authState.ts` |
| Public reads (donors, requests, gallery, notices, settings/app) | Browser SDK → Rules (`read: true`) |
| Donor self-edit (own donor/user record) | Browser SDK → Rules (owner / self) |
| Admin/Moderator panel CRUD (queue, accounts, donors, requests, reports, notices...) | Browser SDK → Rules (staff `.write`) |
| **Account / Donor-ID deletion** | `POST /api/admin/delete` → Worker → rules |
| **Duplicate cleanup** | `POST /api/admin/dedupe` → Worker → rules |
| **Delete preflight** | `POST /api/admin/config-check` → Worker |
| **Legacy account merge** | `POST /api/account/resolve-legacy` → Worker (service-account) |
| **Approval-OFF direct processing** | `POST /api/donor/apply` → Worker (service-account) |
| **Image upload → ImgBB** | `POST /api/images/upload` → Worker (server-only key) |
| **Site config write (dev only)** | `__admin/site-config` (same-origin, dev middleware) |

---

## B. Vulnerabilities found (before fix)

| # | Severity | Issue | Where |
|---|---|---|---|
| **V1** | **High** | **Private ImgBB API key leaked to the browser.** The key was (a) embedded in the JS bundle via `VITE_IMGBB_API_KEY` (`getEnvImgbbKey()`), (b) stored in public RTDB `settings/imgbb` (`settings/.read: true`), and (c) cached in `localStorage` (`cbdc.imgbb.key`). Any visitor could read it and consume/abuse the ImgBB account. | `src/lib/imgbb.ts`, `.env`, `database.rules.json` |
| **V2** | **High** | **`settings` node was public-readable** (`".read": true`), exposing `settings/imgbb` (API key) and other config to anonymous users. | `database.rules.json` |
| **V3** | Medium | **No abuse/flood protection** on the Worker API endpoints — any authenticated caller could hammer `/api/donor/apply` or the new upload endpoint. | `server/index.ts` |
| **V4** | Medium | **No CORS policy** on the Worker — future cross-origin app requests were unhandled; using a blind `*` would be unsafe. No allowlist existed. | `server/index.ts` |
| **V5** | Low | Error paths already sanitized, but some server comments referenced the `FIREBASE_SERVICE_ACCOUNT` naming (no value leak — informational). | — |

**Observations that are *not* vulnerabilities (design decisions):**
- The public Firebase web API key (`AIzaSyBx...`) is present in the bundle — this is **correct**; it is a public client identifier, not a secret. Access control is via Auth + Rules, not by hiding the key.
- `loginIndex` maps username/phone → email publicly. This is required for the pre-auth login lookup and is a deliberate, low-sensitivity trade-off.
- Client panels do direct RTDB writes (donors/queue/accounts/etc.). This is the intended Firebase architecture — **Rules are the authorization layer** and they are well-constructed (detailed in §H/§I).

---

## C. Vulnerabilities fixed (implemented this session)

| # | Fix | Files |
|---|---|---|
| V1 | Moved ImgBB upload **server-side**. Browser now POSTs to `POST /api/images/upload`; the Worker holds the key (`IMGBB_API_KEY` secret, else privileged `settings/imgbb` read) and uploads. Client no longer reads/bundles/caches the key. | `server/imagesApi.ts` (new), `server/httpIo.ts`, `src/lib/imgbb.ts`, `server/index.ts`, `vite.config.ts` |
| V2 | Locked down `settings`: root read now requires staff; `settings/imgbb` **admin-read/write only**; `settings/app` stays public (website needs the approval rules). | `database.rules.json` |
| V3 | Added **intelligent abuse protection** (per-source sliding window, generous 600/min default, configurable, not a per-user normal quota; blocks only sustained floods → 429). | `server/abuseGuard.ts` (new), `server/index.ts` |
| V4 | Added **allowlist-based CORS** (defaults: site + `www` origins + `ALLOWED_ORIGINS` env; no `*`; preflight handled; CORS never used for auth). | `server/cors.ts` (new), `server/index.ts` |
| V5 | Added sanitized error/response paths + `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on all API responses. | `server/index.ts`, `server/imagesApi.ts` |

---

## D. Modified files

| File | Change |
|---|---|
| `server/index.ts` | Added `/api/images/upload`, allowlist CORS, configurable abuse/flood protection, unified token-gated routing, sanitized responses. |
| `server/httpIo.ts` | Added `ImagesIo` support (`makeImagesIo`) + `IMGBB_API_KEY` server-secret env. |
| `server/imagesApi.ts` | **New** — server-side ImgBB upload handler (auth → key → upload → sanitized URL). |
| `server/cors.ts` | **New** — pure allowlist CORS policy (testable). |
| `server/abuseGuard.ts` | **New** — pure sliding-window abuse protection (testable, not a normal-user quota). |
| `vite.config.ts` | Mounted `/api/images/upload` in the dev middleware (raw-body handling); added `IMGBB_API_KEY` to dev server env. |
| `src/lib/imgbb.ts` | Removed client secret reads (env/cache/RTDB-key); `uploadImage` now goes through the secure server endpoint; key only server-side. |
| `database.rules.json` | `settings` no longer public-readable; `settings/imgbb` admin-only; `settings/app` public. |
| `.env` | Removed the leaked `VITE_IMGBB_API_KEY` (and its value) from the tree. |
| `tests/security.test.mjs` | **New** — 24 security/API hardening tests. |

---

## E. Complete API inventory

All endpoints are `POST` and require `Authorization: Bearer <Firebase ID token>`
unless noted. `own`/`staff` = rule/ownership gating. Server re-verifies token via
Identity Toolkit; UID is never taken from the client body.

| Endpoint | Method | Caller | Auth | Role | Ownership | DB operation | Security state |
|---|---|---|---|---|---|---|---|
| `/api/admin/delete` | POST | Admin panel | **required** | **admin** (`admins/{uid}.role`) | scope-resolved server-side | users/admins/accounts/donors/members/queue/donations/requests/reports + Firebase Auth account | ✅ IDOR-guarded; client `uid` compared to server-owned `uid` (409); auth `unconfigured` aborts; idempotent |
| `/api/admin/dedupe` | POST | Admin panel | required | **admin** | n/a | users/donors/identityIndex | ✅ non-admin 403 |
| `/api/admin/config-check` | POST | Admin panel | required | **admin** | n/a | (read-only) | ✅ returns only `serviceAccountConfigured` boolean; never the secret |
| `/api/account/resolve-legacy` | POST | Any logged-in user | required | donor/staff | **own email only** | users/donors/members/queue/identityIndex | ✅ only own email merged; service-account required |
| `/api/donor/apply` | POST | Doner panel | required | donor/staff | **own UID only** | donors/users/verifiedDonations/bloodGroup | ✅ in-flight guard (429); `uid` bound to verified caller; server reads settings |
| `/api/images/upload` | POST | Any logged-in user | required | donor/staff/moderator | own resources | external ImgBB (proxy) | ✅ **NEW**; server-only key; 8 MB cap; sanitized URL |
| `__admin/site-config` | POST | Admin panel (dev only) | same-origin | — | — | writes `src/config/site.ts` | dev-only middleware; same-origin check; not present in production build |

---

## F. Authentication architecture

1. **Login** — email/password or Google (`src/lib/authx.ts`), handled by Firebase Auth; the app never sees users' passwords.
2. **Session** — Firebase Auth session with `browserLocalPersistence` (`src/lib/firebase.ts`). A single shared `onAuthStateChanged` listener (`src/lib/authState.ts`) drives the whole app (no duplicate listeners).
3. **Protection** — every privileged server call sends `Authorization: Bearer <ID token>`. The server verifies it against Identity Toolkit (`accounts:lookup`) to get the **authoritative UID/email**, then checks `admins/{uid}/role` for authorization. Invalid/expired token → **401**; disabled/mis-role → **403**.
4. **Client UID is never trusted** for ownership — the server re-derives the owner from the DB record and compares (409 on mismatch).

## G. Authorization architecture

- **Roles:** `donor` (default), `moderator`, `admin` — resolved solely from `admins/{uid}` (`src/lib/authx.ts resolveUserRole`). A `users/{uid}.role` value is *ignored* (cannot self-escalate).
- **RTDB Rules** enforce the granular per-node permissions (owner-write, staff-write, admin-only). Every write to a protected node re-checks `root.child('admins').child(auth.uid).child('role')`.
- The **server** enforces admin role again at the API boundary (belt-and-braces) before any privileged mutation.

## H. IDOR / BOLA / privilege-escalation protection

- **Confirm-or-abort:** server reads the donor `ownerUid` from the DB (not the client); if the client-supplied `uid` differs → **409 and nothing deleted**.
- **`isAuthUid`** validates UID shape (`/^[A-Za-z0-9_-]{20,64}$/`) before using it as a key.
- **Strict owner validation in Rules** (`donors/$id/.validate`) prevents a donor from changing `ownerUid/verified/status/bloodGroup/donations` etc.; only staff may.
- **Members/requests/reports** `.validate` blocks a non-staff user from setting `status: approved` or impersonating another `ownerUid`.
- **Donation writes** (`users/{uid}/data/verifiedDonations`) are staff-only in Rules; a donor cannot self-verify.
- **`admins` node** only admin can write; a non-admin can't promote themselves (`role.validate`).
- **`accounts/{id}`** write is restricted so a user can only create/delete a record whose `uid` is their own (staff can manage all).

## I. Firebase / Database security

- `settings/.read` was **true** (public) → now staff; `settings/imgbb` admin-only; `settings/app` public.
- `donors`, `requests`, `gallery`, `notices`, `settings/app` are intentionally public-read (public website content).
- Private nodes (`users`, `admins`, `queue`, `accounts`, `donations`, `messages`, `reports`, `audit`) require staff/admin read, with owner-self overrides where appropriate.
- **No browser bypass:** all direct DB access is subject to Rules; the only privileged path is the server, which uses service-account access tokens (never sent to the browser).

## J. Secret protection

- **Removed** the ImgBB key from the browser bundle (`VITE_IMGBB_API_KEY`), from `localStorage`, and from public RTDB.
- The ImgBB key now lives **only server-side** (`IMGBB_API_KEY` wrangler secret, or server/service-account read of `settings/imgbb`). 
- No service-account JSON, private key, `client_email`, or `private_key` exists in the client source or the built bundle (verified by grep + test).
- The Firebase **web** API key remains in public client config — this is correct (public identifier).

## K. Session security

- Firebase Auth handles session persistence and expiry. The app does not invent its own JWT/session secret.
- The secure endpoints verify the ID token on every privileged call (no client-supplied "session" trusted).
- Note: the site intentionally uses `browserLocalPersistence`; session duration/refresh is managed by Firebase. No custom token/session secret to leak.

## L. CORS

- **Not authentication.** Token (Bearer) is still mandatory for every protected request; CORS only lets an allowed origin send it.
- **Allowlist-based**, no `*`. Defaults: `https://chawkbazarbloodclub.com`, `https://www.chawkbazarbloodclub.com`; more via `ALLOWED_ORIGINS` env for the future app. Preflight (OPTIONS) handled, `Access-Control-Allow-Headers: Authorization, Content-Type`.

## M. Abuse protection

- **Not a fixed normal-user quota.** A per-source sliding window (default **600/min**, override via `ABUSE_GUARD_MAX` / `ABUSE_GUARD_WINDOW_MS`) returns **429** only on sustained floods.
- Per-source (CF-Connecting-IP) so multi-user legitimate traffic is effectively unlimited (independent buckets). No quota is ever shown in the UI.
- The apply endpoint additionally has an in-flight concurrency guard (429) to prevent duplicate/race processing.

## N. API response security

- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Responses are the **minimum required data**: delete returns step results + booleans, never a secret; `config-check` returns only `serviceAccountConfigured: boolean`; image upload returns only the URL/metadata. No passwords, hashes, keys, service accounts, or internal paths are exposed.

## O. Realtime verification

- Realtime functionality is **unchanged and not broken**. The app still uses a single `onAuthStateChanged` listener and one live listener per node (`store.ts`). No extra listeners were added; no forced refresh. Deletes/uploads update the DB, and the existing live listeners propagate changes automatically. (Verify below: all existing 190 tests pass, including the realtime/sync suites.)

## P. SEO verification

- Public pages, `index.html`, metadata, SPA rewrites, `robots.txt`/sitemap (hosting config) are **untouched**. Only protected API routes require auth. The static-asset path in the Worker still serves `dist` with SPA fallback. No SEO-affecting change.

## Q. Existing UI verification

- No UI, layout, color, font, button text, icon, card, navigation, or page change. Only *internal* data-flow changes (image upload path + server endpoints). The `uploadImage(file)`/`getImgbbKey()`/`saveImgbbKey()` function signatures and all page call-sites are unchanged — pages call the same functions, which now talk to the secure endpoint.

## R. Existing feature verification

- Donor application, blood-group change, donation verification, admin delete, dedupe, legacy merge, settings, gallery, notices, contact form — all still wired the same way. The approval `ON/OFF` flow keeps calling `requestDirectApply` (server), and the static wiring tests for it still pass.

---

## S. Security test results

**Run:** `node --experimental-strip-types --test tests/security.test.mjs`

```
# tests 28
# pass 28
# fail 0
```

The security suite covers: secret leakage (client bundle/env/wrangler), CORS
allowlist + preflight + no-`*`, abuse/flood guard (generous + per-source), server-side
401/403 auth+authz, **invalid/expired token → 401**, **donor → admin blocked (403)**,
**direct superset — user A/B horizontal access blocked**, **IDOR (client-uid vs
server-owner → 409)**, **BOLA/privilege-escalation (non-admin 403)**, **API response
leakage** (config-check returns only a boolean), and image-upload parameter/secret
handling. It also statically verifies `settings/imgbb` is no longer public-readable
and that all protected endpoints require a Bearer token.

## T. Existing tests + build/typecheck

**Run:** `npm test`
```
# tests 218   (190 existing + 28 new security)
# pass 218
# fail 0
```

**Run:** `npm run build` (`tsc --noEmit && vite build`)
```
✓ 67 modules transformed.
✓ built in ~2.9s
```
Typecheck: **PASS**  ·  Build: **PASS**  ·  Lint: `Not configured` (repo has no lint script).

**Live smoke (dev middleware):**
- `POST /api/donor/apply` (no token) → 401
- `POST /api/images/upload` (no token) → 401
- `POST /api/admin/delete` (no token) → 401
- `GET /` → 200 (static/SPA)

**Secret re-scan of the built bundle:**
```
ImgBB key (8a5458f...): NOT FOUND (good)
BEGIN PRIVATE KEY: none
private_key / client_email JSON field: none
Public Firebase web API key: present (expected — public config)
FIREBASE_SERVICE_ACCOUNT: name-only reference inside a user-facing admin error
    message (setup guidance); NO secret value present
```

---

## U. Remaining limitations / recommendations

1. **Rotate the ImgBB API key.** It was committed to git history (`.env`) in the past; removing it from the current tree does not erase history. Rotate the key and set `IMGBB_API_KEY` as a wrangler secret.
2. **Configure production secrets.** For full delete + legacy-merge + upload to work in production, set: `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT`, `npx wrangler secret put IMGBB_API_KEY` (and optionally `FIREBASE_PROJECT_ID`). Without these, those endpoints return clear 503 messages (fail-safe, nothing partial is deleted).
3. **The app's data model is Firebase SDK + Rules.** The future Android/iOS app can reuse the **same** Firebase project (public config) and the **same** secure `/api/...` endpoints for privileged ops; it must never embed a service-account/private key. No separate backend is required. (The API returns sanitized data, so the app does not need direct DB read access to private nodes.)
4. **Moderator bulk operations / high-volume** are covered by a generous abuse ceiling; tune `ABUSE_GUARD_MAX` upward if you ever farm out heavy admin automation.
5. **`loginIndex`** exposes email-vs-username/phone mapping publicly (needed for pre-auth login). If this is a concern, consider a server-side login lookup endpoint in a future iteration (would not break the current flow).
6. **`secrets` in git history / rotation** is the single most important operational follow-up.

---

*Audit + implementation by Arena agent on branch `arena/01a05814-cbdc`. All 214 tests pass; build/typecheck pass; no UI/feature/realtime/SEO regression.*
