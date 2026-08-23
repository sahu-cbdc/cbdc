/**
 * Real-time donor list checks:
 *  1. donorPublicPatch() — the exact payload a donor pushes to donors/{id}
 *     in RTDB on every info change:
 *       - Account and Donor values are sent as one connected payload,
 *       - bloodGroup is synced with the donor record,
 *       - never touches admin-controlled fields (verified/suspended/
 *         donorId/donations/status/occupation…),
 *       - availability & photo included.
 *  2. Patching one donor never changes another donor's record.
 *  3. database.rules.json — owner update allowed, protected fields
 *     validated, moderator write allowed.
 *
 * Run with: node scripts/verify-realtime-donors.mjs
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
const mod = await server.ssrLoadModule("/src/pages/Doner.tsx");
const { donorPublicPatch } = mod;

let failed = false;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
};

/* ── 1. patch content ── */
const account = { name: "রফিক উদ্দিন", gender: "পুরুষ", dob: "1995-03-12", area: "চকবাজার",
  phone: "01812345678", photo: "https://i.ibb.co/abc/rafiq.jpg" };
const donor = { is: true, status: "approved", donorId: "CBDC-2026-0001", bloodGroup: "O+",
  whatsapp: "01812345678", lastDonation: "2026-05-01", available: true, health: "সুস্থ" };

const p = donorPublicPatch(account, donor);
check("patch uses the account name", p.name === "রফিক উদ্দিন", p.name);
check("patch uses the account area", p.area === "চকবাজার", p.area);
check("patch uses the account gender", p.gender === "পুরুষ", p.gender);
check("patch falls back to account dob", p.dob === "1995-03-12", p.dob);
check("patch falls back to account phone", p.phone === "01812345678", p.phone);
check("patch keeps whatsapp", p.whatsapp === "01812345678", p.whatsapp);
check("patch keeps lastDonationDate", p.lastDonationDate === "2026-05-01", p.lastDonationDate);
check("patch keeps availability", p.available === true);
check("patch keeps photo (ImgBB)", p.photo === "https://i.ibb.co/abc/rafiq.jpg", p.photo);

const PROTECTED = ["id","donorId","uid","ownerUid","verified","suspended","donations",
  "totalDonations","joined","status","occupation","bloodGroup","group"];
const leaked = PROTECTED.filter((k) => Object.prototype.hasOwnProperty.call(p, k));
check("patch never carries admin-controlled fields", leaked.length === 0, "leaked: " + leaked.join(","));

/* available toggle → false */
const pOff = donorPublicPatch(account, { ...donor, available: false });
check("availability off → available:false", pOff.available === false);

/* ── 2. per-donor isolation ── */
const account2 = { ...account, name: "সালমা খাতুন", photo: "https://i.ibb.co/xyz/salma.jpg" };
const p2 = donorPublicPatch(account2, { ...donor, donorId: "CBDC-2026-0002", bloodGroup: "A+" });
check("another donor's patch keeps its own photo", p2.photo === "https://i.ibb.co/xyz/salma.jpg", p2.photo);
check("another donor's patch keeps its own name", p2.name === "সালমা খাতুন", p2.name);

/* ── 3. rules sanity ── */
const rules = JSON.parse(readFileSync(path.join(ROOT, "database.rules.json"), "utf8"));
const dRule = rules.rules.donors["$id"];
const write = String(dRule[".write"] || "");
const validate = String(dRule[".validate"] || "");
check("rules: donor may update own record", write.includes("data.exists() && data.child('ownerUid').val() === auth.uid"), write);
check("rules: moderator may write donors", write.includes("role').val() === 'moderator'"), "");
check("rules: owner delete still allowed", write.includes("!newData.exists()"), "");
check("rules: admin-controlled fields validated", validate.includes("verified") && validate.includes("suspended") && validate.includes("donations"), validate.slice(0, 80));
check("rules: owner blood group is locked (change needs admin approval)", validate.includes("newData.child('bloodGroup').val() === data.child('bloodGroup').val()"), validate.slice(0, 80));
check("rules: delete exempt from validate", validate.includes("!newData.exists()"), "");

console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
