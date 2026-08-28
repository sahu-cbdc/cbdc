/**
 * CBDC — Admin Panel verification (jsdom + in-memory Firebase)
 *
 *  ১. Dashboard data loading — লোডিং অবস্থায় Skeleton (কোনো ভুল "০" নয়),
 *     ডেটা আসার পর আসল সংখ্যা, এবং realtime-এ নতুন করে full-load না হওয়া।
 *  ২. "অনুমোদন ও সেটিংস" — পুরোনো "নিয়ম/সংযোগ/ImgBB/ডেটা/সংরক্ষণ করুন"
 *     অংশ নেই; ৪টি approval toggle RTDB-তে সেভ হয়।
 *  ৩. Donor delete — Donor ID/UID/প্রোফাইল/অ্যাকাউন্ট/আবেদন/Auth সব মুছে যায়,
 *     orphan data থাকে না; ভুল UID-তে কিছু মোছা হয় না; partial-এ success নয়।
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
const accountDelete = await vite.ssrLoadModule("/src/lib/accountDelete.ts");

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

/* ══════════════════ ৩. Donor delete — সম্পূর্ণ delete system ══════════════════ */
console.log("\n── ৩. Donor Management — সম্পূর্ণ ডিলিট (RTDB → Auth) ──");

/* ১) Single donor delete — RTDB + Auth */
{
  seedDb();
  const result = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  ok(result.ok === true, "১. Single donor delete — সব ধাপ সফল", JSON.stringify(result.failed.map((f) => f.label)));
  ok(result.rtdb === "ok", "৩. RTDB data delete সফল", String(result.rtdb));
  ok(result.auth === "skipped" && result.server === "not-possible"
    && (result.warnings || []).some((w) => /Authentication/.test(w)),
    "৪. অন্য ব্যবহারকারীর Auth account: সম্ভব নয় → skipped + warning (মিথ্যে সাফল্য নয়)",
    `${result.auth}/${result.server}`);
  ok(!/httpsCallable|firebase\/functions/.test(readFileSync(path.join(ROOT, "src/lib/accountDelete.ts"), "utf8")),
    "Auth delete-এর জন্য কোনো Cloud Function/callable নেই");
  for (const [node, label] of [
    ["donors/CBDC-2026-0001", "Donor profile"],
    [`users/${DONOR_A}`, "User profile (+ data/donations)"],
    [`admins/${DONOR_A}`, "Admin/Moderator reference"],
    [`accounts/${DONOR_A}`, "Account information"],
    ["members/MEMBER-A", "Donor application (members)"],
    ["queue/PD-donorA", "Queue/approval + blood donation verification"],
    ["requests/REQ-A", "Emergency application (requests)"],
    ["reports/REP-A", "Reports"],
  ])
    ok(!has(node), `মুছে গেছে: ${label} (${node})`);
  for (const [node, label] of [
    ["donors/CBDC-2026-0002", "অন্য ডোনারের প্রোফাইল"],
    [`users/${DONOR_B}`, "অন্য ডোনারের অ্যাকাউন্ট"],
    ["queue/PD-donorB", "অন্য ডোনারের queue"],
    ["audit/A-1", "audit লগ (append-only)"],
    [`admins/${ADMIN_UID}`, "নিজের (অ্যাডমিন) রেকর্ড"],
  ])
    ok(has(node), `অক্ষত আছে: ${label}`);
  const leftover = JSON.stringify(dump());
  ok(!leftover.includes(DONOR_A) && !leftover.includes("CBDC-2026-0001"),
    "UID/Donor ID-এর কোনো orphan reference বাকি থাকে না");
  ok(accountDelete.deletionMessage(result) === "ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে",
    "সাফল্যের বার্তা (একজন)", accountDelete.deletionMessage(result));
}

