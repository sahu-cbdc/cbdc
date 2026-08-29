/**
 * CBDC — Admin Panel verification (jsdom + in-memory Firebase)
 *
 *  ১. Dashboard data loading — লোডিং অবস্থায় Skeleton (কোনো ভুল "০" নয়),
 *     ডেটা আসার পর আসল সংখ্যা, এবং realtime-এ নতুন করে full-load না হওয়া।
 *  ২. "অনুমোদন ও সেটিংস" — পুরোনো "নিয়ম/সংযোগ/ImgBB/ডেটা/সংরক্ষণ করুন"
 *     অংশ নেই; ৪টি approval toggle RTDB-তে সেভ হয়।
 *  ৩. ডোনার ব্যবস্থাপনা + ডোনার আইডি ব্যবস্থাপনা — দুটি স্বাধীন entity
 *     (Account ↔ Donor ID), secure server-side delete (Worker endpoint)।
 *  ৪. Role/Access change — existing account information অক্ষত থাকে, শুধু
 *     role/permission আপডেট হয় এবং reload ছাড়াই realtime-এ UI আপডেট হয়।
 *
 * Run with:  npm run verify-admin
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
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
  /* shared store (window.CBDCShared) module import-এই পুরোনো window-এ সেট হয় —
     নতুন jsdom-এও একই store ব্যবহার করতে দিতে হবে। */
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
const deleteApi = await vite.ssrLoadModule("/server/deleteApi.ts");

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

    "donors/CBDC-2026-0001": {
      id: "CBDC-2026-0001", donorId: "CBDC-2026-0001", name: "রফিক উদ্দিন", bloodGroup: "O+",
      area: "চকবাজার", phone: "01711111111", ownerUid: DONOR_A, status: "approved",
      available: true, verified: true, suspended: false, donations: 2, totalDonations: 2, joined: "2026-01-01",
    },
    "donors/CBDC-2026-0002": {
      id: "CBDC-2026-0002", donorId: "CBDC-2026-0002", name: "জসিম উদ্দিন", bloodGroup: "B+",
      area: "খুলশী", phone: "01722222222", ownerUid: DONOR_B, status: "approved",
      available: true, verified: true, suspended: false, donations: 1, totalDonations: 1, joined: "2026-02-01",
      lastDonationDate: new Date().toISOString().slice(0, 10), /* সবে দান করেছে → "প্রস্তুত" নয় */
    },
    [`users/${DONOR_A}`]: {
      uid: DONOR_A, name: "রফিক উদ্দিন", username: "rafik", email: "rafik@cbdc.test",
      phone: "01711111111", photoURL: "https://imgbb.test/rafik.png", donorId: "CBDC-2026-0001",
      donorStatus: "approved", role: "donor", data: { donations: [{ date: "2026-03-01", place: "চকবাজার", bags: 1, ok: true }] },
    },
    [`users/${DONOR_B}`]: {
      uid: DONOR_B, name: "জসিম উদ্দিন", username: "josim", email: "josim@cbdc.test",
      phone: "01722222222", photoURL: "https://imgbb.test/josim.png", donorId: "CBDC-2026-0002",
      donorStatus: "approved", role: "donor",
    },
    [`admins/${DONOR_A}`]: {
      uid: DONOR_A, name: "রফিক উদ্দিন", username: "rafik", email: "rafik@cbdc.test",
      role: "moderator", status: "active", permissions: ["request.view"],
    },
    [`accounts/${DONOR_A}`]: { uid: DONOR_A, name: "রফিক উদ্দিন", email: "rafik@cbdc.test", role: "moderator" },
    "members/MEMBER-A": { id: "MEMBER-A", uid: DONOR_A, ownerUid: DONOR_A, name: "রফিক উদ্দিন", status: "approved" },
    "queue/PD-donorA": { id: "PD-donorA", kind: "donation", name: "রফিক উদ্দিন", ownerUid: DONOR_A, date: "2026-05-01", at: "2026-05-01T10:00:00.000Z" },
    "queue/PD-donorB": { id: "PD-donorB", kind: "donation", name: "জসিম উদ্দিন", ownerUid: DONOR_B, date: "2026-05-02", at: "2026-05-02T10:00:00.000Z" },
    "requests/REQ-A": { id: "REQ-A", patientName: "করিম", bloodGroup: "O+", status: "approved", workflowStatus: "searching", ownerUid: DONOR_A, createdAt: "2026-05-05T10:00:00.000Z" },
    "reports/REP-A": { id: "REP-A", ownerUid: DONOR_A, name: "রফিক উদ্দিন", text: "সমস্যা", status: "open", createdAt: "2026-05-06T10:00:00.000Z" },
    "audit/A-1": { at: "2026-05-01T10:00:00.000Z", who: "শাহাদাত আহমেদ", role: "admin", act: "পুরোনো রেকর্ড", target: "x", mod: "donor" },
    "settings/app": { rules: { donorApproval: true, emergencyApproval: true, bloodGroupApproval: true }, autoApproveEmergency: false },
  });
}

