/**
 * Verify: Doner Panel "রক্তদাতা হিসেবে যুক্ত হন" button now navigates to the
 * full Donor application page (screen "become") instead of a bottom sheet,
 * and submitting the form puts the application into Pending state.
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import React from "react";
import ReactDOM from "react-dom/client";
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

// Pre-seed a logged-in account that is NOT yet a donor
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
  is: false,
  status: "none",
  bloodGroup: "",
  lastDonation: "",
  health: "",
  whatsapp: "",
  donorId: "",
  available: true,
  appliedAt: "",
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
// Mark as member so boot keeps the panel instead of redirecting (Firebase not reachable in jsdom anyway)
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

function check(name, cond) {
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
  if (!cond) failed = true;
}

// 1. The home screen shows the "রক্তদাতা হিসেবে নিবন্ধিত নন" text WITHOUT "(Not Registered)"
const statusCard = $$("#s-home .card").find((c) => c.textContent.includes("রক্তদাতা হিসেবে নিবন্ধিত"));
check("home status card shows 'রক্তদাতা হিসেবে নিবন্ধিত নন'", !!statusCard);
check("'(Not Registered)' removed from status card", !!statusCard && !statusCard.textContent.includes("(Not Registered)"));

// 2. Find the become button and click it
const becomeBtn = $$("#s-home button[data-act='become']").find((b) => b.textContent.includes("যুক্ত হন"));
check("become button exists on home", !!becomeBtn);
if (becomeBtn) {
  becomeBtn.click();
  await new Promise((r) => setTimeout(r, 200));
}

// 3. After click we should be on the full "become" page, not a sheet
const sheet = $(".sheet");
check("clicking 'যুক্ত হন' does NOT open a bottom sheet", !sheet);
const becomeScreen = $("#s-become");
check("become screen exists", !!becomeScreen);
check("become screen is active after click", !!becomeScreen && becomeScreen.classList.contains("on"));
check("application form rendered on the page", !!$("#becomeForm"));
check("submit button says 'রক্তদাতা হিসেবে আবেদন জমা দিন'", $("#bc_save") && $("#bc_save").textContent.includes("আবেদন জমা দিন"));

// 4. Required fields present
const needFields = ["bc_name", "bc_gender", "bc_dob", "bc_area", "bc_phone", "bc_group", "bc_ok"];
check("all required form fields present", needFields.every((id) => $(`#${id}`)));

// 5. Submit empty form -> validation blocks it
$("#becomeForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 100));
check("empty submit is blocked by validation", !!$("#becomeForm .is-invalid"));

// 6. Fill the form correctly and submit
$("#bc_name").value = "রাহাত আলী";
$("#bc_gender").value = "পুরুষ";
$("#bc_dob").value = "1995-03-15";
$("#bc_area").value = "চকবাজার";
$("#bc_phone").value = "01612345678";
$("#bc_group").value = "A+";
$("#bc_last").value = "";
$("#bc_wa").value = "";
$("#bc_ok").checked = true;
$("#becomeForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 300));

const invalid = $$("#becomeForm .is-invalid").map((el) => el.id || el.name);
console.log("  DEBUG invalid fields after submit:", invalid.join(",") || "(none)");
console.log("  DEBUG bc_phone value:", JSON.stringify($("#bc_phone") && $("#bc_phone").value));
console.log("  DEBUG bc_phone error:", (() => { const w = $("#bc_phone") && $("#bc_phone").closest(".f"); return w ? (w.querySelector(".field-error") || {}).textContent : "n/a"; })());
console.log("  DEBUG donor after submit:", JSON.stringify(w.STORE && w.STORE.donor ? { status: w.STORE.donor.status, is: w.STORE.donor.is, donorId: w.STORE.donor.donorId, appliedAt: w.STORE.donor.appliedAt } : null));
console.log("  DEBUG active screen:", $$(".scr.on").map((s) => s.id).join(","));

check("donor.status is 'pending' after submit", w.STORE && w.STORE.donor.status === "pending");
check("donor.is is true after submit", w.STORE && w.STORE.donor.is === true);
check("donorId is empty while pending", w.STORE && w.STORE.donor.donorId === "");
check("appliedAt set after submit", w.STORE && !!w.STORE.donor.appliedAt);
check("after submit user lands on the request screen", $("#s-req") && $("#s-req").classList.contains("on"));

// 7. The "রক্তদাতা হন" tab now shows the pending status (যাচাই করা হচ্ছে)
check("request screen shows pending status after submit", $("#rbody") && $("#rbody").textContent.includes("যাচাই করা হচ্ছে"));

// 8. Re-opening the become page while pending shows the status card (not the form again)
w.go("become");
await new Promise((r) => setTimeout(r, 100));
check("pending user sees status instead of duplicate form", $("#s-become").classList.contains("on") && !$("#becomeForm") && $("#s-become").textContent.includes("যাচাই করা হচ্ছে"));
check("pending user can withdraw the application", $("#s-become") && !!$("#s-become").querySelector('[data-act="withdraw"]'));

// ── Scenario 2: already-approved donor sees the approved status page ──
w.STORE.donor.is = true;
w.STORE.donor.status = "approved";
w.STORE.donor.donorId = "CBDC-2026-0001";
w.STORE.donor.bloodGroup = "A+";
w.STORE.donor.lastDonation = "2026-05-01";
w.STORE.donor.whatsapp = "01612345678";
w.STORE.donor.health = "সুস্থ";
w.STORE.donor.appliedAt = "2026-01-02";
w.go("become");
await new Promise((r) => setTimeout(r, 100));
check("approved donor sees approval status on become page", $("#s-become").textContent.includes("অনুমোদিত রক্তদাতা"));
check("approved donor sees donor ID", $("#s-become").textContent.includes("CBDC-2026-0001"));
check("approved donor gets edit/profile actions", !!$("#s-become").querySelector('[data-sub="donor"]') && !!$("#hprof"));

if (errors.length) {
  console.log("runtime errors:", errors.slice(0, 5).join("\n  "));
  failed = true;
}

await server.close();
console.log(failed ? "\nVERIFY FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
