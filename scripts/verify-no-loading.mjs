/**
 * CBDC — "কোনো লোডিং নেই" verification (jsdom + in-memory Firebase)
 *
 *  ১. Shared store-এর browser cache — public + private/admin (queue/accounts)
 *     উভয়ই সর্বশেষ RTDB snapshot থেকে সংরক্ষিত হয়।
 *  ২. "Refresh" simulation — নতুন পেজ/রিলোডে RTDB-র কোনো প্রথম snapshot আসার
 *     **আগেই** ডেটা (সব node) restore হয়ে থাকে; তারপর live snapshot-ই
 *     প্রতিস্থাপন করে এবং কোনো reload-এ রিয়েলটাইম আপডেট অব্যাহত থাকে।
 *  ৩. Admin panel — সংরক্ষিত snapshot + cached role দিয়ে প্রথম paint-এই
 *     ড্যাশবোর্ড/ডোনার ব্যবস্থাপনা/এক্সেস আঁকা হয় (skeleton/"লোড হচ্ছে…" নেই)।
 *  ৪. Doner panel — "আবেদন লোড হচ্ছে…" কখনো দৃশ্যমান হয় না; নিজের আবেদন
 *     প্রথম ফ্রেমেই দেখায় এবং RTDB বদলালে reload ছাড়াই আপডেট হয়।
 *  ৫. Main Website (Home) — refresh-এ RTDB-র আগেই ডোনার তালিকা/পরিসংখ্যান
 *     আঁকা হয়; RTDB-তে বদল (delete/update) হলে reload ছাড়াই UI বদলায়।
 *
 * Run with:  npm run verify-noload
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import ReactDOM from "react-dom/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(ROOT, "scripts", "fixtures");

let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ADMIN_UID = "adminuid00000000000000001";
const DONOR_A = "donoruid000000000000000a";
const DONOR_B = "donoruid000000000000000b";

const PUBLIC_CACHE_K = "cbdc.shared.rtdb.public-cache.v2";
const PRIVATE_CACHE_K = (uid) => `cbdc.shared.rtdb.private-cache.v1.${uid}`;

/* ───────────────────────── jsdom environment ───────────────────────── */
function makeDom() {
  const dom = new JSDOM(
    '<!doctype html><html lang="bn"><head></head><body data-dense="0" data-anim="1"><div id="root"></div></body></html>',
    { url: "http://localhost/admin", pretendToBeVisual: true },
  );
  const w = dom.window;
  w.matchMedia =
    w.matchMedia ||
    ((q) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      },
    }));
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  w.print = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () {
    return null;
  };
  if (!w.BroadcastChannel)
    w.BroadcastChannel = class {
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
      close() {}
    };
  global.window = w;
  global.document = w.document;
  if (globalThis.CBDCShared) {
    try {
      w.CBDCShared = globalThis.CBDCShared;
    } catch {
      /* ignore */
    }
  }
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  for (const key of [
    "HTMLElement", "Element", "Node", "SVGElement", "getComputedStyle", "localStorage", "sessionStorage",
    "CustomEvent", "MouseEvent", "KeyboardEvent", "Event", "URL", "Image", "location", "history", "screen",
    "MutationObserver", "FileReader", "FormData", "Blob", "DOMParser", "XMLSerializer", "atob", "btoa",
    "BroadcastChannel", "matchMedia", "innerWidth", "innerHeight", "outerWidth", "outerHeight", "scrollX",
    "scrollY", "pageXOffset", "pageYOffset", "devicePixelRatio", "self", "parent", "top", "frames", "origin",
    "name", "length", "closed",
  ]) {
    try {
      global[key] = typeof w[key] === "function" && /^(addEventListener|removeEventListener)$/.test(key)
        ? w[key].bind(w)
        : w[key];
    } catch {
      /* read-only global */
    }
  }
  global.addEventListener = w.addEventListener.bind(w);
  global.removeEventListener = w.removeEventListener.bind(w);
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  if (!globalThis.crypto) globalThis.crypto = { getRandomValues: (a) => a };
  if (!global.fetch) global.fetch = () => Promise.reject(new Error("fetch unavailable"));
  return w;
}