/* ৫) Missing RTDB record — failure নয় */
{
  seedDb();
  const missing = await accountDelete.deleteDonorCompletely({ uid: "missinguid00000000000missing" });
  ok(missing.ok === true && (missing.auth === "skipped" || missing.auth === "missing"),
    "৫-৬. Missing RTDB record ও missing Auth account safely handled", `${missing.ok}/${missing.auth}`);
  ok(has("donors/CBDC-2026-0001") && has("donors/CBDC-2026-0002"),
    "রেকর্ড না থাকলে অন্য কোনো ডোনারের তথ্য ছোঁয়া হয় না");
}

/* ৭) UID/Donor ID mismatch — কিছুই মোছা হবে না */
{
  seedDb();
  const bad = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0002", uid: DONOR_A });
  ok(bad.ok === false && /মিলছে না|UID/.test(String(bad.failed[0]?.error || "")),
    "৭. UID/Donor ID mismatch — কোনো deletion শুরুই হয় না", bad.failed[0]?.error || "");
  ok(has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`) && has(`users/${DONOR_A}`),
    "mismatch-এ সব ডেটা অক্ষত থাকে");
  /* Donor ID → UID chain: donors row-এর ownerUid অন্য হলেও ধরা পড়ে */
  const cross = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_B });
  ok(cross.ok === false, "Donor ID-এর মালিক অন্য UID হলে delete হবে না");
  /* legacy uid hint (Donor ID) — সঠিক UID resolve করে মোছা হয় */
  seedDb();
  const legacy = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0002", uid: "CBDC-2026-0002" });
  ok(legacy.ok === true && legacy.uid === DONOR_B,
    "legacy uid hint উপেক্ষা করে identity chain থেকে সঠিক UID resolve করে", `${legacy.ok}/${legacy.uid}`);
  ok(!has("donors/CBDC-2026-0002") && has(`users/${DONOR_A}`),
    "legacy রেকর্ড মোছার সময় অন্য অ্যাকাউন্ট অক্ষত");
}

/* ৮) Authentication — নিজের অ্যাকাউন্ট মোছা যায়, অন্যের সম্ভব নয় (warning) */
{
  seedDb();
  /* অন্য ব্যবহারকারী (admin নিজে নন) → RTDB মোছা যায়, Auth সম্ভব নয় */
  const other = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  ok(other.ok === true && other.rtdb === "ok" && other.auth === "skipped",
    "৮. অন্য ব্যবহারকারী: RTDB সম্পূর্ণ মোছা যায়, Auth skipped (কোনো মিথ্যে সাফল্য নয়)",
    `${other.rtdb}/${other.auth}`);
  ok((other.warnings || []).some((w) => /Authentication/.test(w)),
    "Auth account রয়ে গেলে স্পষ্ট warning থাকে", (other.warnings || [])[0] || "");
  ok((other.warnings || []).some((w) => /Authentication/.test(w) && /Console/.test(w)),
    "Warning-এ পরিষ্কার নির্দেশ: Auth account Firebase Console থেকে মুছতে হবে",
    (other.warnings || [])[0] || "(কোনো warning নেই)");
  for (const node of ["donors/CBDC-2026-0001", `users/${DONOR_A}`, `admins/${DONOR_A}`,
    `accounts/${DONOR_A}`, "members/MEMBER-A", "queue/PD-donorA", "requests/REQ-A", "reports/REP-A"])
    ok(!has(node), `RTDB থেকে মুছে গেছে: ${node}`);

  /* নিজের অ্যাকাউন্ট (currentUser = ADMIN_UID) → client SDK দিয়ে Auth-ও মোছা যায় */
  seedDb();
  fakeAuth.__deletedUids.length = 0;
  const self = await accountDelete.deleteDonorCompletely({ uid: ADMIN_UID });
  ok(self.ok === true && self.auth === "deleted" && fakeAuth.__deletedUids.includes(ADMIN_UID),
    "নিজের Authentication account client SDK দিয়ে মোছা যায়", `${self.auth}`);

  /* নিজের হলেও Auth ব্যর্থ হলে success নয় */
  seedDb();
  fakeAuth.__failingDeleteUids.add(ADMIN_UID);
  const selfFail = await accountDelete.deleteDonorCompletely({ uid: ADMIN_UID });
  fakeAuth.__failingDeleteUids.delete(ADMIN_UID);
  ok(selfFail.ok === false && selfFail.rtdb === "ok" && selfFail.auth === "failed",
    "RTDB সফল কিন্তু Auth ব্যর্থ → success নয়", `${selfFail.rtdb}/${selfFail.auth}`);
  ok(accountDelete.deletionMessage(selfFail)
    === "ডোনারের RTDB তথ্য মুছে ফেলা হয়েছে, কিন্তু Authentication account মুছে ফেলা যায়নি।",
    "partial বার্তা পরিষ্কার", accountDelete.deletionMessage(selfFail));

  /* RTDB ব্যর্থ → Auth-এ যাওয়া হবে না */
  seedDb();
  rtdb.__lockClientWrites(true);
  const rtdbFailed = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  rtdb.__lockClientWrites(false);
  ok(rtdbFailed.ok === false && rtdbFailed.rtdb === "failed" && rtdbFailed.auth === "skipped",
    "RTDB ব্যর্থ হলে Authentication-এ যাওয়া হয় না", `${rtdbFailed.rtdb}/${rtdbFailed.auth}`);
  ok(has("donors/CBDC-2026-0001") && has(`users/${DONOR_A}`), "RTDB ব্যর্থ হলে কোনো তথ্য মোছা হয় না");
}


/* ২) Multiple donor delete — প্রতিটি donor আলাদাভাবে resolve, mixed outcome */
{
  seedDb();
  /* দুজন-ই অন্য ব্যবহারকারী — RTDB মোছা যায়, Auth skipped (Firebase সীমা) */
  const first = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  const second = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0002", uid: DONOR_B });
  ok(first.ok === true && first.rtdb === "ok" && first.auth === "skipped",
    "২. একাধিক donor — প্রত্যেকের identity আলাদাভাবে resolve হয়ে RTDB মোছা যায়",
    `${first.rtdb}/${first.auth}`);
  ok(second.ok === true && second.rtdb === "ok" && second.auth === "skipped",
    "দ্বিতীয় donor-এরও নিজস্ব identity দিয়েই deletion সম্পন্ন হয়",
    `${second.rtdb}/${second.auth}`);
  ok(accountDelete.deletionMessage(first) === "ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে"
    && accountDelete.deletionMessage(second) === "ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে",
    "প্রতিটি donor-এর জন্য সাফল্য বার্তা", accountDelete.deletionMessage(first));
  ok(!has(`users/${DONOR_A}`) && !has(`users/${DONOR_B}`)
    && !has("donors/CBDC-2026-0001") && !has("donors/CBDC-2026-0002"),
    "সব নির্বাচিত donor-এর সব তথ্য মুছে গেছে");
  /* ভুল identity যেন অন্য donor-এর ডেটা না মোছে */
  seedDb();
  const wrongForB = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_B });
  ok(wrongForB.ok === false, "এক donor-এর ভুল identity দেওয়া হলে deletion শুরুই হয় না");
  ok(has("donors/CBDC-2026-0001") && has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`),
    "ভুল identity-তে কারও কোনো তথ্য মোছা হয় না");
}

