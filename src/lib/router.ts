/**
 * CBDC — একক-পৃষ্ঠা অ্যাপের পেজ নেভিগেশন (single index.html)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  আগে অ্যাপটির চারটি আলাদা HTML entry ছিল (index / doner / admin /
 *  moderator.html)। এখন React + TypeScript + Vite-এর একটিই entry আছে —
 *  `index.html`। `src/main.tsx` বুটের সময় `resolveBootPage()` বলে কোন React
 *  পেজ (Home / Doner / Admin / Moderator) মাউন্ট হবে, আর পেজ বদলাতে
 *  `navigateToPage()` ব্যবহার করা হয়।
 *
 *  প্যানেলগুলো নিজেদের ভেতরে `#home`, `#find/...` ধরনের hash-route ব্যবহার
 *  করে — পেজ-পর্যায়ের hint সেগুলোর সঙ্গে সংঘর্ষ না করতে সবসময় `#/...` আকারে
 *  রাখা হয়: "#/doner", "#/admin", "#/moderator", "#/home"।
 *
 *  নেভিগেশনের ব্রাউজার Back/Forward বোতাম স্বাভাবিক রাখতে প্রতিটি history
 *  entry-তে সেই পেজের নাম `history.state.cbdcPage`-এ ট্যাগ করা হয় — ফলে
 *  Back চাপলে সত্যিই আগের পেজে ফেরা যায় (শুধু sessionStorage-ভিত্তিক state
 *  হলে Back আবার আগের পেজেই ফিরিয়ে নিয়ে আসত)।
 *
 *  পুরোনো ভাগ করা লিংক (যেমন `/doner.html?uid=…` পাবলিক প্রোফাইল) যেন না ভাঙে
 *  সেগুলোও boot hint হিসেবে চেনা হয়।
 */

export type PageName = "home" | "doner" | "admin" | "moderator";

const SESSION_KEY = "cbdc.page";
const PAGES: readonly PageName[] = ["home", "doner", "admin", "moderator"] as const;

function isPage(v: unknown): v is PageName {
  return typeof v === "string" && (PAGES as readonly string[]).includes(v);
}

/** "#/doner" আকারের পেজ-হ্যাশ চেনে। প্যানেলগুলোর অভ্যন্তরীণ "#find" ইত্যাদিকে উপেক্ষা করে। */
function pageFromHash(hash: string): PageName | null {
  const h = (hash || "").toLowerCase();
  const m = h.match(/^#\/(home|doner|admin|moderator)$/);
  return m ? (m[1] as PageName) : null;
}

/** পুরোনো/বাইরের URL: "/doner.html", "/admin", "/moderator/" ইত্যাদি চেনে। */
function pageFromPath(pathname: string): PageName | null {
  const p = (pathname || "").toLowerCase();
  const m = p.match(/\/(doner|admin|moderator)(\.html)?\/?$/);
  return m ? (m[1] as PageName) : null;
}

/** শেষ নির্বাচিত পেজ — sessionStorage-এ রাখা হয় (redirect/reload বেঁচে যায়)। */
export function currentPage(): PageName {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (isPage(v)) return v;
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
 *   ১. pathname হিন্ট (/doner.html, /admin …) — legacy / deep link
 *   ২. `?uid=…` — পাবলিক ডোনার প্রোফাইল সবসময় Doner অ্যাপে খোলে
 *   ৩. hash হিন্ট (#/doner …)
 *   ৪. history.state.cbdcPage — একই entry-র Back/Forward/reload
 *   ৫. sessionStorage-এ শেষবারের পেজ (Google redirect-ফেরত/নতুন ট্যাব resume)
 *   ৬. home
 */
export function resolveBootPage(): PageName {
  let page: PageName | null = null;
  try {
    page = pageFromPath(window.location.pathname);
    if (!page) {
      const uid = new URLSearchParams(window.location.search).get("uid");
      if (uid) page = "doner";
    }
    if (!page) page = pageFromHash(window.location.hash);
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
 * একটি পরিষ্কার full load (URL-এ জঞ্জাল ছাড়াই)। এতে প্রতিটি পেজ ঠিক আগের মতোই
 * নতুন করে boot হয় — প্যানেলগুলোর অভ্যন্তরীণ hash-route, লিসেনার, স্টেট সব
 * আগের আচরণ বজায় রাখে।
 */
export function navigateToPage(page: PageName): void {
  if (!isPage(page)) page = "home";
  const previous = currentPage();
  const u = new URL(window.location.href);
  u.search = ""; // ?uid=… ইত্যাদি পরিষ্কার — না হলে পুরোনো হিন্ট আটকে থাকবে
  u.hash = "";
  // legacy পেজ-ফাইলনাম বা পেজ-পাথ থাকলে সরিয়ে রুটে ফেরো (না হলে boot hint আবার আগের পেজে নিয়ে যাবে)
  u.pathname = u.pathname.replace(/(index|doner|admin|moderator)\.html\/?$/i, "");
  u.pathname = u.pathname.replace(/\/(home|doner|admin|moderator)\/?$/i, "/");
  if (!u.pathname.endsWith("/")) u.pathname = u.pathname + "/";
  if (page === previous && u.toString() === window.location.href) return;
  // এই (বর্তমান) entry-টি আগের পেজ হিসেবে ট্যাগ করা আছে; নতুন entry নতুন পেজে boot হবে
  tagHistory(previous);
  try {
    sessionStorage.setItem(SESSION_KEY, page);
  } catch {
    /* ignore */
  }
  window.location.assign(u.toString());
}

/** "#/doner" আকারের লিংকে ক্লিক করলে পেজ বদলের সমর্থন (একই ট্যাবে)। */
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
