/**
 * Verify: Main Website "রক্তদাতার তালিকা" and Doner Panel "রক্তদাতা খুঁজুন"
 * both render the SAME donor list — একটাই data source (Firebase Realtime
 * Database `donors` node), একটাই live listener chain, কোনো আলাদা/hardcoded
 * list নেই, এবং একই donor দু-জায়গায় একই তথ্য দেখায় (availability সহ)।
 *
 * Covers:
 *  1. Single source — উভয় পেজই `window.CBDCShared` (src/lib/store.ts) থেকে
 *     donors পড়ে, RTDB `donors` node থেকে `watchList` (onValue) দিয়ে লাইভ।
 *  2. No seed / hardcoded list — fresh state-এ donors খালি।
 *  3. Same donor, same fields — `toDonerDonor` (Doner panel) raw donor-এর
 *     name / bloodGroup / area / phone / lastDonation / photo / available /
 *     suspended ঠিক তেমনই ম্যাপ করে যেমন Home raw donor থেকে পড়ে।
 *  4. Real-time — উভয় পেজ `CBDCShared.subscribe` করে এবং list re-render করে।
 *  5. Availability parity — `available:false` দুই জায়গাতেই সমানভাবে ধরা পড়ে।
 *
 * Run with: node scripts/verify-shared-donors.mjs
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
const mod = await server.ssrLoadModule("/src/lib/store.ts");
const store = (mod && (mod.default || mod.store)) || mod;
const S = store.store && typeof store.store === "object" ? store.store : store;

let failed = false;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
};

const homeSrc = readFileSync(path.join(ROOT, "src/pages/Home.tsx"), "utf8");
const donerSrc = readFileSync(path.join(ROOT, "src/pages/Doner.tsx"), "utf8");
const storeSrc = readFileSync(path.join(ROOT, "src/lib/store.ts"), "utf8");

/* ── 1. single RTDB source + live listener (store) ── */
check("store imports watchList (onValue live listener)", /from\s+["']\.\/rtdb["']/.test(storeSrc) && storeSrc.includes("watchList"), "");
check("store imports NODES from firebase", /from\s+["']\.\/firebase["']/.test(storeSrc) && storeSrc.includes("NODES"), "");
check("store watches each collection via watchList", storeSrc.includes("watchList((NODES as any)[name] || name"), "");
check("donors is one of the watched collections", storeSrc.includes('"donors"') && storeSrc.includes("COLLECTION_NAMES"), "");

/* ── 2. no seed / hardcoded list ── */
check("store fresh() starts donors empty (no seed)", /donors:\s*\[\]/.test(storeSrc), "");
check("store filters donors to approved only", storeSrc.includes('donors: (rows) => rows.filter((r) => (r.status || "approved") === "approved")'), "");
check("no demo/mock donor objects in store", !/donors:\s*\[\s*\{/.test(storeSrc), "");

/* ── 3. both pages read donors from the SAME shared store ── */
check("Home getDonors reads from CBDCShared.load()", homeSrc.includes("CBDCShared.load()") && /s\s*&&\s*s\.donors\.length\s*\?/.test(homeSrc), "");
check("Doner pullSharedPublic reads st.donors from CBDCShared.load()", donerSrc.includes("const st=CBDCShared.load()") && donerSrc.includes("RAW.donors=st.donors.filter"), "");
check("Doner maps donors through CBDCShared.toDonerDonor", donerSrc.includes("CBDCShared.toDonerDonor"), "");

/* ── 4. real-time: both subscribe and re-render the list ── */
check("Home subscribes to shared store (live re-render)", /CBDCShared\.subscribe\s*\(\(\)\s*=>\s*\{\s*renderPublic\(\)/.test(homeSrc), "");
check("Home renderPublic re-renders donor search", homeSrc.includes("function renderPublic(){ renderStats();renderSearch();renderBoard();") || /renderPublic\(\)\s*\{\s*renderStats\(\);renderSearch\(\)/.test(homeSrc), "");
check("Doner subscribes to shared store", /CBDCShared\.subscribe\s*\(\(st,\s*meta\)\s*=>\s*\{/.test(donerSrc), "");
check("Doner subscription re-pulls shared donors", /CBDCShared\.subscribe\s*\(\(st,\s*meta\)\s*=>\s*\{[\s\S]{0,200}?pullSharedPublic\(\)/.test(donerSrc), "");

/* ── 5. availability parity (the same donor shows the same availability) ── */
check("Home canDonate honours available", /available\s*!==\s*false/.test(homeSrc) && homeSrc.includes("canDonate"), "");
check("Doner find honours available", /d\.available\s*!==\s*false/.test(donerSrc), "");
check("Doner fromPublic maps available", donerSrc.includes("available:r.available!==false"), "");

/* ── 6. functional: same raw donor → same fields in both views ── */
const raw = {
  id: "CBDC-2026-0001", donorId: "CBDC-2026-0001", ownerUid: "u-aaa",
  name: "রফিক উদ্দিন", bloodGroup: "O+", gender: "পুরুষ", dob: "1995-03-12",
  area: "চকবাজার", phone: "01812345678", whatsapp: "01812345678",
  lastDonationDate: "2026-05-01", available: false, suspended: false,
  photo: "https://i.ibb.co/abc/rafiq.jpg", status: "approved",
};

// Home renders the raw donor directly (publicDonors → getDonors → store.load()).
// Doner renders `toDonerDonor(raw)`. They must carry identical values for the
// fields both lists display.
const d = S.toDonerDonor(raw);

const parity = [
  ["name", raw.name, d.name],
  ["bloodGroup → group", raw.bloodGroup, d.group],
  ["area", raw.area, d.area],
  ["phone", raw.phone, d.phone],
  ["lastDonationDate → lastDonation", raw.lastDonationDate, d.lastDonation],
  ["photo", raw.photo, d.photo],
];
for (const [label, homeVal, donerVal] of parity) {
  check(`same donor, same ${label}`, homeVal === donerVal, `Home=${homeVal} Doner=${donerVal}`);
}

check("toDonerDonor maps available:false", d.available === false, String(d.available));
check("toDonerDonor maps suspended", d.suspended === false, String(d.suspended));
check("toDonerDonor available defaults true", S.toDonerDonor({ ...raw, available: undefined }).available === true, "");
check("toDonerDonor suspended true", S.toDonerDonor({ ...raw, suspended: true }).suspended === true, "");

/* different donor keeps its own data (no cross-donor bleed) */
const raw2 = { ...raw, id: "CBDC-2026-0002", donorId: "CBDC-2026-0002", ownerUid: "u-bbb",
  name: "সালমা খাতুন", bloodGroup: "A+", area: "বাকলিয়া", available: true, photo: "https://i.ibb.co/xyz/salma.jpg" };
const d2 = S.toDonerDonor(raw2);
check("second donor keeps own name", d2.name === "সালমা খাতুন", d2.name);
check("second donor keeps own photo", d2.photo === "https://i.ibb.co/xyz/salma.jpg", d2.photo);
check("second donor available:true", d2.available === true, String(d2.available));
check("no cross-donor bleed", d.name === "রফিক উদ্দিন" && d.photo === "https://i.ibb.co/abc/rafiq.jpg", "");

/* ── 7. canonical `toPublicDonor` mapping (Home-এর master mapping) ── */
const pd = S.toPublicDonor(raw);
check("toPublicDonor normalizes bloodGroup", pd.bloodGroup === "O+", String(pd.bloodGroup));
check("toPublicDonor alias group === bloodGroup", pd.group === "O+", String(pd.group));
check("toPublicDonor normalizes lastDonationDate", pd.lastDonationDate === "2026-05-01", String(pd.lastDonationDate));
check("toPublicDonor normalizes photo (photo||photoURL)", pd.photo === "https://i.ibb.co/abc/rafiq.jpg", String(pd.photo));
check("toPublicDonor maps available", pd.available === false, String(pd.available));
check("toPublicDonor maps suspended", pd.suspended === false, String(pd.suspended));
check("toPublicDonor normalizes donations", pd.donations === 0, String(pd.donations));

/* legacy-shape fallbacks: bloodGroup as `group`, photo as `photoURL`, last as `last` */
const legacy = { id: "X", name: "লিগ্যাসি", group: "AB+", last: "2026-01-01", photoURL: "https://i.ibb.co/legacy.jpg", donations: 2 };
const pl = S.toPublicDonor(legacy);
check("toPublicDonor falls back group→bloodGroup", pl.bloodGroup === "AB+", String(pl.bloodGroup));
check("toPublicDonor falls back last→lastDonationDate", pl.lastDonationDate === "2026-01-01", String(pl.lastDonationDate));
check("toPublicDonor falls back photoURL→photo", pl.photo === "https://i.ibb.co/legacy.jpg", String(pl.photo));
check("toPublicDonor normalizes donations from totalDonations", S.toPublicDonor({ id: "Y", totalDonations: 3 }).donations === 3, "");

/* ── 8. Home consumes the canonical mapping; card/profile show photo + group ── */
check("Home getDonors maps through toPublicDonor", homeSrc.includes("CBDCShared.toPublicDonor"), "");
check("Home donor card renders profile photo (.donor-photo)", homeSrc.includes('class="donor-photo"'), "");
check("Home profile uses donor photo (photo||avatar)", homeSrc.includes("v.photo || avatarData(v.gender)"), "");
check("Home profileViewOf exposes photo + group fallback", homeSrc.includes("photo: donorPhoto(d)") && homeSrc.includes("group: d.bloodGroup || d.group || \"\""), "");

/* ── 9. donor self-save must MERGE, not replace the public record ── */
check("Doner pushDonorRecordToRtdb uses updateRow (merge), not updatePaths",
  /await\s+updateRow\s*\(\s*NODES\.donors,\s*id,\s*donorPublicPatch\(STORE\.account,STORE\.donor\)\s*\)/.test(donerSrc),
  "public donors record must keep admin fields (bloodGroup/status/ownerUid) on donor save");

/* ── 10. এক shared donor-card engine (QR + vCard + PNG) — দুই জায়গাতেই ── */
const cardSrc = readFileSync(path.join(ROOT, "src/lib/donorCard.ts"), "utf8");
check("shared donorCard module exists (QR + vCard + PNG engine)", cardSrc.includes("downloadDonorCardPng") && cardSrc.includes("donorVCard") && cardSrc.includes("function qrSVG"), "");
check("Home imports the shared download engine", homeSrc.includes('import { downloadDonorCardPng, donorCardStatus } from "../lib/donorCard"'), "");
check("Doner imports the shared engine (qrSVG + download)", donerSrc.includes('import { qrSVG, downloadDonorCardPng } from "../lib/donorCard"'), "");
check("Doner dlCard delegates to shared downloadDonorCardPng", donerSrc.includes("await downloadDonorCardPng({"), "");
check("Home profile download uses shared engine (no separate logic)", homeSrc.includes("downloadDonorCardPng({") && homeSrc.includes("donorCardStatus(subject)"), "");
check("no old canvas-based download logic left in Home", !homeSrc.includes("window.downloadDonorCard = async function"), "");
/* ── 11. Home profile markup = Doner Panel-এর rProfile structure ── */
check("Home profile uses Doner-style pcard/phead2/pav/pgrp", homeSrc.includes("class=\"pcard\"") && homeSrc.includes("class=\"phead2\"") && homeSrc.includes("class=\"pav\"") && homeSrc.includes("class=\"pgrp\""), "");
check("Home profile info section uses .sec-t + .card.pad0 + .row (Doner-style)", homeSrc.includes("class=\"sec-t\"") && homeSrc.includes("class=\"card pad0\"") && homeSrc.includes("class=\"row\""), "");
check("Home profile download button = data-pa=\"dl\" (Doner-style)", homeSrc.includes('data-pa="dl"') && homeSrc.includes("কার্ড ডাউনলোড"), "");
check("Home profile stats = Doner-style pstat (মোট রক্তদান / জীবন / শেষ রক্তদান)", homeSrc.includes("মোট রক্তদান") && homeSrc.includes("জীবন বাঁচাতে সাহায্য") && homeSrc.includes("শেষ রক্তদান"), "");
check("Home profile shows donor photo in .pav", homeSrc.includes("v.photo || avatarData(v.gender)"), "");
check("Home profile fallback age uses resolveAge (dob-derived)", homeSrc.includes("age: resolveAge(d)"), "");

console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
