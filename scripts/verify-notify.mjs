/**
 * Notification System (আলাদা Website Notification Data/Storage) checks:
 *  1. notify store — notification RTDB-তে যায় না; আলাদা localStorage
 *     (`cbdc.notifications.v1`) storage-এ থাকে:
 *       - add + dedupe by id
 *       - mark read / all read
 *       - real-time subscriber (local emit + cross-tab storage/broadcast)
 *       - ২৪ ঘণ্টা expiry — pruneExpired() ওই storage থেকেও মুছে দেয়
 *  2. matching predicate — blood group + Availability ON + non-suspended +
 *     approved + ownerUid (pure)
 *  3. main RTDB untouched — NODES-এ কোনো notifications নোড নেই,
 *     database.rules.json-এও নেই; pages-এ কোনো RTDB notification লেখা নেই
 *  4. Doner wiring — RTDB-র live পরিবর্তন থেকে notification generation
 *     (আমার আবেদন status, matching জরুরি আবেদন, ডোনার আবেদন, গ্রুপ, রক্তদান)
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
let failed = false;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
};

/* ── 0. ২৪ ঘণ্টা auto-clear (storage থেকেও মুছে যায়) — fresh module instance ── */
const notifA = await server.ssrLoadModule("/src/lib/notify.ts?v=prune");
localStorage.clear();
localStorage.setItem("cbdc.notifications.v1", JSON.stringify([
  { id: "old", title: "পুরোনো", body: "", type: "info", read: false,
    createdAt: new Date(Date.now() - 25 * 3600e3).toISOString(),
    expiresAt: new Date(Date.now() - 1 * 3600e3).toISOString() },
  { id: "fresh", title: "নতুন", body: "", type: "info", read: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 23 * 3600e3).toISOString() },
]));
const removed = notifA.pruneExpired();
check("pruneExpired removes the 24h-expired one", removed === 1, removed);
const afterPrune = notifA.loadNotifs();
check("expired notification removed from storage", afterPrune.length === 1 && afterPrune[0].id === "fresh", afterPrune.length);
const rawPrune = JSON.parse(localStorage.getItem("cbdc.notifications.v1") || "[]");
check("removed from the notification data itself", rawPrune.length === 1 && rawPrune[0].id === "fresh", rawPrune.length);
localStorage.clear();

/* ── 1. আলাদা storage basics ── */
const notify = await server.ssrLoadModule("/src/lib/notify.ts");
const n1 = notify.addNotif({ id: "em-abc", title: "জরুরি রক্তের প্রয়োজন", body: "O+ আবেদন", type: "emergency", go: "req:for" });
check("addNotif creates notification", !!n1 && n1.id === "em-abc", n1 && n1.id);
const list1 = notify.loadNotifs();
check("notification stored in localStorage (separate)", list1.length === 1 && list1[0].title === "জরুরি রক্তের প্রয়োজন", list1.length);
const raw = localStorage.getItem("cbdc.notifications.v1");
check("storage key cbdc.notifications.v1 used", !!raw && raw.includes("em-abc"), raw ? raw.slice(0, 40) : "none");

/* dedupe */
notify.addNotif({ id: "em-abc", title: "জরুরি রক্তের প্রয়োজন", body: "duplicate", type: "emergency" });
check("duplicate id overwritten (dedupe)", notify.loadNotifs().length === 1, notify.loadNotifs().length);

/* mark read */
notify.markNotifRead("em-abc");
check("markNotifRead persists to storage", notify.loadNotifs()[0].read === true);
notify.markAllNotifsRead();
check("markAllNotifsRead works", notify.loadNotifs().every((x) => x.read));

/* real-time subscriber */
let seen = -1;
const unsub = notify.subscribe((list) => { seen = list.length; });
notify.addNotif({ id: "n2", title: "বিজ্ঞপ্তি ২", body: "", type: "info" });
check("subscriber fires in real-time", seen === 2, seen);
unsub();
notify.addNotif({ id: "n3", title: "বিজ্ঞপ্তি ৩", body: "", type: "info" });
check("unsubscribe stops delivery", seen === 2, seen);