/* কপি localStorage — "refresh" simulation (একই ব্রাউজার, নতুন পেজ) */
function copyStorage(from, to) {
  for (let i = 0; i < from.length; i++) {
    const k = from.key(i);
    if (k) to.setItem(k, from.getItem(k));
  }
}

/* ───────────────────────── fake Firebase wiring ───────────────────────── */
const vite = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.ts"),
  resolve: {
    alias: {
      "firebase/database": path.join(FIXTURES, "fake-rtdb.mjs"),
      "firebase/auth": path.join(FIXTURES, "fake-auth.mjs"),
    },
  },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
});

const rtdb = await vite.ssrLoadModule("/scripts/fixtures/fake-rtdb.mjs");
const fakeAuth = await vite.ssrLoadModule("/scripts/fixtures/fake-auth.mjs");

/* ───────────────────────── seeded database ───────────────────────── */
function seedDb(live = false) {
  rtdb.__reset();
  const apply = live ? rtdb.__seedLive : rtdb.__seed;
  apply({
    [`admins/${ADMIN_UID}`]: {
      uid: ADMIN_UID, email: "admin@cbdc.test", name: "শাহাদাত আহমেদ",
      username: "shahadat", role: "admin", status: "active", permissions: [],
    },
    [`users/${ADMIN_UID}`]: { uid: ADMIN_UID, name: "শাহাদাত আহমেদ", email: "admin@cbdc.test", role: "admin" },
    [`users/${DONOR_A}`]: {
      uid: DONOR_A, name: "রফিক উদ্দিন", username: "rafik", email: "rafik@cbdc.test",
      phone: "01711111111", donorId: "CBDC-2026-0001", donorStatus: "approved", role: "donor",
      data: { mine: [] },
    },
    [`users/${DONOR_B}`]: {
      uid: DONOR_B, name: "জসিম উদ্দিন", username: "josim", email: "josim@cbdc.test",
      phone: "01722222222", donorId: "CBDC-2026-0002", donorStatus: "approved", role: "donor",
      data: { mine: [] },
    },
    [`admins/${DONOR_A}`]: {
      uid: DONOR_A, name: "রফিক উদ্দিন", username: "rafik", email: "rafik@cbdc.test",
      role: "moderator", status: "active", permissions: ["request.view"],
    },
    [`accounts/${ADMIN_UID}`]: { uid: ADMIN_UID, name: "শাহাদাত আহমেদ", email: "admin@cbdc.test", role: "admin" },
    [`accounts/${DONOR_A}`]: { uid: DONOR_A, name: "রফিক উদ্দিন", email: "rafik@cbdc.test", role: "moderator" },
    [`accounts/${DONOR_B}`]: { uid: DONOR_B, name: "জসিম উদ্দিন", email: "josim@cbdc.test", role: "donor" },
    "donors/CBDC-2026-0001": {
      id: "CBDC-2026-0001", donorId: "CBDC-2026-0001", name: "রফিক উদ্দিন", bloodGroup: "O+",
      area: "চকবাজার", phone: "01711111111", ownerUid: DONOR_A, status: "approved",
      available: true, verified: true, suspended: false, donations: 2, totalDonations: 2, joined: "2026-01-01",
    },
    "donors/CBDC-2026-0002": {
      id: "CBDC-2026-0002", donorId: "CBDC-2026-0002", name: "জসিম উদ্দিন", bloodGroup: "B+",
      area: "খুলশী", phone: "01722222222", ownerUid: DONOR_B, status: "approved",
      available: true, verified: true, suspended: false, donations: 1, totalDonations: 1, joined: "2026-02-01",
      lastDonationDate: new Date().toISOString().slice(0, 10),
    },
    "queue/PD-donorA": { id: "PD-donorA", kind: "donation", name: "রফিক উদ্দিন", ownerUid: DONOR_A, at: "2026-05-01T10:00:00.000Z" },
    "queue/PD-donorB": { id: "PD-donorB", kind: "donation", name: "জসিম উদ্দিন", ownerUid: DONOR_B, at: "2026-05-02T10:00:00.000Z" },
    "requests/REQ-A": { id: "REQ-A", patientName: "করিম", bloodGroup: "O+", status: "approved", workflowStatus: "searching", ownerUid: DONOR_A, createdAt: "2026-05-05T10:00:00.000Z" },
    "gallery/G-1": { id: "G-1", url: "https://imgbb.test/g1.jpg", order: 1 },
    "notices/N-1": { id: "N-1", title: "নোটিশ", body: "নতুন নোটিশ", active: true },
    "messages/M-1": { id: "M-1", name: "দর্শক", phone: "01700000000", text: "হ্যালো", read: false, at: "2026-05-05T10:00:00.000Z" },
    "reports/REP-A": { id: "REP-A", ownerUid: DONOR_A, name: "রফিক উদ্দিন", text: "সমস্যা", status: "open", createdAt: "2026-05-06T10:00:00.000Z" },
    "audit/A-1": { at: "2026-05-01T10:00:00.000Z", who: "শাহাদাত আহমেদ", role: "admin", act: "পুরোনো রেকর্ড", target: "x", mod: "donor" },
  });
}

