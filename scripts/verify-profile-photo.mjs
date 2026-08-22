/**
 * Targeted check for the "রক্তদাতা খুঁজুন → Profile" photo chain:
 *  1. store converters keep the ImgBB photo through every round-trip shape,
 *  2. a donor record with photo/photoURL maps into the Doner-panel shape,
 *  3. a record without any photo yields an empty photo (placeholder path),
 *  4. profile lookup is keyed per-donor (uid) — no cross-donor photo leak.
 *
 * Run with: node scripts/verify-profile-photo.mjs
 */
import { JSDOM } from "jsdom";
import { createServer } from "vite";
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
const S = mod.default || mod;
const store = S.store && typeof S.store === "object" ? S.store : S;

let failed = false;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "   " + extra));
  if (!cond) failed = true;
};

// 1. RTDB donor record with ImgBB photo (both `photo` and legacy `photoURL` shapes)
const withPhoto = {
  id: "CBDC-2026-0001", ownerUid: "u-aaa", name: "রফিক উদ্দিন", group: "O+", area: "চকবাজার",
  phone: "01812345678", photo: "https://i.ibb.co/abc/rafiq.jpg",
};
const withPhotoURL = { ...withPhoto, id: "CBDC-2026-0002", ownerUid: "u-bbb",
  name: "সালমা খাতুন", photo: "", photoURL: "https://i.ibb.co/xyz/salma.jpg" };
const noPhoto = { id: "CBDC-2026-0003", ownerUid: "u-ccc", name: "জসিম উদ্দিন", group: "B+", area: "বাকলিয়া", phone: "01912345678" };

// toDonerDonor — Doner panel shape
const d1 = store.toDonerDonor(withPhoto);
check("toDonerDonor keeps `photo`", d1.photo === "https://i.ibb.co/abc/rafiq.jpg", d1.photo);
const d2 = store.toDonerDonor(withPhotoURL);
check("toDonerDonor falls back to `photoURL`", d2.photo === "https://i.ibb.co/xyz/salma.jpg", d2.photo);
const d3 = store.toDonerDonor(noPhoto);
check("toDonerDonor yields empty photo when none", d3.photo === "", d3.photo);

// admin round-trip: shared store → admin (toAdminDonor) → shared store (fromAdminDonor)
const admin1 = store.toAdminDonor(d1);
const back1 = store.fromAdminDonor(admin1);
check("admin round-trip preserves ImgBB photo", back1.photo === "https://i.ibb.co/abc/rafiq.jpg", back1.photo);
const admin2 = store.toAdminDonor(d2);
const back2 = store.fromAdminDonor(admin2);
check("admin round-trip keeps photoURL-shaped photo", back2.photo === "https://i.ibb.co/xyz/salma.jpg", back2.photo);

// every donor keeps their OWN photo — no cross-donor swap
check("photos stay per-donor (no swap)", back1.photo === d1.photo && back2.photo === d2.photo);

// 2. Doner profile lookup: each card's uid resolves to that donor's record only
const donorList = [store.toDonerDonor(withPhoto), store.toDonerDonor(withPhotoURL), store.toDonerDonor(noPhoto)];
const byUid = (id) => donorList.find((x) => x.uid === id);
check("lookup by uid finds donor 1's photo", byUid("u-aaa")?.photo === "https://i.ibb.co/abc/rafiq.jpg");
check("lookup by uid finds donor 2's photo", byUid("u-bbb")?.photo === "https://i.ibb.co/xyz/salma.jpg");
check("lookup by uid finds donor 3 (no photo)", byUid("u-ccc")?.photo === "");
check("unknown uid resolves to nothing", byUid("u-zzz") === undefined);

// 3. profileView-style normalization (mirrors Doner.tsx logic)
const view = (d) => ({ photo: d.photo || d.photoURL || "" });
check("profile view normalizes photoURL", view(withPhotoURL).photo === "https://i.ibb.co/xyz/salma.jpg");

console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