/* Storage/Cloud Functions কোনোভাবেই ব্যবহৃত হবে না + database structure অপরিবর্তিত */
{
  const readSrc = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
  const storagePatterns = [/firebase-admin\/storage/, /getStorage\s*\(/, /\.bucket\s*\(/, /deleteFiles/];
  for (const file of ["src/lib/accountDelete.ts", "src/lib/imgbb.ts", "src/pages/Admin.tsx", "src/pages/Doner.tsx"]) {
    const hits = storagePatterns.filter((re) => re.test(readSrc(file)));
    ok(hits.length === 0, `${file} — কোনো Firebase Storage dependency নেই`, hits.map(String).join(","));
  }
  ok(!/httpsCallable|firebase\/functions/.test(readSrc("src/lib/accountDelete.ts"))
    && !/httpsCallable|firebase\/functions/.test(readSrc("src/lib/imgbb.ts")),
    "delete/upload flow-এ কোনো Cloud Function/callable নেই");
  ok(!existsSync(path.join(ROOT, "functions")), "functions/ ডিরেক্টরি সম্পূর্ণ remove করা হয়েছে");
  ok(!/"functions":/.test(readSrc("firebase.json")), "firebase.json-এ functions config নেই");
  /* নতুন কোনো path তৈরি হয় না — মুছার আগে/পরে top-level node একই থাকে */
  seedDb();
  const before = Object.keys(dump()).sort().join(",");
  await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  const after = Object.keys(dump()).sort().join(",");
  ok(before === after, "কোনো নতুন database path/node তৈরি হয় না (structure অপরিবর্তিত)", after);
}

/* ── কোনো Cloud Function ছাড়াই RTDB দিয়েই পুরো ডিলিট ── */
{
  seedDb();
  const result = await accountDelete.deleteDonorCompletely({ donorId: "CBDC-2026-0001", uid: DONOR_A });
  ok(result.ok === true, "Cloud Function ছাড়াই ডিলিট সম্পন্ন (Realtime Database + rules)",
    JSON.stringify(result.failed.map((f) => f.label)));
  for (const node of ["donors/CBDC-2026-0001", `users/${DONOR_A}`, `admins/${DONOR_A}`,
    `accounts/${DONOR_A}`, "members/MEMBER-A", "queue/PD-donorA", "requests/REQ-A", "reports/REP-A"])
    ok(!has(node), `সম্পূর্ণ মুছে গেছে: ${node}`);
  ok(has("donors/CBDC-2026-0002") && has(`users/${DONOR_B}`) && has("audit/A-1"),
    "অন্য ডোনারের তথ্য ও audit লগ অক্ষত");
}


/* ── নিরাপত্তা: frontend-এ Admin SDK বা কোনো secret নেই ── */
{
  const readSrc = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
  const clientFiles = ["src/lib/accountDelete.ts", "src/lib/imgbb.ts", "src/pages/Admin.tsx", "src/lib/rtdb.ts"];
  /* আসল credential/Admin SDK ব্যবহারের patterns — কমেন্টে শব্দ থাকলেই মেলে না। */
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
    ok(hits.length === 0, `${file} — কোনো Admin SDK/service-account secret নেই`,
      hits.map(String).join(","));
  }
  ok(!existsSync(path.join(ROOT, "functions")), "Cloud Functions সম্পূর্ণ remove (functions/ নেই)");
  ok(!existsSync(path.join(ROOT, "src/lib/cloud.ts")), "Cloud Function wrapper (src/lib/cloud.ts) নেই");
  ok(!/httpsCallable|firebase\/functions/.test(readSrc("src/lib/accountDelete.ts"))
    && !/httpsCallable|firebase\/functions/.test(readSrc("src/lib/imgbb.ts")),
    "client-এ কোনো Cloud Function/callable নেই (Auth delete শুধু নিজের, client SDK)");
  const imgbbSrc = readSrc("src/lib/imgbb.ts");
  const imgbbCode = imgbbSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  ok(!/["'][0-9a-f]{32}["']/.test(imgbbCode), "ImgBB key-এর কোনো literal মান source-এ নেই");
  ok(/getRow\(\s*"settings"\s*,\s*"imgbb"\s*\)/.test(imgbbCode),
    "ImgBB key-এর মূল উৎস RTDB `settings/imgbb` (আগের working flow)");
  ok(/https:\/\/api\.imgbb\.com/.test(imgbbCode), "Upload সরাসরি ImgBB-তে (আগের মতোই)");
}

/* ── UI দিয়েই ডিলিট (Donor Management → নির্বাচন → ডিলিট করুন) ── */
{
  seedDb(true);
  const w = makeDom();
  const { default: Admin } = await vite.ssrLoadModule("/src/pages/Admin.tsx");
  const root = ReactDOM.createRoot(w.document.getElementById("root"));
  root.render(React.createElement(Admin));
  await wait(700);
  const lastToast = () => {
    const list = [...w.document.querySelectorAll("#toasts > div")];
    return list.length ? list[list.length - 1].textContent.trim() : "";
  };
  const click = (el) => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const clearToasts = () => {
    const box = w.document.getElementById("toasts");
    if (box) box.innerHTML = "";
  };
  const confirmDelete = async () => {
    for (let i = 0; i < 100 && !w.document.querySelector("#cy"); i += 1) await wait(20);
    clearToasts();
    click(w.document.querySelector("#cy"));
    /* শেষ বার্তা (success/failure) আসা পর্যন্ত অপেক্ষা */
    for (let i = 0; i < 400 && !lastToast(); i += 1) await wait(20);
  };

  w.go("set", "team");
  await wait(200);
  /* একজন নির্বাচন → ডিলিট */
  let box = w.document.querySelector('[data-tsel="CBDC-2026-0001"]');
  ok(!!box, "Donor Management-এ একজন ডোনার নির্বাচন করা যায়");
  box.checked = true;
  box.dispatchEvent(new w.Event("change", { bubbles: true }));
  await wait(120);
  click(w.document.querySelector("#tdel"));
  await confirmDelete();
  ok(lastToast() === "ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে",
    "একজনের success বার্তা: “ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে”", lastToast());
  ok(!has("donors/CBDC-2026-0001") && !has(`users/${DONOR_A}`),
    "UI থেকে ডিলিট করলে RTDB-র সব সংশ্লিষ্ট তথ্য মুছে যায়");

  /* একাধিক নির্বাচন (bulk) → ডিলিট */
  seedDb(true);
  w.go("set", "team");
  await wait(250);
  const boxes = [...w.document.querySelectorAll("[data-tsel]")];
  ok(boxes.length >= 2, "একাধিক ডোনার নির্বাচন করা যায় (bulk)", `${boxes.length} জন`);
  boxes.forEach((b) => {
    b.checked = true;
    b.dispatchEvent(new w.Event("change", { bubbles: true }));
    return undefined;
  });
  await wait(150);
  click(w.document.querySelector("#tdel"));
  await confirmDelete();
  ok(lastToast() === "নির্বাচিত ডোনারদের সম্পূর্ণভাবে মুছে ফেলা হয়েছে",
    "একাধিকের success বার্তা: “নির্বাচিত ডোনারদের সম্পূর্ণভাবে মুছে ফেলা হয়েছে”", lastToast());
  ok(!has("donors/CBDC-2026-0001") && !has("donors/CBDC-2026-0002")
    && !has(`users/${DONOR_A}`) && !has(`users/${DONOR_B}`),
    "bulk delete-এ সব নির্বাচিত ডোনারের সব তথ্য মুছে যায়");
  ok(has("audit/A-1"), "bulk delete-এর পরেও audit লগ অক্ষত");
  /* page reload ছাড়াই live listener দিয়ে তালিকা খালি হয়ে যায় */
  for (let i = 0; i < 200 && w.document.querySelectorAll("[data-tsel]").length; i += 1) await wait(20);
  ok(w.document.querySelectorAll("[data-tsel]").length === 0,
    "reload ছাড়াই donor list realtime-এ খালি হয় (listener দিয়ে)");
  const navCounts = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  w.go("home");
  await wait(150);
  const homeCounts = [...w.document.querySelectorAll("#s-home .astat button b")].map((b) => b.textContent.trim());
  ok(homeCounts.length === 0 || homeCounts[0] === "০",
    "ডেটা মুছে যাওয়ার পর পরিসংখ্যান realtime-এ ০ দেখায় (ভুল লোডিং-০ নয়)", JSON.stringify(homeCounts));
  void navCounts;
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