/* সেশন-উপযোগী localStorage: public+private cache, role, panel snapshots */
function seedStorage(w, { snapshots = true, role = "admin" } = {}) {
  const now = new Date().toISOString();
  w.localStorage.setItem(PUBLIC_CACHE_K, JSON.stringify({
    version: 1, updatedAt: now, savedAt: now,
    donors: [
      { id: "CBDC-2026-0001", donorId: "CBDC-2026-0001", name: "রফিক উদ্দিন", bloodGroup: "O+", area: "চকবাজার", status: "approved", ownerUid: DONOR_A },
      { id: "CBDC-2026-0002", donorId: "CBDC-2026-0002", name: "জসিম উদ্দিন", bloodGroup: "B+", area: "খুলশী", status: "approved", ownerUid: DONOR_B, lastDonationDate: new Date().toISOString().slice(0, 10) },
    ],
    requests: [
      { id: "REQ-A", patientName: "করিম", bloodGroup: "O+", status: "approved", workflowStatus: "searching", ownerUid: DONOR_A },
    ],
    gallery: [{ id: "G-1", url: "https://imgbb.test/g1.jpg", order: 1 }],
    notices: [{ id: "N-1", title: "নোটিশ", body: "নতুন নোটিশ", active: true }],
  }));
  w.localStorage.setItem(PRIVATE_CACHE_K(ADMIN_UID), JSON.stringify({
    version: 1, uid: ADMIN_UID, updatedAt: now, savedAt: now,
    queue: [
      { id: "PD-donorA", kind: "donation", name: "রফিক উদ্দিন", ownerUid: DONOR_A },
      { id: "PD-donorB", kind: "donation", name: "জসিম উদ্দিন", ownerUid: DONOR_B },
    ],
    accounts: [
      { uid: ADMIN_UID, name: "শাহাদাত আহমেদ", email: "admin@cbdc.test", role: "admin" },
      { uid: DONOR_A, name: "রফিক উদ্দিন", email: "rafik@cbdc.test", role: "moderator" },
      { uid: DONOR_B, name: "জসিম উদ্দিন", email: "josim@cbdc.test", role: "donor" },
    ],
  }));
  w.localStorage.setItem("cbdc.role." + ADMIN_UID, JSON.stringify({ role, savedAt: now }));
  if (snapshots) {
    const snap = (name, rows) =>
      w.localStorage.setItem(`cbdc.rtdb.snapshot.v1.${ADMIN_UID}.${name}`, JSON.stringify({
        version: 1, uid: ADMIN_UID, name, savedAt: now, rows,
      }));
    snap("users", [
      { uid: ADMIN_UID, name: "শাহাদাত আহমেদ", email: "admin@cbdc.test", role: "admin" },
      { uid: DONOR_A, name: "রফিক উদ্দিন", username: "rafik", email: "rafik@cbdc.test", donorId: "CBDC-2026-0001", donorStatus: "approved", role: "moderator" },
      { uid: DONOR_B, name: "জসিম উদ্দিন", username: "josim", email: "josim@cbdc.test", donorId: "CBDC-2026-0002", donorStatus: "approved", role: "donor" },
    ]);
    snap("admins", [
      { uid: ADMIN_UID, name: "শাহাদাত আহমেদ", email: "admin@cbdc.test", role: "admin", status: "active" },
      { uid: DONOR_A, name: "রফিক উদ্দিন", email: "rafik@cbdc.test", role: "moderator", status: "active" },
    ]);
    snap("audit", [{ at: "2026-05-01T10:00:00.000Z", who: "শাহাদাত আহমেদ", role: "admin", act: "পুরোনো রেকর্ড", target: "x", mod: "donor" }]);
    snap("messages", [{ id: "M-1", name: "দর্শক", phone: "01700000000", text: "হ্যালো", read: false, at: "2026-05-05T10:00:00.000Z" }]);
    snap("reports", [{ id: "REP-A", ownerUid: DONOR_A, name: "রফিক উদ্দিন", text: "সমস্যা", status: "open", createdAt: "2026-05-06T10:00:00.000Z" }]);
  }
}

