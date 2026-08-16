/**
 * CBDC — একক-পৃষ্ঠা অ্যাপের পেজ নেভিগেশন (single index.html, hash-বিহীন clean URL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  আগে অ্যাপটির চারটি আলাদা HTML entry ছিল (index / doner / admin /
 *  moderator.html)। এখন React + TypeScript + Vite-এর একটিই entry আছে —
 *  `index.html`। সব লিংক পরিষ্কার path-ভিত্তিক (কোনো `#` নেই):
 *
 *      /                    → হোম / পাবলিক সাইট
 *      /doner               → ডোনার প্যানেল
 *      /admin               → অ্যাডমিন প্যানেল
 *      /moderator           → মডারেটর প্যানেল
 *      /signup, /login …    → হোমপেজের ভেতরের ভিউ (Home.tsx)
 *      /profile/<id>        → পাবলিক ডোনার প্রোফাইল ভিউ
 *      /?uid=<id>           → ডোনার কার্ড মোড (Doner অ্যাপ)
 *
 *  পুরোনো লিংকও ধরা হয়: /doner.html, /doner.html?uid=…, #/doner, #dashboard
 *  ইত্যাদি — এগুলো পেজে ঢুকে স্বয়ংক্রিয়ভাবে clean URL-এ রূপান্তরিত হয়।
 *
 *  Deploy নোট: যেকোনো পাথে index.html পরিবেশন করতে হবে (SPA fallback) —
 *  firebase.json-এর rewrite ও wrangler.jsonc-এর not_found_handling এটা যথেষ্ট।
 */

export type PageName = "home" | "doner" | "admin" | "moderator";

const SESSION_KEY = "cbdc.page";
const PAGES: readonly PageName[] = ["home", "doner", "admin", "moderator"] as const;

/** হোমপেজের ভেতরের ভিউ পাথ (Home.tsx এইগুলো নিজে ধরে)। */
const HOME_VIEWS = [
  "login",
  "dashboard",
  "signup",
  "create-account",
  "register",
  "emergency",
  "eligibility",
  "donor-search",
  "gallery",
  "about",
  "profile",
  "home",
] as const;

function isPage(v: unknown): v is PageName {
  return typeof v === "string" && (PAGES as readonly string[]).includes(v);
}

/* ────────────────────────────────────────────────────────────────
   appBase — সাইট যে ডিরেক্টরিতে হোস্ট করা, সেই বেস পাথ।
   যেমন: root deploy → "/", sub-directory deploy → "/cbdc/"
   ──────────────────────────────────────────────────────────────── */
function computeBase(): string {
  let p = "/";
  try {
    p = window.location.pathname || "/";
  } catch {
    return "/";
  }
  const m = p.match(
    /^(.*?)(?:\/(doner|admin|moderator|login|dashboard|signup|create-account|register|emergency|eligibility|donor-search|gallery|about|profile|home)(?:\.html)?(?:\/.*)?)$/i
  );
  let base = m ? m[1] : p;
  if (!base.endsWith("/")) base += "/";
  if (!base.startsWith("/")) base = "/" + base;
  return base;
}

const BASE = computeBase();

/** সাইটের বেস পাথ — "/" বা "/cbdc/" আকারে। */
export function appBase(): string {
  return BASE;
}

/** একটি পেজের clean path — যেমন pagePath("admin") → "/admin" (বেসসহ)। */
export function pagePath(page: PageName): string {
  return page === "home" ? BASE : BASE + page;
}

/** একটি প্যানেলের ভেতরের স্ক্রিন পাথ — যেমন pageUrl("doner","find","profile")। */
export function screenPath(page: Exclude<PageName, "home">, id?: string, sub?: string): string {
  let p = pagePath(page);
  if (id) p += "/" + id;
  if (sub) p += "/" + sub;
  return p;
}

/** বর্তমান URL-এ প্যাটে প্যানেলের ভেতরের অংশ ("find/profile") — না থাকলে ""。 */
export function panelSubPath(page: Exclude<PageName, "home">): string {
  let p = "";
  try {
    p = window.location.pathname || "";
  } catch {
    return "";
  }
  const m = p.toLowerCase().match(new RegExp("(?:^|/)(" + page + ")(?:\\.html)?(?:/(.*))?$", "i"));
  if (!m) return "";
  return (m[2] || "").replace(/\/+$/, "");
}

