/**
 * Notification System + "আমার আবেদন" status checks:
 *  1. notify lib — sanitizeKey, 24h expiry, emergency matching predicate
 *     (blood group + Availability ON + non-suspended + approved + ownerUid),
 *  2. database.rules.json — notifications node present with owner/staff write,
 *     toUid-validated writes, 24h cleanup friendly (owner delete),
 *  3. Doner panel wiring — RTDB notifications watch, mark-read, 24h prune,
 *     rejected status in "আমার আবেদন", "আমার প্রোফাইল" button wiring,
 *  4. Admin/Moderator wiring — approve/reject notifications + matching donors.
 *
 * Run with: node scripts/verify-notify.mjs
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeDom() {
  const dom = new JSDOM(
    '<!doctype html><html lang="bn"><body><div id="root"></div></body></html>',
    { url: "http://localhost/", pretendToBeVisual: true }
  );
  const w = dom.window;
  w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; } }));
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  w.print = function () {};
  if (!w.BroadcastChannel) w.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
  if (!globalThis.crypto) globalThis.crypto = { getRandomValues: (a) => a };
  if (!global.fetch) global.fetch = () => Promise.reject(new Error("fetch unavailable"));
  global.window = w; global.document = w.document;
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  global.HTMLElement = w.HTMLElement; global.Element = w.Element; global.Node = w.Node;
  global.SVGElement = w.SVGElement; global.getComputedStyle = w.getComputedStyle;
  global.localStorage = w.localStorage; global.sessionStorage = w.sessionStorage;
  global.CustomEvent = w.CustomEvent; global.MouseEvent = w.MouseEvent; global.KeyboardEvent = w.KeyboardEvent;
  global.Event = w.Event; global.URL = w.URL; global.Image = w.Image; global.location = w.location;
  global.history = w.history; global.screen = w.screen;
  global.addEventListener = w.addEventListener.bind(w);
  global.removeEventListener = w.removeEventListener.bind(w);
  global.BroadcastChannel = w.BroadcastChannel;
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  return dom;
}

makeDom();
const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.ts"),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});
const notify = await server.ssrLoadModule("/src/lib/notify.ts");

let failed = false;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
};

/* ── 1. notify lib primitives ── */
check("sanitizeKey strips unsafe chars", notify.sanitizeKey("REQ-abc 12/##") === "REQ-abc12", notify.sanitizeKey("REQ-abc 12/##"));
check("sanitizeKey deterministic (dedupe)", notify.sanitizeKey("x") === notify.sanitizeKey("x"));
const exp = Date.parse(notify.notifExpiry());
check("notifExpiry is ~24h ahead", exp - Date.now() > 23 * 3600e3 && exp - Date.now() < 25 * 3600e3, String(exp - Date.now()));

/* ── 2. matching predicate ── */
const ok = { ownerUid: "u1", bloodGroup: "O+", available: true, status: "approved" };
check("match: same group + available", notify.donorMatchesRequest(ok, "O+") === true);
check("match: wrong group skipped", notify.donorMatchesRequest(ok, "A+") === false);
check("match: availability OFF skipped", notify.donorMatchesRequest({ ...ok, available: false }, "O+") === false);
check("match: suspended skipped", notify.donorMatchesRequest({ ...ok, suspended: true }, "O+") === false);
check("match: pending status skipped", notify.donorMatchesRequest({ ...ok, status: "pending" }, "O+") === false);
check("match: no ownerUid skipped", notify.donorMatchesRequest({ ...ok, ownerUid: "" }, "O+") === false);
check("match: group fallback field (group)", notify.donorMatchesRequest({ ownerUid: "u2", group: "B+", available: true }, "B+") === true);
check("match: exceptUid skipped", notify.donorMatchesRequest({ ...ok, ownerUid: "me" }, "O+", { exceptUid: "me" }) === false);

/* ── 3. rules ── */
const rules = JSON.parse(readFileSync(path.join(ROOT, "database.rules.json"), "utf8"));
const n = rules.rules.notifications;
const nid = n && n["$uid"] && n["$uid"]["$nid"];
check("rules: notifications node exists", !!n && !!n["$uid"], "");
check("rules: owner can read own notifs", String(n["$uid"][".read"] || "").includes("$uid === auth.uid"), "");
check("rules: owner can write own notifs", String(nid[".write"] || "").includes("$uid === auth.uid"), "");
check("rules: matching-donor write allowed (toUid)", String(nid[".write"] || "").includes("newData.child('toUid').val() === $uid"), "");
check("rules: validate enforces toUid + fields", String(nid[".validate"] || "").includes("toUid") && String(nid[".validate"] || "").includes("expiresAt"), "");
check("rules: delete exempt from validate (24h cleanup)", String(nid[".validate"] || "").includes("!newData.exists()"), "");

/* ── 4. Doner wiring (source-level) ── */
const doner = readFileSync(path.join(ROOT, "src/pages/Doner.tsx"), "utf8");
check("Doner: RTDB notifications watch", doner.includes('watchList(NODES.notifications+"/"+uid'), "");
check("Doner: 24h prune (applyNotifRows)", doner.includes("function applyNotifRows"), "");
check("Doner: mark-read writes back to RTDB", doner.includes('updateRow(NODES.notifications+"/"+uid,id,{read:true})'), "");
check("Doner: rejected status shown", doner.includes('rejected:["r","বাতিল"]'), "");
check("Doner: mine synced by ownerUid", doner.includes('String(r.ownerUid||"")!==String(uid)'), "");
check("Doner: matching-donor notify on new request", doner.includes("notifyMatchingDonors({id:m.id"), "");
check("Doner: আমার প্রোফাইল button wired", doner.includes('const h=$("#hprof");') && doner.includes('h.onclick=()=>openProfile("me")'), "");

/* ── 5. Admin / Moderator wiring ── */
for (const f of ["Admin", "Moderator"]) {
  const src = readFileSync(path.join(ROOT, `src/pages/${f}.tsx`), "utf8");
  check(`${f}: approval notification (donor)`, src.includes('notifyApproval(q.ownerUid,"রক্তদাতা আবেদন অনুমোদিত"'), "");
  check(`${f}: rejection notification`, src.includes("notifyRejection(owner"), "");
  check(`${f}: matching-donor notify on request approve`, src.includes("notifyMatchingDonors({id:q.id"), "");
  check(`${f}: rejected status persisted to user's mine`, src.includes("markRequestRejected"), "");
}

console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