/* ═══════════════ ১. shared store — public + private cache সংরক্ষণ ═══════════════ */
console.log("\n── ১. Store: public + private (admin) snapshot সংরক্ষণ ──");
let domA;
{
  seedDb(true);
  rtdb.__setDelay(0);
  domA = makeDom();
  const storeA = await vite.ssrLoadModule("/src/lib/store.ts?case=store-a");
  const shared = storeA.default;
  for (let i = 0; i < 200; i += 1) {
    const s = shared.load();
    if (s.donors.length === 2 && s.queue.length === 2 && s.accounts.length === 3) break;
    await wait(20);
  }
  const s = shared.load();
  ok(s.donors.length === 2, "RTDB থেকে donors লোড হয়েছে (live listener)", `${s.donors.length}টি`);
  ok(s.queue.length === 2 && s.accounts.length === 3, "RTDB থেকে queue/accounts লোড হয়েছে", `queue ${s.queue.length} · accounts ${s.accounts.length}`);
  const pub = JSON.parse(domA.localStorage.getItem(PUBLIC_CACHE_K) || "{}");
  ok(Array.isArray(pub.donors) && pub.donors.length === 2, "public cache-এ donors সংরক্ষিত", `${(pub.donors || []).length}টি`);
  const priv = JSON.parse(domA.localStorage.getItem(PRIVATE_CACHE_K(ADMIN_UID)) || "{}");
  ok(Array.isArray(priv.queue) && priv.queue.length === 2 && Array.isArray(priv.accounts) && priv.accounts.length === 3,
    "private cache (queue/accounts) UID-কী-তে সংরক্ষিত", `queue ${(priv.queue || []).length} · accounts ${(priv.accounts || []).length}`);
  ok(shared.isNodeLoaded("donors") && shared.isNodeLoaded("queue") && shared.isNodeLoaded("accounts"),
    "সব node ready (RTDB snapshot এসেছে)");
}

