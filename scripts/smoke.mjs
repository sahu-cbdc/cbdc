/**
 * CBDC — smoke test (jsdom-based, no real browser needed)
 *
 * Renders each of the four pages (Home / Doner / Admin / Moderator) in a
 * jsdom document through Vite's SSR module loader, runs the page's ported
 * logic (`initPage` inside a `useEffect`), and reports:
 *   - how much dynamic HTML the page produced
 *   - whether key elements are present
 *   - any runtime errors thrown during init
 *
 * Run with:  npm run smoke
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
    { url: "http://localhost/", pretendToBeVisual: true }
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
  if (!w.BroadcastChannel) {
    w.BroadcastChannel = class {
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
      close() {}
    };
  }
  w.HTMLCanvasElement.prototype.getContext = function () {
    return null;
  };

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
  if (!globalThis.crypto) globalThis.crypto = { getRandomValues: (a) => a };
  if (!global.fetch) global.fetch = () => Promise.reject(new Error("fetch unavailable"));

  return dom;
}

const pages = [
  ["/src/pages/Home.tsx", "Home", ["view-home", "donorResults", "emergencyBoard", "toasts", "mainNav", "statDonors", "loginForm", "signupForm", "registerForm", "emergencyForm", "eligibilityForm"]],
  ["/src/pages/Doner.tsx", "Doner", ["top", "s-home", "s-find", "s-req", "s-set", "s-sub", "bnav", "toasts"]],
  ["/src/pages/Admin.tsx", "Admin", ["top", "s-home", "s-work", "s-people", "s-set", "s-sub", "bnav", "toasts"]],
  ["/src/pages/Moderator.tsx", "Moderator", ["top", "s-home", "s-work", "s-people", "s-set", "s-sub", "bnav", "toasts"]],
];

let failed = false;

for (const [mod, name, ids] of pages) {
  const dom = makeDom();
  const w = dom.window;
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, "vite.config.ts"),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    logLevel: "silent",
  });
  const container = w.document.getElementById("root");
  const errs = [];
  const onErr = (e) => errs.push("error: " + e.message);
  const onRej = (e) => errs.push("unhandled: " + String(e && e.reason ? e.reason : e).slice(0, 140));
  w.addEventListener("error", onErr);
  w.addEventListener("unhandledrejection", onRej);
  let html = "";
  try {
    const { default: Page } = await server.ssrLoadModule(mod);
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(Page));
    await new Promise((r) => setTimeout(r, 1500));
    html = container.innerHTML;
    await new Promise((r) => setTimeout(r, 400));
  } catch (e) {
    errs.push("THREW: " + String(e && e.message ? e.message : e).slice(0, 200));
  }
  const missing = ids.filter((id) => !w.document.getElementById(id));
  const ok = html.length > 5000 && missing.length === 0 && errs.length === 0;
  if (!ok) failed = true;
  console.log(`\n${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log("   rendered HTML length:", html.length);
  if (missing.length) console.log("   missing ids:", missing.join(", "));
  if (errs.length) console.log("   errors:", errs.slice(0, 6).join("\n           "));
  await server.close();
}

console.log(failed ? "\nSMOKE TEST FAILED" : "\nALL PAGES PASSED");
process.exit(failed ? 1 : 0);