const dump = () => rtdb.__dump();
const has = (p) => {
  const parts = String(p).split("/").filter(Boolean);
  let node = dump();
  for (const seg of parts) {
    if (node === null || typeof node !== "object") return false;
    node = node[seg];
  }
  return node !== undefined && node !== null;
};
const at = (p) => {
  const parts = String(p).split("/").filter(Boolean);
  let node = dump();
  for (const seg of parts) {
    if (node === null || typeof node !== "object") return undefined;
    node = node[seg];
  }
  return node;
};

/* ══════════════════ ১. Dashboard loading / skeleton ══════════════════ */
console.log("\n── ১. Dashboard data loading (Skeleton → Data → Realtime) ──");
{
  seedDb();
  /* প্রথম snapshot হাতে না ছাড়া পর্যন্ত আটকে রাখি — লোডিং অবস্থা নির্ভরভাবে
     পরীক্ষা করা যায় (কোনো wall-clock টাইমিং জুজু নয়)। */
  rtdb.__setDelay(-1);
  const w = makeDom();
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));

  /* ড্যাশবোর্ড আঁকা হওয়া পর্যন্ত অপেক্ষা (সর্বোচ্চ ৬ সেকেন্ড) */
  for (let i = 0; i < 300 && !w.document.querySelector("#s-home .astat"); i += 1) await wait(20);
  const home = w.document.getElementById("s-home");
  const skCount = home ? home.querySelectorAll(".sk").length : 0;
  ok(skCount > 0, "লোডিং অবস্থায় Skeleton দেখায় (কোনো ফাঁকা/ভুল সংখ্যা নয়)", `${skCount}টি skeleton ব্লক`);
  const statNums = home ? [...home.querySelectorAll(".astat b")].map((b) => b.textContent.trim()) : [];
  ok(statNums.length === 0, "লোডিং অবস্থায় পরিসংখ্যানে কোনো সংখ্যা (০ সহ) দেখায় না", JSON.stringify(statNums));

  rtdb.__flush();   // Firebase-এর প্রথম snapshot ডেলিভারি
  for (let i = 0; i < 100 && w.document.querySelectorAll("#s-home .sk").length; i += 1) await wait(20);
  const statNums2 = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(JSON.stringify(statNums2) === JSON.stringify(["২", "১", "২", "১"]),
    "ডেটা লোড হওয়ার পর আসল সংখ্যা দেখায় (মোট ২ · প্রস্তুত ১ · অপেক্ষমাণ ২ · চলমান ১)", JSON.stringify(statNums2));
  const skAfter = w.document.querySelectorAll("#s-home .sk").length;
  ok(skAfter === 0, "ডেটা আসার পর আর কোনো Skeleton থাকে না", `${skAfter}টি`);

  /* realtime update — পুরো ডেটাবেস নতুন করে লোড না করেই count বদলায় */
  await rtdb.set(rtdb.ref({}, "donors/CBDC-2026-0003"), {
    id: "CBDC-2026-0003", donorId: "CBDC-2026-0003", name: "নতুন ডোনার", bloodGroup: "A+",
    area: "চকবাজার", phone: "01733333333", ownerUid: DONOR_A, status: "approved",
    available: true, verified: true, suspended: false, donations: 0, totalDonations: 0, joined: "2026-06-01",
  });
  await wait(120);
  const statNums3 = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(statNums3[0] === "৩", "নতুন ডোনার যোগ হলে realtime-এ count আপডেট (রিলোড/রি-ফেচ নয়)", JSON.stringify(statNums3));

  /* navigation-এ নতুন করে লোড না হওয়া — মেমোরি/state-এ থাকা ডেটাই ব্যবহার */
  const readsBefore = rtdb.__readCount();
  w.go("set");
  await wait(60);
  w.go("home");
  await wait(120);
  const statNums4 = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(statNums4[0] === "৩" && rtdb.__readCount() === readsBefore,
    "page navigation-এ ডেটা মেমোরি/state থেকে আসে — নতুন করে লোড হয় না", JSON.stringify(statNums4));
  root.unmount();
}