/* ═══════════════ ২. refresh simulation — RTDB-র আগেই ডেটা restore ═══════════════ */
console.log("\n── ২. Refresh/new page — কোনো প্রথম snapshot-এর আগেই সব ডেটা ──");
{
  /* নতুন পেজ (একই localStorage), কিন্তু RTDB-র প্রথম snapshot ইচ্ছে করে আটকে রাখা */
  seedDb(false);
  rtdb.__setDelay(-1);
  const wB = makeDom();
  copyStorage(domA.localStorage, wB.localStorage);
  const storeB = await vite.ssrLoadModule("/src/lib/store.ts?case=store-b");
  const sharedB = storeB.default;

  const s = sharedB.load();
  ok(s.donors.length === 2, "রিলোডের প্রথম মুহূর্তেই donors আছে (0 RTDB event)", `${s.donors.length}টি`);
  ok(s.queue.length === 2 && s.accounts.length === 3, "রিলোডের প্রথম মুহূর্তেই private/admin ডেটা আছে",
    `queue ${s.queue.length} · accounts ${s.accounts.length}`);
  ok(sharedB.isNodeLoaded("donors") && sharedB.isNodeLoaded("queue") && sharedB.isNodeLoaded("accounts"),
    "UI-র loading/skeleton গেট পাস করে — সব node 'loaded' (cache থেকে)");
  ok(sharedB.isRtdbReady("donors") === false,
    "কিন্তু RTDB-র প্রথম snapshot এখনো আসেনি — cache-ই প্রথম paint", "(isRtdbReady=false)");

  rtdb.__flush();
  for (let i = 0; i < 100; i += 1) {
    if (sharedB.isRtdbReady("donors")) break;
    await wait(20);
  }
  ok(sharedB.isRtdbReady("donors"), "RTDB snapshot এলে live data-ই source");
  ok(sharedB.load().donors.length === 2, "live snapshot-এর পর ডেটা সম্পূর্ণ ও অপরিবর্তিত");

  /* realtime propagation — অন্য জায়গা থেকে delete হলে কোনো reload ছাড়াই */
  rtdb.__serverUpdate({ "donors/CBDC-2026-0002": null });
  for (let i = 0; i < 100; i += 1) {
    if (sharedB.load().donors.length === 1) break;
    await wait(20);
  }
  ok(sharedB.load().donors.length === 1, "RTDB-তে delete → store-এ সাথে সাথে (কোনো reload/loading নেই)", `${sharedB.load().donors.length}টি`);
}

/* ═══════════════ ৩. Admin panel — first paint-ই ডেটা, কখনো skeleton নয় ═══════════════ */
console.log("\n── ৩. Admin panel — refresh-এ instant painted (skeleton/লোড হচ্ছে নেই) ──");
{
  seedDb(false);
  rtdb.__setDelay(-1); /* RTDB first snapshot আটকে রাখা — রিফ্রেশের বাস্তব অবস্থা */
  const w = makeDom();
  seedStorage(w); /* last-known snapshots + cached role */
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));

  for (let i = 0; i < 300 && !w.document.querySelector("#s-home .astat"); i += 1) await wait(20);
  const home = w.document.getElementById("s-home");
  const html = home ? home.innerHTML : "";
  ok(!!home && home.querySelectorAll(".sk").length === 0, "প্রথম paint-এ কোনো skeleton নেই", `${home ? home.querySelectorAll(".sk").length : "-"}টি`);
  ok(!html.includes("তথ্য লোড হচ্ছে") && !html.includes("Loading data"), "প্রথম paint-এ 'লোড হচ্ছে' দৃশ্যমান নয়");
  const statNums = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(JSON.stringify(statNums) === JSON.stringify(["২", "১", "২", "১"]),
    "সংরক্ষিত snapshot থেকেই আসল পরিসংখ্যান (মোট ২ · প্রস্তুত ১ · অপেক্ষমাণ ২ · চলমান ১)", JSON.stringify(statNums));

  w.go("set", "team");
  await wait(80);
  const teamHtml = w.document.getElementById("s-sub")?.innerHTML || "";
  const teamRows = w.document.querySelectorAll("[data-tsel]");
  ok(teamHtml.includes("রফিক উদ্দিন") && teamHtml.includes("জসিম উদ্দিন"), "ডোনার ব্যবস্থাপনায় অ্যাকাউন্ট-ওয়ালা ডোনারই আছে (RTDB ছাড়াই)");
  ok(teamRows.length === 2, "ডোনার ব্যবস্থাপনা তালিকা প্রস্তুত", `${teamRows.length}টি`);
  ok(!teamHtml.includes("লোড হচ্ছে") && !teamHtml.includes("<div class=\"sk\""), "ডোনার ব্যবস্থাপনায় কোনো লোডিং নেই");

  w.go("set", "donorid");
  await wait(80);
  const didHtml = w.document.getElementById("s-sub")?.innerHTML || "";
  ok(didHtml.includes("CBDC-2026-0001") && didHtml.includes("CBDC-2026-0002"), "ডোনার আইডি ব্যবস্থাপনাও প্রথম paint-এ ভরা (RTDB ছাড়াই)");

  w.go("set", "access");
  /* users/admins listener-দের ফলে merged তালিকা আসে — কোনো লোডিং ছাড়াই */
  let accHtml = "";
  for (let i = 0; i < 60; i += 1) {
    accHtml = w.document.getElementById("s-sub")?.innerHTML || "";
    if (accHtml.includes("শাহাদাত আহমেদ") && accHtml.includes("রফিক উদ্দিন")) break;
    await wait(25);
  }
  ok(accHtml.includes("শাহাদাত আহমেদ") && accHtml.includes("রফিক উদ্দিন"),
    "অ্যাক্সেস ও ভূমিকা তালিকা ভরা — কখনো skeleton/লোডিং নয়",
    w.document.querySelectorAll("#s-sub .prow").length + "টি row");
  ok(!accHtml.includes("লোড হচ্ছে"), "অ্যাক্সেস স্ক্রিনে কোনো লোডিং টেক্সট নেই");


  /* RTDB এসে গেলেও সব অক্ষত — no reload */
  rtdb.__flush();
  for (let i = 0; i < 100; i += 1) await wait(20);
  w.go("home");
  await wait(120);
  const statAfter = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(statAfter[0] === "২", "RTDB snapshot-এর পরেও পরিসংখ্যান ঠিক — live data-ই source", JSON.stringify(statAfter));
  const readsBefore = rtdb.__readCount();
  w.go("set", "donorid");
  await wait(60);
  w.go("home");
  await wait(60);
  ok(rtdb.__readCount() === readsBefore, "navigation-এ ডেটা memory/state থেকে — নতুন করে load হয় না");
  root.unmount();
}

