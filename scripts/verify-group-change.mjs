/**
 * Verify: Doner Panel-এ রক্তের গ্রুপ সরাসরি পরিবর্তন করা যায় না।
 *
 *  1. অনুমোদিত ডোনারের সেটিংসে "রক্তের গ্রুপ" ক্লিক করলে সরাসরি এডিটরের বদলে
 *     "Change Blood Group Request" sheet খোলে (নতুন গ্রুপ + কারণ + প্রমাণ)।
 *  2. কারণ / প্রমাণ ছাড়া অনুরোধ পাঠানো যায় না, এবং ব্যর্থ চেষ্টায় রক্তের গ্রুপ
 *     অপরিবর্তিত থাকে (Admin Approve-এর আগে পুরোনো গ্রুপই থাকে)।
 *  3. একটি pending অনুরোধ থাকা অবস্থায় নতুন অনুরোধ ফর্ম দেখানো হয় না —
 *     শুধু status (Pending) ও প্রত্যাহারের সুযোগ দেখা যায়।
 *  4. Rejected হলে ফর্মে বাতিলের নোটিশ দেখা যায় (নতুন অনুরোধ পাঠানো যায়)।
 *  5. Admin ও Moderator-এ approve/reject-এর সিদ্ধান্ত users/{uid}/groupChange-এ
 *     লেখার wiring আছে, এবং RTDB rules owner-এর জন্য donors/{id}/bloodGroup lock করে।
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import React from "react";
import ReactDOM from "react-dom/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeDom() {
  const dom = new JSDOM(
    '<!doctype html><html lang="bn"><head></head><body data-dense="0" data-anim="1"><div id="root"></div></body></html>',
    { url: "http://localhost/doner", pretendToBeVisual: true }
  );
  const w = dom.window;
  w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; } }));
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  if (!w.BroadcastChannel) {
    w.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
  }
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  global.window = w;
  global.document = w.document;
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  global.HTMLElement = w.HTMLElement;
  global.Element = w.Element;
  global.Node = w.Node;
  global.SVGElement = w.SVGElement;
  global.getComputedStyle = w.getComputedStyle;
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
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.MutationObserver = w.MutationObserver;
  global.FileReader = w.FileReader;
  global.FormData = w.FormData;
  global.Blob = w.Blob;
  global.DOMParser = w.DOMParser;
  global.XMLSerializer = w.XMLSerializer;
  global.atob = w.atob;
  global.btoa = w.btoa;
  global.BroadcastChannel = w.BroadcastChannel;
  if (!globalThis.crypto) globalThis.crypto = { getRandomValues: (a) => a };
  if (!global.fetch) global.fetch = () => Promise.reject(new Error("fetch unavailable"));
  return dom;
}

const dom = makeDom();
const w = dom.window;

// Pre-seed an APPROVED donor account
const account = {
  uid: "test-user-123",
  name: "রাহাত আলী",
  username: "rahat",
  email: "rahat@test.com",
  phone: "01612345678",
  dob: "1995-03-15",
  gender: "পুরুষ",
  area: "চকবাজার",
  address: "চকবাজার, চট্টগ্রাম",
};
const donor = {
  is: true,
  status: "approved",
  bloodGroup: "A+",
  lastDonation: "",
  health: "",
  whatsapp: "01612345678",
  donorId: "CBDC-2026-0001",
  available: true,
  appliedAt: "2026-01-02",
  groupChange: null,
};
const appState = {
  account,
  donor,
  privacy: { profile: "public", searchable: true, phone: "public" },
  notif: { donor: true, req: true, activity: true, security: true, promo: false },
  prefs: { lang: "bn", theme: "light", badge: true, dense: 0, anim: 1 },
  security: { tfa: false },
  saved: [],
};
w.localStorage.setItem("cbdc.app", JSON.stringify(appState));
w.localStorage.setItem("cbdc.data", JSON.stringify({ donations: [], mine: [], notifs: [], activity: [], incoming: [] }));
w.localStorage.setItem("cbdcMember", "1");
w.localStorage.setItem("cbdcMemberUid", "test-user-123");
w.localStorage.setItem("cbdcMemberName", "রাহাত আলী");

let failed = false;
const errors = [];
w.addEventListener("error", (e) => errors.push("error: " + e.message));
w.addEventListener("unhandledrejection", (e) => errors.push("unhandled: " + String(e && e.reason ? e.reason : e).slice(0, 160)));

const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.ts"),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});

const container = w.document.getElementById("root");
const { default: Page } = await server.ssrLoadModule("/src/pages/Doner.tsx");
const root = ReactDOM.createRoot(container);
root.render(React.createElement(Page));
await new Promise((r) => setTimeout(r, 1500));

const $ = (s) => w.document.querySelector(s);
const $$ = (s) => Array.from(w.document.querySelectorAll(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, extra = "") {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
}
function closeSheet() {
  const x = $(".sheet [data-close]");
  if (x) x.click();
}

// ── 1. settings → donor: the blood group row is locked (no direct editor) ──
w.go("set", "donor");
await sleep(150);
const bgRow = $$("#s-sub button.row[data-act='editBloodGroup']")[0];
check("settings shows the blood group row", !!bgRow);
if (bgRow) {
  bgRow.click();
  await sleep(150);
}
let sheet = $(".sheet");
check("clicking the row opens the change-request sheet", !!sheet && sheet.textContent.includes("রক্তের গ্রুপ পরিবর্তনের অনুরোধ"));
check("sheet is NOT the direct field editor (no #ev select)", !$(".sheet #ev"));
check("request form asks for a new group", !!$(".sheet #gc_to"));
check("request form asks for a reason", !!$(".sheet #gc_reason"));
check("request form asks for proof (report photo)", !!$(".sheet #gc_file"));

// ── 2. reason and proof are mandatory; a failed attempt never changes the group ──
const send = $(".sheet #gc_send");
check("send button exists", !!send);
if (send) {
  // no new group selected
  send.click();
  await sleep(80);
  check("blocked without a new group", !$(".sheet #gc_err").classList.contains("hide"));
  // group but no reason
  $(".sheet #gc_to").value = "B+";
  send.click();
  await sleep(80);
  check("blocked without a reason", $(".sheet #gc_err").textContent.includes("কারণ"));
  // group + reason but no proof file
  $(".sheet #gc_reason").value = "সাম্প্রতিক ল্যাব টেস্টে ভিন্ন গ্রুপ এসেছে";
  send.click();
  await sleep(80);
  check("blocked without proof", $(".sheet #gc_err").textContent.includes("প্রমাণ"));
}
check("blood group unchanged after blocked attempts", w.STORE.donor.bloodGroup === "A+", w.STORE.donor.bloodGroup);
check("no request recorded after blocked attempts", !w.STORE.donor.groupChange);
closeSheet();
await sleep(100);

// ── 3. while a request is Pending no second request can be made ──
w.STORE.donor.groupChange = {
  id: "GC-TEST-1", from: "A+", to: "B+",
  reason: "সাম্প্রতিক ল্যাব টেস্টে ভিন্ন গ্রুপ এসেছে",
  proof: "https://i.ibb.co/xyz/report.jpg", status: "pending",
  at: new Date().toISOString(), note: "",
};
w.renderSub("donor");
await sleep(100);
const bgRow2 = $$("#s-sub button.row[data-act='editBloodGroup']")[0];
check("row shows the pending badge text", !!bgRow2 && bgRow2.textContent.includes("অপেক্ষমাণ"));
if (bgRow2) { bgRow2.click(); await sleep(150); }
sheet = $(".sheet");
check("pending view opens instead of a new form", !!sheet && sheet.textContent.includes("অনুরোধ অপেক্ষমাণ"));
check("pending view has NO send button (single pending request)", !$(".sheet #gc_send"));
check("pending view offers withdrawal", !!$(".sheet #gc_cancel"));
check("pending view shows from → to", sheet && sheet.textContent.includes("A+ → B+"));
check("blood group still the old one while pending", w.STORE.donor.bloodGroup === "A+");
closeSheet();
await sleep(100);

// ── 4. a rejected request shows the rejection note and allows a fresh request ──
w.STORE.donor.groupChange = {
  id: "GC-TEST-1", from: "A+", to: "B+", reason: "x", proof: "",
  status: "rejected", at: new Date().toISOString(), note: "রিপোর্ট অস্পষ্ট",
};
w.renderSub("donor");
await sleep(100);
const bgRow3 = $$("#s-sub button.row[data-act='editBloodGroup']")[0];
if (bgRow3) { bgRow3.click(); await sleep(150); }
sheet = $(".sheet");
check("rejected: form opens again for a fresh request", !!$(".sheet #gc_send"));
check("rejected: rejection notice with the admin note", sheet && sheet.textContent.includes("বাতিল") && sheet.textContent.includes("রিপোর্ট অস্পষ্ট"));
closeSheet();

// ── 5. static wiring: Admin/Moderator decisions + RTDB rules lock ──
const adminSrc = readFileSync(path.join(ROOT, "src/pages/Admin.tsx"), "utf8");
const modSrc = readFileSync(path.join(ROOT, "src/pages/Moderator.tsx"), "utf8");
for (const [name, src] of [["Admin", adminSrc], ["Moderator", modSrc]]) {
  check(`${name}: approve writes groupChange status`, src.includes('markGroupChangeStatus(q.ownerUid,"approved"'));
  check(`${name}: reject writes groupChange status`, src.includes('markGroupChangeStatus(owner,"rejected"'));
  check(`${name}: approve updates users/{uid} blood group`, src.includes("updateRow(NODES.users, q.ownerUid, {bloodGroup:q.to"));
  check(`${name}: approve updates donors/{id} blood group`, src.includes("bloodGroup:q.to, group:q.to"));
}
const rules = JSON.parse(readFileSync(path.join(ROOT, "database.rules.json"), "utf8"));
const validate = String(rules.rules.donors["$id"][".validate"] || "");
check("rules: owner cannot change donors/{id}/bloodGroup", validate.includes("newData.child('bloodGroup').val() === data.child('bloodGroup').val()"));

// ── 6. the donor panel patch never carries bloodGroup ──
const mod = await server.ssrLoadModule("/src/pages/Doner.tsx");
const p = mod.donorPublicPatch(account, w.STORE.donor);
check("donorPublicPatch never contains bloodGroup", !Object.prototype.hasOwnProperty.call(p, "bloodGroup"));

if (errors.length) {
  console.log("runtime errors:", errors.slice(0, 5).join("\n  "));
  failed = true;
}

await server.close();
console.log(failed ? "\nVERIFY FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
