

export type PageName = "home" | "doner" | "admin" | "moderator";

const SESSION_KEY = "cbdc.page";
const PAGES: readonly PageName[] = ["home", "doner", "admin", "moderator"] as const;


const HOME_VIEWS = [
  "login",
  "dashboard",
  "signup",
  "forgot-password",
  "reset-password",
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


function computeBase(): string {
  let p = "/";
  try {
    p = window.location.pathname || "/";
  } catch {
    return "/";
  }
  const m = p.match(
    /^(.*?)(?:\/(doner|admin|moderator|login|dashboard|signup|forgot-password|reset-password|create-account|register|emergency|eligibility|donor-search|gallery|about|profile|home)(?:\.html)?(?:\/.*)?)$/i
  );
  let base = m ? m[1] : p;
  if (!base.endsWith("/")) base += "/";
  if (!base.startsWith("/")) base = "/" + base;
  return base;
}

const BASE = computeBase();


export function appBase(): string {
  return BASE;
}


export function pagePath(page: PageName): string {
  return page === "home" ? BASE : BASE + page;
}


export function screenPath(page: Exclude<PageName, "home">, id?: string, sub?: string): string {
  let p = pagePath(page);
  if (id) p += "/" + id;
  if (sub) p += "/" + sub;
  return p;
}


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


function pageFromHash(hash: string): PageName | null {
  const h = (hash || "").toLowerCase();
  const m = h.match(/^#\/(home|doner|admin|moderator)$/);
  return m ? (m[1] as PageName) : null;
}


function pageFromPath(pathname: string): PageName | null {
  const p = (pathname || "").toLowerCase();
  const m = p.match(/\/(doner|admin|moderator)(?:\.html)?(?:\/|$)/i);
  return m ? (m[1] as PageName) : null;
}


function isHomeViewPath(pathname: string): boolean {
  const p = (pathname || "").toLowerCase();
  const m = p.match(new RegExp("/(" + HOME_VIEWS.join("|") + ")(?:/|$)", "i"));
  return !!m;
}


export function currentPage(): PageName {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (isPage(v)) return v as PageName;
  } catch {
    
  }
  return "home";
}


function tagHistory(page: PageName): void {
  try {
    const state = { ...(window.history.state || {}), cbdcPage: page };
    window.history.replaceState(state, "");
  } catch {
    
  }
}


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
        
        try {
          window.history.replaceState(null, "", pagePath(fromHash) + window.location.search);
        } catch {
          
        }
      }
    }
    if (!page && window.history.state && isPage(window.history.state.cbdcPage)) {
      page = window.history.state.cbdcPage;
    }
  } catch {
    
  }
  if (!page) {
    
    
    
    const path = window.location.pathname || "/";
    const atBase = path === BASE || (BASE.endsWith("/") && path + "/" === BASE);
    const plainRoot = atBase && !window.location.hash && !new URLSearchParams(window.location.search).get("uid");
    page = plainRoot ? "home" : currentPage();
  }
  try {
    sessionStorage.setItem(SESSION_KEY, page);
  } catch {
    
  }
  tagHistory(page);
  return page;
}


export function navigateToPage(page: PageName): void {
  if (!isPage(page)) page = "home";
  const previous = currentPage();
  const targetPath = pagePath(page);
  tagHistory(previous);
  try {
    sessionStorage.setItem(SESSION_KEY, page);
  } catch {
    
  }
  if (page === previous && window.location.pathname === targetPath && !window.location.search && !pageFromHash(window.location.hash)) {
    return;
  }
  window.location.assign(targetPath);
}


if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    try {
      const target = pageFromHash(window.location.hash);
      if (target && target !== currentPage()) navigateToPage(target);
    } catch {
      
    }
  });
}