/** "#/doner" আকারের পুরোনো পেজ-হ্যাশ চেনে (পুরোনো লিংক ভাঙবে না — compat)। */
function pageFromHash(hash: string): PageName | null {
  const h = (hash || "").toLowerCase();
  const m = h.match(/^#\/(home|doner|admin|moderator)$/);
  return m ? (m[1] as PageName) : null;
}

/** pathname থেকে পেজ হিন্ট: "/doner", "/admin/x", "/doner.html" ইত্যাদি। */
function pageFromPath(pathname: string): PageName | null {
  const p = (pathname || "").toLowerCase();
  const m = p.match(/\/(doner|admin|moderator)(?:\.html)?(?:\/|$)/i);
  return m ? (m[1] as PageName) : null;
}

/** pathname-এ হোমপেজের ভেতরের ভিউ হিন্ট আছে কিনা ("/signup", "/profile/x")। */
function isHomeViewPath(pathname: string): boolean {
  const p = (pathname || "").toLowerCase();
  const m = p.match(new RegExp("/(" + HOME_VIEWS.join("|") + ")(?:/|$)", "i"));
  return !!m;
}

/** শেষ নির্বাচিত পেজ — sessionStorage-এ রাখা হয় (redirect/reload বেঁচে যায়)। */
export function currentPage(): PageName {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (isPage(v)) return v as PageName;
  } catch {
    /* private mode ইত্যাদি */
  }
  return "home";
}

/** বর্তমান history entry-তে পেজের নাম ট্যাগ করো (Back/Forward ঠিক রাখতে)। */
function tagHistory(page: PageName): void {
  try {
    const state = { ...(window.history.state || {}), cbdcPage: page };
    window.history.replaceState(state, "");
  } catch {
    /* ignore */
  }
}

/**
 * বুটের সময় কোন পেজ দেখানো হবে। অগ্রাধিকারক্রম:
 *   ১. pathname-এ প্যানেল হিন্ট (/doner, /admin …) — legacy / deep link
 *   ২. `?uid=…` — পাবলিক ডোনার কার্ড সবসময় Doner অ্যাপে খোলে
 *   ৩. pathname-এ হোম-ভিউ হিন্ট (/signup, /profile/x) → home
 *   ৪. পুরোনো hash হিন্ট (#/doner …) → ঐ পেজে, এবং URL clean করে দেওয়া হয়
 *   ৫. history.state.cbdcPage — Back/Forward/reload
 *   ৬. sessionStorage-এ শেষবারের পেজ (Google redirect-ফেরত resume)
 *   ৭. home
 */
export function resolveBootPage(): PageName {
  let page: PageName | null = null;
  try {
    page = pageFromPath(window.location.pathname);
    if (!page) {
      const uid = new URLSearchParams(window.location.search).get("uid");
      if (uid) page = "doner";
    }
    if (!page && isHomeViewPath(window.location.pathname)) page = "home";
    if (!page) {
      const fromHash = pageFromHash(window.location.hash);
      if (fromHash) {
        page = fromHash;
        // পুরোনো hash-লিংক — অ্যাড্রেস বার clean রাখতে path URL-এ বদলে দিই
        try {
          window.history.replaceState(null, "", pagePath(fromHash) + window.location.search);
        } catch {
          /* ignore */
        }
      }
    }
    if (!page && window.history.state && isPage(window.history.state.cbdcPage)) {
      page = window.history.state.cbdcPage;
    }
  } catch {
    /* ignore */
  }
  if (!page) page = currentPage();
  try {
    sessionStorage.setItem(SESSION_KEY, page);
  } catch {
    /* ignore */
  }
  tagHistory(page);
  return page;
}

/**
 * অন্য পেজে যাও — আগের multi-page `location.href="doner.html"`-এর সমতুল্য
 * একটি পরিষ্কার full load (clean path URL, কোনো `#` থাকে না)। এতে প্রতিটি পেজ
 * ঠিক আগের মতোই নতুন করে boot হয় — প্যানেলগুলোর অভ্যন্তরীণ routing, লিসেনার,
 * স্টেট সব আগের আচরণ বজায় রাখে।
 */
export function navigateToPage(page: PageName): void {
  if (!isPage(page)) page = "home";
  const previous = currentPage();
  const targetPath = pagePath(page);
  tagHistory(previous);
  try {
    sessionStorage.setItem(SESSION_KEY, page);
  } catch {
    /* ignore */
  }
  if (page === previous && window.location.pathname === targetPath && !window.location.search && !pageFromHash(window.location.hash)) {
    return;
  }
  window.location.assign(targetPath);
}

/** পুরোনো "#/doner" লিংকে ক্লিক করলে পেজ বদলের সমর্থন (compat — নতুন লিংকে "#" নেই)। */
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    try {
      const target = pageFromHash(window.location.hash);
      if (target && target !== currentPage()) navigateToPage(target);
    } catch {
      /* ignore */
    }
  });
}