/* ══════════════════ ২. অনুমোদন ও সেটিংস ══════════════════ */
console.log("\n── ২. অনুমোদন ও সেটিংস ──");
{
  const w = makeDom();
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));
  await wait(700);
  w.go("set", "rules");
  await wait(120);
  const sub = w.document.getElementById("s-sub");
  const html = sub ? sub.innerHTML : "";
  const title = w.document.querySelector(".top h1");
  ok(!!title && title.textContent.trim() === "অনুমোদন ও সেটিংস",
    "পেজের শিরোনাম “অনুমোদন ও সেটিংস”", title ? title.textContent.trim() : "(কোনো শিরোনাম নেই)");
  ok(html.includes("অনুমোদন প্রক্রিয়া"), "“অনুমোদন প্রক্রিয়া” section আছে");
  for (const key of ["donorApproval", "donationApproval", "emergencyApproval", "bloodGroupApproval"])
    ok(html.includes(`data-rl="${key}"`), `toggle আছে: ${key}`);
  for (const [label, needle] of [
    ["রক্তদানের নিয়ম", "সর্বনিম্ন বয়স"],
    ["সংযোগ / ImgBB", "ImgBB API"],
    ["Firebase connection status", "Realtime Database</b>"],
    ["Data/Database statistics", "অডিট রেকর্ড"],
    ["সংরক্ষণ করুন button", "id=\"rSave\""],
  ])
    ok(!html.includes(needle), `সরিয়ে দেওয়া হয়েছে: ${label}`);

  /* toggle → RTDB-তে সেভ (রিলোড ছাড়াই) */
  const box = sub.querySelector('[data-rl="donationApproval"]');
  box.checked = false;
  box.dispatchEvent(new w.Event("change", { bubbles: true }));
  await wait(200);
  ok(at("settings/app/rules/donationApproval") === false,
    "toggle বদলালেই সেটিং RTDB `settings/app/rules`-এ সেভ হয়", String(at("settings/app/rules/donationApproval")));
  ok(at("settings/app/rules/donorApproval") === true && at("settings/app/rules/bloodGroupApproval") === true,
    "অন্য সেটিং অপরিবর্তিত থাকে");
  root.unmount();
}

/* ══════════════════ ৩. নিরাপদ সার্ভার-ভিত্তিক ডিলিট (Account ↔ Donor ID independent) ══════════════════ */
console.log("\n── ৩. ডোনার ব্যবস্থাপনা + ডোনার আইডি ব্যবস্থাপনা — নিরাপদ সার্ভার ডিলিট ──");

/* ── Cloudflare Worker-এর logic-ই fake RTDB-র সাথে (server-side) ── */
const TOKEN_ADMIN = "fake-id-token-admin";
const TOKEN_DONOR_A = "fake-id-token-donor-a";
const TOKEN_DONOR_B = "fake-id-token-donor-b";
const TOKEN_NOBODY = "fake-id-token-nobody";
const serverCalls = { deletes: [] };
/* সার্ভার ব্যর্থতা সিমুলেট (যেমন 403) — client কী দেখায় সেটা পরীক্ষার জন্য */
let serverFailWith = null;
const tokenMap = new Map([
  [TOKEN_ADMIN, ADMIN_UID],
  [TOKEN_DONOR_A, DONOR_A],
  [TOKEN_DONOR_B, DONOR_B],
  [TOKEN_NOBODY, "nobodyuid00000000000000"],
]);

function makeServerIo() {
  return {
    verifyToken: async (token) => {
      const uid = tokenMap.get(String(token || ""));
      return uid ? { uid } : null;
    },
    get: async (p) => rtdb.__at(p) ?? null,
    list: async (node) => rtdb.__at(node) ?? null,
    apply: async (paths) => {
      serverCalls.deletes.push(paths);
      rtdb.__serverUpdate(paths);
      return true;
    },
  };
}

const serverText = (e) => String((e && e.message) || "server error");

/* client-এর fetch-কে server endpoint-এ নিয়ে যায় — UI থেকেই আসল সার্ভার logic চলে */
function installFakeServerFetch() {
  const realFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const u = String(url || "");
    if (!u.includes("/api/admin/delete")) return realFetch(url, init);
    if (serverFailWith) {
      const err = serverFailWith;
      serverFailWith = null;
      return { ok: false, status: Number(err.status || 500), json: async () => ({ ok: false, error: serverText(err) }) };
    }
    const payload = JSON.parse(String(init.body || "{}"));
    const token = String((init.headers && init.headers.Authorization) || "").replace(/^Bearer\s+/i, "");
    try {
      const data = await deleteApi.handleAdminEntityDelete({ ...payload, idToken: token }, makeServerIo());
      return { ok: true, status: 200, json: async () => data };
    } catch (e) {
      return { ok: false, status: Number((e && e.status) || 500), json: async () => ({ ok: false, error: serverText(e) }) };
    }
  };
}

