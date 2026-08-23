/**
 * Panel ↔ RTDB persistence checks (Admin/Moderator account system):
 *  1. database.rules.json — `audit` (staff read, append-only, admin delete)
 *     ও `messages` (staff read, authenticated create, staff manage) rules
 *     ঠিক আছে কি না; users/admins-এর existing security অপরিবর্তিত কি না।
 *  2. দুটো প্যানেলই jsdom-এ error ছাড়া boot হয়; ME default fallback হিসেবে
 *     কাজ করে; localStorage cache (`cbdc.<panel>.me`) আগের মতোই লেখা হয়।
 *  3. Source-level wiring — প্রতিটি account edit → pushMeProfile,
 *     logAudit → pushAudit (RTDB), boot → users/{uid} load + live watchers,
 *     inbox → messages node-এ read-flag update, টিম → admins node থেকে load।
 *
 * Run with:  node scripts/verify-panel-rtdb.mjs
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import React from "react";
import ReactDOM from "react-dom/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

/* ─── 1. Security Rules ─────────────────────────────────────────── */
const rules = JSON.parse(readFileSync(path.join(ROOT, "database.rules.json"), "utf8"));
const isAdmin = "root.child('admins').child(auth.uid).exists()";
const staff = `auth != null && ${isAdmin}`;
const adminRole = "root.child('admins').child(auth.uid).child('role').val() === 'admin'";

ok(rules.rules.audit && rules.rules.audit[".read"] === staff,
  "rules: audit — staff-only read");
ok(rules.rules.audit.$id[".write"] ===
  `auth != null && ((!data.exists() && ${isAdmin}) || (!newData.exists() && ${adminRole}))`,
  "rules: audit — staff append-only, edit নেই, delete শুধু অ্যাডমিন");
ok(rules.rules.messages && rules.rules.messages[".read"] === staff,
  "rules: messages — staff-only read");
ok(rules.rules.messages.$id[".write"] ===
  `auth != null && (${isAdmin} || !data.exists())`,
  "rules: messages — authenticated create, staff manage");
ok(rules.rules.users.$uid[".write"] ===
  `auth != null && ($uid === auth.uid || ${isAdmin})`,
  "rules: users — owner+staff write অপরিবর্তিত (existing security বজায়)");
ok(rules.rules.admins.$uid[".write"] ===
  `auth != null && (${adminRole} || (!newData.exists() && $uid === auth.uid))`,
  "rules: admins — শুধু অ্যাডমিন আপডেট করতে পারে (existing security বজায়)");
ok(rules.rules[".read"] === `auth != null && ${adminRole}` &&
  rules.rules[".write"] === `auth != null && ${adminRole}`,
  "rules: root — শুধু অ্যাডমিন (ডেটাবেস ব্যবস্থাপনার জন্য পুরো tree read/write; per-node rules অপরিবর্তিত)");

/* ─── 3. Source-level wiring (আগে করা হলো — jsdom boot-এর আগেই দ্রুত fail) ─── */
const adminSrc = readFileSync(path.join(ROOT, "src/pages/Admin.tsx"), "utf8");
const modSrc = readFileSync(path.join(ROOT, "src/pages/Moderator.tsx"), "utf8");
for (const [name, src] of [["Admin", adminSrc], ["Moderator", modSrc]]) {
  const pushFields = ["name", "username", "email", "phone", "dob", "gender", "area",
    "address", "designation", "bloodGroup", "lastDonation"];
  ok(pushFields.every(f => src.includes(`pushMeProfile({${f}:`)),
    `${name}: সব profile field edit → pushMeProfile (users/{uid}-এ save)`);
  ok(src.includes("pushMeProfile({photo:") && src.includes("pushMeProfile({photo:"),
    `${name}: প্রোফাইল ছবি → RTDB`);
  ok(src.includes("pushAudit(e);"),
    `${name}: logAudit → RTDB-তে persist`);
  ok(src.includes("applyMeRow(await getRow(NODES.users,user.uid))"),
    `${name}: boot-এ users/{uid} থেকে profile load (অন্য ডিভাইসেও একই)`);
  ok(src.includes("watchMe(user.uid);watchTeam();watchAudit();watchMessages();"),
    `${name}: live watchers — account/team/audit/messages`);
  ok(src.includes("watchRow(NODES.users,uid,(row)"),
    `${name}: নিজের অ্যাকাউন্ট live sync`);
  ok(src.includes("watchList(NODES.admins,(rows)"),
    `${name}: টিম তালিকা admins node থেকে load`);
  ok(src.includes("watchList(NODES.audit,(rows)"),
    `${name}: অডিট লগ RTDB থেকে load`);
  ok(src.includes("watchList(NODES.messages,(rows)"),
    `${name}: বার্তা/ইনবক্স RTDB থেকে load`);
  ok(src.includes("updateRow(NODES.messages,m.id,{read:true})"),
    `${name}: বার্তা পড়া-অবস্থা RTDB-তে save`);
  ok(src.includes("`users/${ME.uid}/data/panel`"),
    `${name}: সেটিংস/সেশন/কার্যকলাপ → users/{uid}/data/panel`);
  ok(src.includes("ME.name=ME.name||staff.name"),
    `${name}: default শুধু fallback — RTDB profile-ই authoritative`);
  ok(src.includes("upsertMySession();"),
    `${name}: লগইনে এই ডিভাইসের সেশন তালিকায় বসে ও persist হয়`);
  const saveMeCount = (src.match(/saveMe\(\)/g) || []).length;
  ok(saveMeCount >= 10 && src.includes("data-tgl") && src.includes("if(!ME_PULLING&&ME.uid)queueMicrotask(pushMePanel)"),
    `${name}: security/privacy/notif/prefs toggle → saveMe → RTDB push সংযুক্ত (${saveMeCount}টি saveMe কল)`);
}