/* ── 2. matching predicate ── */
const ok = { ownerUid: "u1", bloodGroup: "O+", available: true, status: "approved" };
check("match: same group + available", notify.donorMatchesRequest(ok, "O+") === true);
check("match: wrong group skipped", notify.donorMatchesRequest(ok, "A+") === false);
check("match: availability OFF skipped", notify.donorMatchesRequest({ ...ok, available: false }, "O+") === false);
check("match: suspended skipped", notify.donorMatchesRequest({ ...ok, suspended: true }, "O+") === false);
check("match: pending status skipped", notify.donorMatchesRequest({ ...ok, status: "pending" }, "O+") === false);
check("match: no ownerUid skipped", notify.donorMatchesRequest({ ...ok, ownerUid: "" }, "O+") === false);
check("match: group fallback field", notify.donorMatchesRequest({ ownerUid: "u2", group: "B+", available: true }, "B+") === true);
check("match: exceptUid skipped", notify.donorMatchesRequest({ ...ok, ownerUid: "me" }, "O+", { exceptUid: "me" }) === false);

/* ── 4. main RTDB untouched ── */
const firebase = readFileSync(path.join(ROOT, "src/lib/firebase.ts"), "utf8");
check("NODES has no notifications node", !firebase.includes('notifications: "notifications"'), "");
const rules = JSON.parse(readFileSync(path.join(ROOT, "database.rules.json"), "utf8"));
check("rules have no notifications node", !rules.rules.notifications, "");
const notifySrc = readFileSync(path.join(ROOT, "src/lib/notify.ts"), "utf8");
check("notify.ts has no Firebase import", !notifySrc.includes("firebase"), "");

/* ── 5. Doner wiring (generation from RTDB changes, storage separate) ── */
const doner = readFileSync(path.join(ROOT, "src/pages/Doner.tsx"), "utf8");
check("Doner: syncNotifsFromData exists", doner.includes("function syncNotifsFromData"), "");
check("Doner: no RTDB notification writes", !doner.includes('NODES.notifications'), "");
check("Doner: subscribe to notification store", doner.includes('notifSubscribe(()=>{'), "");
check("Doner: pruneExpired periodic cleanup", doner.includes("pruneExpired()"), "");
check("Doner: emergency matching generation", doner.includes('title:"জরুরি রক্তের প্রয়োজন"'), "");
check("Doner: approval generation (আমার আবেদন)", doner.includes('title:"জরুরি রক্তের আবেদন অনুমোদিত"'), "");
check("Doner: rejection generation + reason", doner.includes('title:"জরুরি রক্তের আবেদন বাতিল"') && doner.includes("m.rejectNote"), "");
check("Doner: donor application approved/rejected", doner.includes('"donor-appr"') && doner.includes('"donor-rej"'), "");
check("Doner: group change approved", doner.includes('title:"রক্তের গ্রুপ পরিবর্তন অনুমোদিত"'), "");
check("Doner: donation verified", doner.includes('title:"রক্তদান যাচাই সম্পন্ন"'), "");
check("Doner: self emergency skipped (mineIds)", doner.includes("mineIds.has(r.id)"), "");

/* Admin/Moderator/Home — no RTDB notification writes */
for (const f of ["Admin", "Moderator", "Home"]) {
  const src = readFileSync(path.join(ROOT, `src/pages/${f}.tsx`), "utf8");
  check(`${f}: no RTDB notification writes`, !src.includes("notifyApproval") && !src.includes("notifyRejection") && !src.includes("notifyMatchingDonors"), "");
}
const admin = readFileSync(path.join(ROOT, "src/pages/Admin.tsx"), "utf8");
check("Admin: rejected status still persisted (main data)", admin.includes("markRequestRejected"), "");

console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