/* ── সার্ভার API সরাসরি — token/role যাচাই + entity independence ── */
{
  /* account scope: users/accounts/admins মোছা যায়, ডোনার আইডি অক্ষত */
  seedDb();
  const acc = await deleteApi.handleAdminEntityDelete(
    { scope: "account", uid: DONOR_A, idToken: TOKEN_ADMIN }, makeServerIo());
  ok(acc.ok === true && acc.scope === "account" && acc.rtdb === "ok" && acc.removed >= 3,
    "account scope — সার্ভার সফল (users + admins + accounts রেকর্ড)",
    JSON.stringify({ ok: acc.ok, removed: acc.removed }));
  ok(!has(`users/${DONOR_A}`) && !has(`admins/${DONOR_A}`) && !has(`accounts/${DONOR_A}`),
    "অ্যাকাউন্ট ডিলিট → users/admins/accounts মুছে গেছে");
  ok(has("donors/CBDC-2026-0001") && has("donors/CBDC-2026-0002"),
    "অ্যাকাউন্ট ডিলিট → ডোনার আইডি (donors node) পুরোপুরি অক্ষত");
  ok(has("members/MEMBER-A") && has("queue/PD-donorA") && has("requests/REQ-A") && has("reports/REP-A"),
    "অ্যাকাউন্ট ডিলিট → members/queue/requests/reports (ডোনার/সংগঠন তথ্য) অক্ষত");
  ok((acc.warnings || []).some((w) => /Authentication/.test(w)),
    "Auth account রয়ে গেলে স্পষ্ট warning (সার্ভারে private key নেই)");

  /* donor scope: donors/members/queue মোছা যায়, অ্যাকাউন্ট অক্ষত */
  seedDb();
  const don = await deleteApi.handleAdminEntityDelete(
    { scope: "donor", donorId: "CBDC-2026-0001", idToken: TOKEN_ADMIN }, makeServerIo());
  ok(don.ok === true && don.scope === "donor" && don.rtdb === "ok" && don.removed >= 3,
    "donor scope — সার্ভার সফল (donors + members + queue)", JSON.stringify({ ok: don.ok, removed: don.removed }));
  ok(!has("donors/CBDC-2026-0001") && !has("members/MEMBER-A") && !has("queue/PD-donorA"),
    "ডোনার আইডি ডিলিট → donors/members/queue মুছে গেছে");
  ok(has(`users/${DONOR_A}`) && has(`admins/${DONOR_A}`) && has(`accounts/${DONOR_A}`),
    "ডোনার আইডি ডিলিট → অ্যাকাউন্ট (users/admins/accounts) পুরোপুরি অক্ষত");
  ok(has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`) && has("requests/REQ-A"),
    "অন্য ডোনারের ডোনার আইডি ও অ্যাকাউন্ট অক্ষত (donor scope শুধু টার্গেট স্পর্শ করে)");

  /* ক্রম: account → donor (একই মানুষ) — দুটো entity আলাদা থাকে */
  seedDb();
  await deleteApi.handleAdminEntityDelete({ scope: "account", uid: DONOR_A, idToken: TOKEN_ADMIN }, makeServerIo());
  const afterAccount = await deleteApi.handleAdminEntityDelete(
    { scope: "donor", donorId: "CBDC-2026-0001", idToken: TOKEN_ADMIN }, makeServerIo());
  ok(afterAccount.ok === true && !has("donors/CBDC-2026-0001") && !has(`users/${DONOR_A}`),
    "একই মানুষ: প্রথম অ্যাকাউন্ট, পরে ডোনার আইডি — উভয়ই আলাদাভাবে মুছে যায়");

  /* অনুমোদন: ভুল টোকেন / অ-অ্যাডমিন / নিজের অ্যাকাউন্ট / ভুল input */
  seedDb();
  const noToken = await deleteApi.handleAdminEntityDelete({ scope: "donor", donorId: "CBDC-2026-0001", idToken: "" }, makeServerIo())
    .then(() => null, (e) => e);
  ok(noToken && noToken.status === 401, "টোকেন ছাড়া → 401 (কিছুই মোছা হয় না)", serverText(noToken));
  const badToken = await deleteApi.handleAdminEntityDelete({ scope: "donor", donorId: "CBDC-2026-0001", idToken: "not-a-valid-token" }, makeServerIo())
    .then(() => null, (e) => e);
  ok(badToken && badToken.status === 401, "ভুল টোকেন → 401", serverText(badToken));
  const donorAsCaller = await deleteApi.handleAdminEntityDelete({ scope: "donor", donorId: "CBDC-2026-0001", idToken: TOKEN_DONOR_A }, makeServerIo())
    .then(() => null, (e) => e);
  ok(donorAsCaller && donorAsCaller.status === 403, "মডারেটর/সাধারণ ডোনার → 403 — শুধু অ্যাডমিন", serverText(donorAsCaller));
  const self = await deleteApi.handleAdminEntityDelete({ scope: "account", uid: ADMIN_UID, idToken: TOKEN_ADMIN }, makeServerIo())
    .then(() => null, (e) => e);
  ok(self && self.status === 400, "নিজের অ্যাকাউন্ট delete → 400", serverText(self));
  const badUid = await deleteApi.handleAdminEntityDelete({ scope: "account", uid: "short", idToken: TOKEN_ADMIN }, makeServerIo())
    .then(() => null, (e) => e);
  ok(badUid && badUid.status === 400, "ভুল UID ফরম্যাট → 400 — কিছুই মোছা হয় না", serverText(badUid));
  const missing = await deleteApi.handleAdminEntityDelete({ scope: "donor", donorId: "CBDC-9999-0000", idToken: TOKEN_ADMIN }, makeServerIo())
    .then(() => null, (e) => e);
  ok(missing && missing.status === 404, "অজানা ডোনার আইডি → 404 — কিছুই মোছা হয় না", serverText(missing));
  ok(has("donors/CBDC-2026-0001") && has(`users/${DONOR_A}`), "তালিকার উপরের সব ব্যর্থতায় সব ডেটা অক্ষত");
}

/* ── নিরাপত্তা: client-এ কোনো Admin SDK / secret / deletion logic নেই; server-এও না ── */
{
  const readSrc = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
  const clientFiles = ["src/lib/accountDelete.ts", "src/lib/imgbb.ts", "src/pages/Admin.tsx", "src/lib/rtdb.ts"];
  const banned = [
    /from\s+["']firebase-admin/,
    /require\(["']firebase-admin/,
    /private_key\s*[:=]/i,
    /BEGIN (RSA |EC )?PRIVATE KEY/,
    /admin\.credential/,
    /["']type["']\s*:\s*["']service_account["']/i,
    /getAuth\(\)\.deleteUser|admin\.auth\(\)\.deleteUser/,
  ];
  for (const file of clientFiles) {
    const src = readSrc(file);
    const hits = banned.filter((re) => re.test(src));
    ok(hits.length === 0, `${file} — কোনো Admin SDK/service-account secret নেই`, hits.map(String).join(","));
  }
  for (const file of ["server/deleteApi.ts", "server/httpIo.ts", "server/index.ts"]) {
    const src = readSrc(file);
    const hits = banned.filter((re) => re.test(src));
    ok(hits.length === 0, `${file} — সার্ভারেও কোনো private key/service-account নেই`, hits.map(String).join(","));
  }
  ok(!/httpsCallable|firebase\/functions/.test(readSrc("src/lib/accountDelete.ts"))
    && !/httpsCallable|firebase\/functions/.test(readSrc("src/lib/imgbb.ts")),
    "delete/upload flow-এ কোনো Cloud Function/callable নেই (একটাই secure Worker endpoint)");
  ok(!existsSync(path.join(ROOT, "functions")), "functions/ ডিরেক্টরি নেই");
  ok(!/"functions":/.test(readSrc("firebase.json")), "firebase.json-এ functions config নেই");
  const clientDelete = readSrc("src/lib/accountDelete.ts");
  ok(/api\/admin\/delete/.test(clientDelete) && /Bearer \$\{token\}/.test(clientDelete),
    "client শুধু authenticated request পাঠায় (Authorization: Bearer ID token)");
  ok(!/updatePaths|removePath|planDonorDeletion|resolveDonorIdentity|deletePaths/.test(clientDelete),
    "client-এ কোনো deletion logic নেই — সব সার্ভারে (server/deleteApi.ts)");
  const serverSrc = readSrc("server/deleteApi.ts") + readSrc("server/httpIo.ts");
  ok(/handleAdminEntityDelete/.test(serverSrc) && /identitytoolkit|accounts:lookup/i.test(serverSrc)
    && /role\s*(?:===\s*"admin"|!==\s*"admin")/.test(serverSrc) && /auth=/.test(serverSrc),
    "server: token যাচাই → অ্যাডমিন role যাচাই → RTDB Security Rules-এর অধীনেই delete");
  ok(readSrc("server/index.ts").includes("ASSETS.fetch") && readSrc("wrangler.jsonc").includes('"main": "server/index.ts"'),
    "Cloudflare Worker entry + static assets একসাথে (wrangler.jsonc)");
  const storagePatterns = [/firebase-admin\/storage/, /getStorage\s*\(/, /\.bucket\s*\(/, /deleteFiles/];
  for (const file of [...clientFiles, "server/deleteApi.ts", "server/httpIo.ts", "server/index.ts"]) {
    const hits = storagePatterns.filter((re) => re.test(readSrc(file)));
    ok(hits.length === 0, `${file} — কোনো Firebase Storage dependency নেই`, hits.map(String).join(","));
  }
}

/* ── UI দিয়েই ডিলিট: দুটি আলাদা স্ক্রিন, checkbox শুধু নির্বাচন, row ক্লিক → প্রোফাইল ── */
{
  const originalHandleAdminDelete = deleteApi.handleAdminEntityDelete;
  seedDb(true);
  /* অ্যাকাউন্ট-বিহীন ডোনার আইডি — ডোনার আইডি ব্যবস্থাপনায় দেখা যাবে, অ্যাকাউন্ট ব্যবস্থাপনায় নয় */
  rtdb.__seed({
    "donors/CBDC-2026-0003": {
      id: "CBDC-2026-0003", donorId: "CBDC-2026-0003", name: "আব্দুল করিম", bloodGroup: "AB+",
      area: "আগ্রাবাদ", phone: "01733333333", status: "approved",
      available: true, verified: true, suspended: false, donations: 0, totalDonations: 0, joined: "2026-03-01",
    },
  });
  const w = makeDom();
  installFakeServerFetch();
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));
  await wait(700);
  const lastToast = () => {
    const list = [...w.document.querySelectorAll("#toasts > div")];
    return list.length ? list[list.length - 1].textContent.trim() : "";
  };
  const click = (el) => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const change = (el) => el && el.dispatchEvent(new w.Event("change", { bubbles: true }));
  const clearToasts = () => {
    const box = w.document.getElementById("toasts");
    if (box) box.innerHTML = "";
  };
  const confirmDelete = async () => {
    for (let i = 0; i < 100 && !w.document.querySelector("#cy"); i += 1) await wait(20);
    clearToasts();
    click(w.document.querySelector("#cy"));
    for (let i = 0; i < 400 && !lastToast(); i += 1) await wait(20);
  };
  const tsel = () => [...w.document.querySelectorAll("#s-sub [data-tsel]")].map((c) => c.dataset.tsel);

  /* ── ১) ডোনার ব্যবস্থাপনা: শুধু অ্যাকাউন্ট-ওয়ালা ডোনার ── */
  w.go("set", "team");
  await wait(200);
  ok(JSON.stringify(tsel()) === JSON.stringify(["CBDC-2026-0001", "CBDC-2026-0002"]),
    "ডোনার ব্যবস্থাপনায় শুধু Website/Firebase অ্যাকাউন্ট-ওয়ালা ডোনার (অ্যাকাউন্ট-বিহীন নয়)", JSON.stringify(tsel()));

  /* ✓ কোনো "দেখুন" বাটন নেই */
  ok([...w.document.querySelectorAll("#s-sub button")].every((b) => !/দেখুন/.test(b.textContent)),
    "ডোনার ব্যবস্থাপনায় কোনো আলাদা “দেখুন” বাটন নেই");
  ok(!w.document.querySelector("#s-sub [data-top]"), "data-top (দেখুন) এলিমেন্ট নেই");

  /* ✓ চেকবক্স ক্লিক → শুধু নির্বাচন (প্রোফাইল খোলে না) */
  const cbA = w.document.querySelector('[data-tsel="CBDC-2026-0001"]');
  click(cbA);
  await wait(120);
  ok(w.getSub() === "team", "চেকবক্সে ক্লিক প্রোফাইল খোলে না — শুধু নির্বাচন", w.getSub());
  cbA.checked = true;
  change(cbA);
  await wait(120);
  ok(!w.document.querySelector("#tdel").disabled && /১/.test(w.document.querySelector("#tdel").textContent),
    "একজন নির্বাচিত → ডিলিট বাটন সক্রিয় (১)", w.document.querySelector("#tdel").textContent);

  /* ✓ একাধিক নির্বাচন (multi select) */
  const cbB = w.document.querySelector('[data-tsel="CBDC-2026-0002"]');
  cbB.checked = true;
  change(cbB);
  await wait(120);
  ok(/২/.test(w.document.querySelector("#tdel").textContent), "একাধিক নির্বাচন (bulk) — ডিলিট (২)", w.document.querySelector("#tdel").textContent);

  /* ✓ row-এর অন্য অংশে ক্লিক → বিদ্যমান প্রোফাইল */
  click(w.document.querySelector('[data-row="CBDC-2026-0001"]'));
  await wait(200);
  ok(w.getSub() === "donor", "কার্ড/পঙ্‌ক্তিতে ক্লিক → বিদ্যমান ডোনার প্রোফাইল খোলে", w.getSub());
  ok((w.document.getElementById("s-sub")?.textContent || "").includes("CBDC-2026-0001"),
    "প্রোফাইলে সঠিক ডোনার খোলে");

  /* ── ২) ডোনার ব্যবস্থাপনা → একজনের অ্যাকাউন্ট ডিলিট (ডোনার আইডি অক্ষত) ── */
  w.go("set", "team");
  await wait(150);
  /* আগের multi-select রিসেট — শুধু একজন নির্বাচন */
  {
    const tallAll = w.document.querySelector("#tall");
    tallAll.checked = false;
    change(tallAll);
    await wait(120);
  }
  {
    const only = w.document.querySelector('[data-tsel="CBDC-2026-0001"]');
    only.checked = true;
    change(only);
  }
  await wait(100);
  serverCalls.deletes.length = 0;
  click(w.document.querySelector("#tdel"));
  await confirmDelete();
  ok(lastToast() === "অ্যাকাউন্ট মুছে ফেলা হয়েছে — ডোনার আইডি অক্ষত আছে",
    "একজনের success: “অ্যাকাউন্ট মুছে ফেলা হয়েছে — ডোনার আইডি অক্ষত আছে”", lastToast());
  ok(serverCalls.deletes.length === 1
    && !("donors/CBDC-2026-0001" in serverCalls.deletes[0])
    && (`users/${DONOR_A}` in serverCalls.deletes[0]),
    "সার্ভারেই মোছা হয়েছে (client নিজে RTDB-তে লেখেনি) — account scope", JSON.stringify(serverCalls.deletes));
  ok(!has(`users/${DONOR_A}`) && !has(`accounts/${DONOR_A}`) && !has(`admins/${DONOR_A}`),
    "RTDB থেকে users/accounts/admins মুছে গেছে");
  ok(has("donors/CBDC-2026-0001"), "অ্যাকাউন্ট ডিলিটের পর ডোনার আইডি অক্ষত আছে");
  /* reload ছাড়াই realtime — অ্যাকাউন্ট-বিহীন ডোনার ডোনার ব্যবস্থাপনা থেকে সরে যায় */
  for (let i = 0; i < 200 && tsel().length !== 1; i += 1) await wait(20);
  ok(JSON.stringify(tsel()) === JSON.stringify(["CBDC-2026-0002"]),
    "reload ছাড়াই realtime-এ তালিকা আপডেট (অ্যাকাউন্টহীন ডোনার সরে গেছে)", JSON.stringify(tsel()));

  /* পরের দৃশ্যের জন্য আবার সিড — UI/লিসেনার অক্ষত রেখে (Firebase-এর মতো) */
  seedDb(true);
  rtdb.__seedLive({
    "donors/CBDC-2026-0003": {
      id: "CBDC-2026-0003", donorId: "CBDC-2026-0003", name: "আব্দুল করিম", bloodGroup: "AB+",
      area: "আগ্রাবাদ", phone: "01733333333", status: "approved",
      available: true, verified: true, suspended: false, donations: 0, totalDonations: 0, joined: "2026-03-01",
    },
  });
  await wait(250);

  /* ── ৩) ডোনার আইডি ব্যবস্থাপনা: সব ডোনার আইডি (অ্যাকাউন্ট ছাড়াও) ── */
  w.go("set", "donorid");
  await wait(200);
  ok(JSON.stringify(tsel()) === JSON.stringify(["CBDC-2026-0001", "CBDC-2026-0002", "CBDC-2026-0003"]),
    "ডোনার আইডি ব্যবস্থাপনায় সব ডোনার আইডি — অ্যাকাউন্ট না থাকলেও (অ্যাকাউন্টবিহীন 0003 সহ)", JSON.stringify(tsel()));
  ok([...w.document.querySelectorAll("#s-sub button")].every((b) => !/দেখুন/.test(b.textContent)),
    "ডোনার আইডি ব্যবস্থাপনায়ও কোনো “দেখুন” বাটন নেই");
  const cbC = w.document.querySelector('[data-tsel="CBDC-2026-0001"]');
  click(cbC);
  await wait(120);
  ok(w.getSub() === "donorid", "ডোনার আইডি স্ক্রিনেও চেকবক্স ক্লিক প্রোফাইল খোলে না", w.getSub());
  change(cbC);
  await wait(100);
  click(w.document.querySelector('[data-row="CBDC-2026-0003"]'));
  await wait(200);
  ok(w.getSub() === "donor", "অ্যাকাউন্ট-বিহীন ডোনার আইডির row ক্লিকেও প্রোফাইল খোলে", w.getSub());

  /* ── ৪) ডোনার আইডি ব্যবস্থাপনা → একাধিক ডোনার আইডি ডিলিট (অ্যাকাউন্ট অক্ষত) ── */
  w.go("set", "donorid");
  await wait(150);
  const boxes = [...w.document.querySelectorAll("[data-tsel]")].filter((b) =>
    b.dataset.tsel === "CBDC-2026-0001" || b.dataset.tsel === "CBDC-2026-0003");
  boxes.forEach((b) => {
    b.checked = true;
    change(b);
  });
  await wait(120);
  serverCalls.deletes.length = 0;
  click(w.document.querySelector("#tdel"));
  await confirmDelete();
  ok(lastToast() === "নির্বাচিত ডোনার আইডিগুলো মুছে ফেলা হয়েছে — অ্যাকাউন্ট অক্ষত",
    "একাধিকের success: “নির্বাচিত ডোনার আইডিগুলো মুছে ফেলা হয়েছে — অ্যাকাউন্ট অক্ষত”", lastToast());
  ok(serverCalls.deletes.length === 2
    && serverCalls.deletes.every((p) => !(`users/${DONOR_A}` in p) && !(`accounts/${DONOR_A}` in p))
    && serverCalls.deletes.every((p) => ("donors/CBDC-2026-0001" in p) || ("donors/CBDC-2026-0003" in p)),
    "donor scope-র প্রতিটি path-এ অ্যাকাউন্ট (users/accounts) নেই", JSON.stringify(serverCalls.deletes));
  ok(!has("donors/CBDC-2026-0001") && !has("donors/CBDC-2026-0003"),
    "ডোনার আইডি রেকর্ড দুটি RTDB থেকে মুছে গেছে");
  ok(has(`users/${DONOR_A}`) && has(`accounts/${DONOR_A}`) && has(`admins/${DONOR_A}`),
    "ডোনার আইডি ডিলিটের পর অ্যাকাউন্ট পুরোপুরি অক্ষত");
  ok(!has("members/MEMBER-A") && !has("queue/PD-donorA"),
    "ডোনার-সম্পর্কিত রেকর্ড (members/queue) মুছে গেছে");
  ok(has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`),
    "অন্য ডোনারের আইডি ও অ্যাকাউন্ট অক্ষত");
  /* reload ছাড়াই realtime — তালিকা থেকে মুছে যায় */
  for (let i = 0; i < 200 && tsel().length !== 1; i += 1) await wait(20);
  ok(JSON.stringify(tsel()) === JSON.stringify(["CBDC-2026-0002"]),
    "reload ছাড়াই realtime-এ ডোনার আইডি তালিকা আপডেট", JSON.stringify(tsel()));
  ok(has("audit/A-1"), "bulk delete-এর পরেও audit লগ অক্ষত");

  /* ── ৫) cross-screen realtime: ডোনার আইডি মুছলে অ্যাকাউন্ট স্ক্রিনও আপডেট ── */
  w.go("set", "team");
  await wait(150);
  ok(JSON.stringify(tsel()) === JSON.stringify(["CBDC-2026-0002"]),
    "ডোনার আইডি মুছলে ডোনার ব্যবস্থাপনাও realtime-এ আপডেট (কোনো reload নয়)", JSON.stringify(tsel()));

  /* ── ৬) fail হলে সাফল্য নয়: সার্ভার ৪০০/৪০৩ → স্পষ্ট বার্তা, ডেটা অক্ষত ── */
  w.go("set", "team");
  await wait(150);
  change(w.document.querySelector('[data-tsel="CBDC-2026-0002"]'));
  await wait(100);
  clearToasts();
  {
    const only = w.document.querySelector('[data-tsel="CBDC-2026-0002"]');
    only.checked = true;
    change(only);
    await wait(100);
  }
  serverFailWith = Object.assign(new Error("শুধু অ্যাডমিন এই কাজ করতে পারেন।"), { status: 403 });
  click(w.document.querySelector("#tdel"));
  await confirmDelete();
  ok(/শুধু অ্যাডমিন/.test(lastToast()), "সার্ভার অনুমতি না দিলে সাফল্য দেখানো হয় না", lastToast());
  ok(has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`),
    "ব্যর্থ হলে কোনো ডেটা মোছা হয় না");
  void originalHandleAdminDelete;
  root.unmount();
}

/* ══════════════════ ৪. Access & Role — data preserve ══════════════════ */
console.log("\n── ৪. অ্যাক্সেস ও ভূমিকা — existing account data preserve ──");
{
  seedDb(true);
  const w = makeDom();
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));
  await wait(700);
  w.go("set", "access");
  await wait(200);

  const row = w.document.querySelector(`[data-ac="${DONOR_B}"]`);
  ok(!!row, "অ্যাক্সেস ও ভূমিকা তালিকায় অ্যাকাউন্ট দেখা যায়");
  if (row) {
    row.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await wait(150);
    const chip = w.document.querySelector('#acr [data-r="admin"]');
    ok(!!chip, "নতুন ভূমিকা নির্বাচনের অপশন আছে");
    chip?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await wait(60);
    const save = w.document.querySelector("#acok");
    save?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await wait(300);

    ok(at(`users/${DONOR_B}/role`) === "admin", "users/{uid}/role আপডেট হয়েছে", String(at(`users/${DONOR_B}/role`)));
    ok(!!at(`admins/${DONOR_B}`) && at(`admins/${DONOR_B}/role`) === "admin",
      "admins/{uid}-এ নতুন ভূমিকা সেভ হয়েছে");
    const profile = at(`users/${DONOR_B}`) || {};
    ok(profile.name === "জসিম উদ্দিন" && profile.username === "josim" && profile.email === "josim@cbdc.test"
      && profile.phone === "01722222222" && profile.photoURL === "https://imgbb.test/josim.png"
      && profile.donorId === "CBDC-2026-0002",
      "existing তথ্য (নাম, username, email, মোবাইল, ছবি, Donor ID) অক্ষত",
      JSON.stringify(profile));
    ok(at(`admins/${DONOR_B}/name`) === "জসিম উদ্দিন" && at(`admins/${DONOR_B}/username`) === "josim"
      && at(`admins/${DONOR_B}/email`) === "josim@cbdc.test",
      "নতুন staff রেকর্ডেও পুরাতন তথ্য কপি হয় (খালি/overwrite নয়)",
      JSON.stringify(at(`admins/${DONOR_B}`)));
    ok(has("donors/CBDC-2026-0002") && at(`users/${DONOR_B}`).donorId === "CBDC-2026-0002"
      && at("donors/CBDC-2026-0002").ownerUid === DONOR_B,
      "ডোনার রেকর্ড/অ্যাকাউন্ট ডেটা orphan বা disconnected হয়নি (uid ↔ donorId লিংক অক্ষত)");
    const accounts = Object.values(at("accounts") || {}).filter((a) => String(a?.uid || "") === DONOR_B);
    ok(accounts.length <= 1, "একই UID-এর জন্য duplicate অ্যাকাউন্ট তৈরি হয় না", `${accounts.length}টি`);
    /* reload ছাড়াই UI আপডেট */
    await wait(250);
    const chips = [...w.document.querySelectorAll(`[data-ac="${DONOR_B}"] .tag`)].map((t) => t.textContent.trim());
    ok(chips.some((c) => c.includes("অ্যাডমিন")), "reload ছাড়াই realtime-এ UI-তে নতুন ভূমিকা দেখায়", JSON.stringify(chips));
  }
  root.unmount();
}

await vite.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