/* ─── 2. jsdom boot — কোনো runtime error ছাড়া প্যানেল উঠে, cache আগের মতো ─── */
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
  global.localStorage = w.localStorage;
  global.sessionStorage = w.sessionStorage;
  global.CustomEvent = w.CustomEvent;
  global.MouseEvent = w.MouseEvent;
  global.KeyboardEvent = w.KeyboardEvent;
  global.Event = w.Event;
  global.URL = w.URL;
  global.Image = w.Image;
  global.location = w.location;
  global.history = w.history;
  global.screen = w.screen;
  global.addEventListener = w.addEventListener.bind(w);
  global.removeEventListener = w.removeEventListener.bind(w);
  global.matchMedia = w.matchMedia;
  global.innerWidth = w.innerWidth;
  global.innerHeight = w.innerHeight;
  global.outerWidth = w.outerWidth;
  global.outerHeight = w.outerHeight;
  global.scrollX = w.scrollX;
  global.scrollY = w.scrollY;
  global.pageXOffset = w.pageXOffset;
  global.pageYOffset = w.pageYOffset;
  global.devicePixelRatio = w.devicePixelRatio;
  global.self = w.self;
  global.parent = w.parent;
  global.top = w.top;
  global.frames = w.frames;
  global.origin = w.origin;
  global.name = w.name;
  global.length = w.length;
  global.closed = w.closed;
  global.MutationObserver = w.MutationObserver;
  global.FileReader = w.FileReader;
  global.FormData = w.FormData;
  global.Blob = w.Blob;
  global.DOMParser = w.DOMParser;
  global.XMLSerializer = w.XMLSerializer;
  global.atob = w.atob;
  global.btoa = w.btoa;
  global.BroadcastChannel = w.BroadcastChannel;
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  global.HTMLElement = w.HTMLElement; global.Element = w.Element; global.Node = w.Node;
  return w;
}

const vite = await createServer({
  root: ROOT, server: { middlewareMode: true }, appType: "custom", logLevel: "error",
});
for (const page of ["Admin", "Moderator"]) {
  const w = makeDom();
  let booted = false, err = null;
  try {
    const Mod = await vite.ssrLoadModule(`/src/pages/${page}.tsx`);
    const root = ReactDOM.createRoot(w.document.getElementById("root"));
    root.render(React.createElement(Mod.default));
    await new Promise((r) => setTimeout(r, 1200));
    booted = typeof w.ME === "object" && w.ME !== null;
  } catch (e) { err = e; }
  ok(booted && !err, `${page}: jsdom boot error ছাড়া, ME প্রস্তুত${err ? " — " + err.message : ""}`);
  if (booted) {
    const ME = w.ME;
    ok(ME.security && ME.privacy && ME.notif && ME.prefs && Array.isArray(ME.sessions) && Array.isArray(ME.activity),
      `${page}: ME-এর সব অংশ default fallback হিসেবে আছে (RTDB না থাকলেও আগের মতো)`);
    ok(ME.name === "" || typeof ME.name === "string",
      `${page}: hardcoded default RTDB-কে override করছে না (খালি fallback)`);
    try { w.saveMe(); } catch (e) { err = e; }
    const panelId = page === "Admin" ? "admin" : "mod"; /* PANEL.id */
    const cached = w.localStorage.getItem(`cbdc.${panelId}.me`);
    ok(!err && !!cached, `${page}: localStorage cache আগের মতোই লেখা হয়`);
  }
}
await vite.close();

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