/* ═══════════ ৫. Main Website (Home) — refresh-এ instant data, realtime UI ═══════════ */
console.log("\n── ৫. Main Website — প্রথম frame-ই ডেটা, RTDB বদলালে reload ছাড়াই ──");
{
  seedDb(false);
  rtdb.__setDelay(-1); /* RTDB first snapshot আটকে রাখা — refresh-এর বাস্তব অবস্থা */
  const w = makeDom();
  seedStorage(w, { snapshots: false });
  /* Home-এ দুজন ডোনারই eligible দেখাতে হলে donor B-র শেষ রক্তদান ৯০+ দিন আগের
     হতে হবে (Admin section-এর জন্য আজকের তারিখ আলাদা রাখা হয়েছে)। */
  const pub = JSON.parse(w.localStorage.getItem(PUBLIC_CACHE_K));
  pub.donors = pub.donors.map((d) =>
    d.id === "CBDC-2026-0002"
      ? { ...d, lastDonationDate: new Date(Date.now() - 95 * 86400000).toISOString().slice(0, 10) }
      : d,
  );
  pub.savedAt = new Date().toISOString();
  w.localStorage.setItem(PUBLIC_CACHE_K, JSON.stringify(pub));

  /* refresh-এ এই পেজের নিজস্ব store instance — cache restore + RTDB listener */
  const storeHome = (await vite.ssrLoadModule("/src/lib/store.ts?case=store-home")).default;
  const s = storeHome.load();
  ok(s.donors.length === 2, "Home-এর Store-ও প্রথম মুহূর্তেই ডোনার আছে (cache থেকে)", `${s.donors.length}টি`);

  const { default: Home } = await vite.ssrLoadModule("/src/pages/Home.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Home));
  for (let i = 0; i < 60; i += 1) {
    if (w.document.querySelectorAll("#donorResults .donor-card").length >= 1) break;
    await wait(20);
  }
  const cards = [...w.document.querySelectorAll("#donorResults .donor-card")].map((c) => c.textContent);
  ok(cards.some((t) => t.includes("রফিক উদ্দিন")) && cards.some((t) => t.includes("জসিম উদ্দিন")),
    "Refresh-এর প্রথম frame-ই ডোনার তালিকা ভরা (RTDB snapshot-এর আগেই)",
    `${cards.length}টি কার্ড`);
  ok(w.document.getElementById("resultCount")?.textContent.includes("২ জন"),
    "ফলাফল গণনাও আগে থেকেই লেখা — 'লোড হচ্ছে…' নয়", w.document.getElementById("resultCount")?.textContent.trim() || "");
  const bodyText = (() => {
    const copy = w.document.body.cloneNode(true);
    copy.querySelectorAll("style, script").forEach((n) => n.remove());
    return copy.textContent || "";
  })();
  ok(!bodyText.includes("লোড হচ্ছে") && !bodyText.includes("Loading"),
    "পেইজে কোথাও 'লোড হচ্ছে' দৃশ্যমান নয়");
  ok(w.document.getElementById("appModal")?.classList.contains("hidden") === true,
    "appLoading মডালও hidden-ই (boot-এ দেখানো হয় না)");

  /* RTDB snapshot এলে data-ই source — তালিকা অক্ষত */
  rtdb.__flush();
  for (let i = 0; i < 100; i += 1) {
    if (storeHome.isRtdbReady("donors")) break;
    await wait(20);
  }
  ok(storeHome.isRtdbReady("donors"), "RTDB snapshot এলে live data-ই source");

  /* অন্য জায়গা থেকে delete → সব UI (তালিকা + পরিসংখ্যান) reload ছাড়াই */
  rtdb.__setDelay(0);
  rtdb.__serverUpdate({ "donors/CBDC-2026-0002": null });
  for (let i = 0; i < 100; i += 1) {
    if (w.document.querySelectorAll("#donorResults .donor-card").length === 1) break;
    await wait(20);
  }
  ok(w.document.querySelectorAll("#donorResults .donor-card").length === 1,
    "RTDB-তে delete → Home-এ সাথে সাথে ১টি কার্ড (reload/loading নেই)",
    `${w.document.querySelectorAll("#donorResults .donor-card").length}টি`);
  ok(w.document.getElementById("statDonors")?.textContent.trim() === "১",
    "পরিসংখ্যানও সাথে সাথে বদলায়", w.document.getElementById("statDonors")?.textContent.trim() || "");
  ok(!(w.document.getElementById("donorResults")?.innerHTML || "").includes("লোড হচ্ছে"),
    "আপডেটের পরেও কোনো লোডিং নেই");
  root.unmount();
}

/* ═══════════════ ৪. Doner panel — "আবেদন লোড হচ্ছে…" কখনো দেখা যায় না ═══════════════ */
console.log("\n── ৪. Doner panel — cache-first 'আমার আবেদন' ──");
{
  seedDb(false);
  /* fake auth সবসময় ADMIN_UID-তে সাইন-ইন — Doner পরীক্ষায় তাকে সাধারণ ডোনার বানাই */
  const UID = ADMIN_UID;
  await rtdb.remove(rtdb.ref({}, `admins/${UID}`));
  rtdb.__setDelay(-1);
  const MINE = {
    id: "REQ-MINE", patient: "মো. আলী", group: "O+", bags: 2, hospital: "চমেক হাসপাতাল",
    neededBy: "2026-08-30", createdAt: "2026-08-25T10:00:00.000Z", status: "approved",
    workflowStatus: "searching", responders: [],
  };
  const w = makeDom();
  /* একই uid-র local snapshot — auth callback-এর আগেই "আমার আবেদন" আঁকা */
  w.localStorage.setItem("cbdc.data", JSON.stringify({
    donations: [], incoming: [], mine: [MINE], notifs: [], activity: [], sessions: [],
    donors: [], notices: [], _uid: UID,
  }));
  w.localStorage.setItem("cbdc.app", JSON.stringify({
    account: { uid: UID, name: "শাহাদাত আহমেদ", username: "shahadat", email: "admin@cbdc.test", applicationCount: 1 },
    donor: { is: true, status: "approved", donorId: "CBDC-2026-0001", bloodGroup: "O+", whatsapp: "", lastDonation: "", health: "", available: true },
    privacy: {}, notif: {}, prefs: { lang: "bn", theme: "light" }, security: {}, saved: [],
  }));
  /* RTDB-র truth-ও একই — তাই প্রথম paint-এ শেষ-দেখা আবেদন live-এ নিশ্চিত হয় */
  rtdb.__seed({ [`users/${UID}`]: { uid: UID, name: "শাহাদাত আহমেদ", username: "shahadat", email: "admin@cbdc.test", role: "donor", data: { mine: [MINE] } } });
  const { default: Doner } = await vite.ssrLoadModule("/src/pages/Doner.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Doner));
  /* React effect (initPage) চালু হওয়া পর্যন্ত অল্প অপেক্ষা — এর পরই প্রথম paint */
  for (let i = 0; i < 20 && typeof w.go !== "function"; i += 1) await wait(20);

  /* Auth + RTDB-র আগে থেকেই "আমার আবেদন" — শুরু থেকে শেষ পর্যন্ত লোডিং nope */
  let loadingSeen = false;
  for (let i = 0; i < 12; i += 1) {
    w.go("req");
    await wait(25);
    const tab = w.document.querySelector('#rtabs button[data-t="mine"]');
    if (tab) tab.click();
    await wait(10);
    const h = w.document.getElementById("s-req")?.innerHTML || "";
    if (h.includes("আবেদন লোড হচ্ছে")) loadingSeen = true;
  }
  const req = w.document.getElementById("s-req");
  const reqHtml = req ? req.innerHTML : "";
  w.go("req");
  const tab = w.document.querySelector('#rtabs button[data-t="mine"]');
  if (tab) tab.click();
  await wait(20);
  ok(!loadingSeen, "কোনো মুহূর্তেই 'আবেদন লোড হচ্ছে…' দৃশ্যমান নয় (auth+RTDB-এর আগেও)");
  ok(reqHtml.includes("মো. আলী") && reqHtml.includes("REQ-MINE"), "নিজের আবেদন প্রথম ফ্রেমেই দৃশ্যমান (local snapshot)");

  /* RTDB আসলে users/{uid}/data.mine-ই source — ওখানে বদলালে reload ছাড়া আপডেট */
  rtdb.__setDelay(0);
  rtdb.__seedLive({ [`users/${UID}/data/mine`]: [{ ...MINE, id: "REQ-MINE", status: "resolved" }] });
  for (let i = 0; i < 100; i += 1) {
    const h = w.document.getElementById("s-req")?.innerHTML || "";
    if (h.includes("সম্পন্ন")) break;
    await wait(25);
  }
  const after = w.document.getElementById("s-req")?.innerHTML || "";
  ok(after.includes("সম্পন্ন"), "RTDB-তে status বদলালে সাথে সাথে UI আপডেট (reload/loading নেই)");
  ok(!after.includes("আবেদন লোড হচ্ছে"), "আপডেটের পরেও কোনো লোডিং নেই");
  root.unmount();
}

/* ═══════════ ৬. entry point — কোনো lazy/Suspense "লোড হচ্ছে…" fallback নেই ═══════════ */
console.log("\n── ৬. Entry point — নতুন পেজ খুললে 'লোড হচ্ছে…' fallback নেই ──");
{
  const mainSrc = readFileSync(path.join(ROOT, "src/main.tsx"), "utf8");
  ok(!/lazy\s*\(/.test(mainSrc) && !/Suspense/.test(mainSrc),
    "সব পেজ (Home/Doner/Admin/Moderator) আগে থেকেই import করা — lazy নয়");
  ok(/import Admin from "\.\/pages\/Admin";/.test(mainSrc) &&
    /import Doner from "\.\/pages\/Doner";/.test(mainSrc) &&
    /import Moderator from "\.\/pages\/Moderator";/.test(mainSrc),
    "তিনটি প্যানেলই static import-এ আছে");
}

console.log(failures ? `\n${failures}টি চেক ব্যর্থ` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
