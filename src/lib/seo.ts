/**
 * CBDC - SEO helper for SPA
 * Primary domain: https://chawkbazarbloodclub.com
 * Dynamic title, description, canonical, OG tags per route
 */

export interface SeoData {
  title: string;
  description: string;
  keywords?: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
}

// PRIMARY DOMAIN - as per user correction
const SITE_URL = "https://chawkbazarbloodclub.com";
const SITE_NAME = "চকবাজার ব্লাড ডোনার'স ক্লাব | CBDC";

// Core keywords - kept short, Google ignores meta keywords for ranking
const BASE_KEYWORDS = "চকবাজার ব্লাড ডোনার'স ক্লাব, CBDC, Chawkbazar Blood Donor's Club, চট্টগ্রাম ব্লাড ডোনার, blood donor chittagong";

export const SEO_ROUTES: Record<string, SeoData> = {
  home: {
    title: "চকবাজার ব্লাড ডোনার'স ক্লাব | CBDC - চট্টগ্রামে রক্তদাতা খুঁজুন",
    description: "চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) - চট্টগ্রামের স্বেচ্ছাসেবী রক্তদাতা সংগঠন। চকবাজার, বাকলিয়া, কোতোয়ালি সহ ২৪টি এলাকায় ভেরিফাইড রক্তদাতা খুঁজুন, নিবন্ধন করুন ও জরুরি রক্তের আবেদন করুন।",
    keywords: BASE_KEYWORDS + ", চট্টগ্রামে রক্তদাতা খুঁজুন, রক্ত দিন জীবন বাঁচান",
    canonical: `${SITE_URL}/`,
  },
  "donor-search": {
    title: "রক্তদাতা খুঁজুন - চট্টগ্রাম | CBDC চকবাজার ব্লাড ডোনার'স ক্লাব",
    description: "চট্টগ্রামে A+, B+, O+, AB+ সহ সকল গ্রুপের ভেরিফাইড রক্তদাতা খুঁজুন। চকবাজার, বাকলিয়া, কোতোয়ালি সহ ২৪টি এলাকায় রক্তদাতা তালিকা - CBDC।",
    keywords: "রক্তদাতা খুঁজুন, চট্টগ্রাম রক্তদাতা তালিকা, blood donor search chittagong",
    canonical: `${SITE_URL}/donor-search`,
  },
  register: {
    title: "রক্তদাতা নিবন্ধন - ডোনার হিসেবে যোগ দিন | CBDC",
    description: "চকবাজার ব্লাড ডোনার'স ক্লাবে রক্তদাতা হিসেবে নিবন্ধন করুন। চট্টগ্রামে মানবতার সেবায় যোগ দিন - CBDC।",
    keywords: "রক্তদাতা নিবন্ধন, CBDC registration, chittagong blood donor registration",
    canonical: `${SITE_URL}/register`,
  },
  emergency: {
    title: "জরুরি রক্তের আবেদন - ২৪ ঘণ্টা সহায়তা | CBDC",
    description: "জরুরি রক্তের প্রয়োজনে এখনই আবেদন করুন। চকবাজার ব্লাড ডোনার'স ক্লাব ২৪ ঘণ্টা জরুরি রক্ত সহায়তা দেয় - CBDC।",
    keywords: "জরুরি রক্তের আবেদন, emergency blood request chittagong, CBDC emergency",
    canonical: `${SITE_URL}/emergency`,
  },
  eligibility: {
    title: "রক্তদানের যোগ্যতা যাচাই - আমি কি রক্ত দিতে পারব? | CBDC",
    description: "রক্তদানের আগে যোগ্যতা যাচাই করুন। বয়স, শেষ রক্তদানের সময় ও স্বাস্থ্য পরীক্ষা - চকবাজার ব্লাড ডোনার'স ক্লাব CBDC।",
    keywords: "রক্তদানের যোগ্যতা, blood donation eligibility",
    canonical: `${SITE_URL}/eligibility`,
  },
  about: {
    title: "আমাদের সম্পর্কে - চকবাজার ব্লাড ডোনার'স ক্লাব CBDC",
    description: "চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) - চট্টগ্রামের স্বেচ্ছাসেবী রক্তদাতা সংগঠন। মানবতার সেবায় আমরা রক্তদাতা - রক্ত দিন, জীবন বাঁচান।",
    keywords: "CBDC সম্পর্কে, Chawkbazar Blood Donor's Club about",
    canonical: `${SITE_URL}/about`,
  },
  login: {
    title: "লগইন - চকবাজার ব্লাড ডোনার'স ক্লাব | CBDC Login",
    description: "CBDC অ্যাকাউন্টে লগইন করুন - চকবাজার ব্লাড ডোনার'স ক্লাব ডোনার প্যানেল।",
    canonical: `${SITE_URL}/login`,
  },
  signup: {
    title: "অ্যাকাউন্ট তৈরি - CBDC | Sign Up",
    description: "চকবাজার ব্লাড ডোনার'স ক্লাবে নতুন অ্যাকাউন্ট তৈরি করুন - CBDC।",
    canonical: `${SITE_URL}/signup`,
  },
  profile: {
    title: "রক্তদাতা প্রোফাইল - CBDC | Blood Donor Profile Chittagong",
    description: "চট্টগ্রামের ভেরিফাইড রক্তদাতার প্রোফাইল দেখুন - চকবাজার ব্লাড ডোনার'স ক্লাব CBDC।",
    canonical: `${SITE_URL}/profile/`,
  },
  "forgot-password": {
    title: "পাসওয়ার্ড রিসেট - CBDC | Forgot Password",
    description: "CBDC অ্যাকাউন্টের পাসওয়ার্ড ভুলে গেছেন? রিসেট লিংক পাঠান।",
    canonical: `${SITE_URL}/forgot-password`,
  },
};

function setMeta(name: string, content: string, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function updateSEO(route: string, extra?: Partial<SeoData>) {
  const key = route.toLowerCase().replace(/^\//, "").split("/")[0] || "home";
  const data = SEO_ROUTES[key] || SEO_ROUTES["home"];
  const final: SeoData = { ...data, ...extra };

  if (final.title) {
    document.title = final.title;
    setMeta("title", final.title);
    setMeta("og:title", final.ogTitle || final.title, true);
    setMeta("twitter:title", final.ogTitle || final.title);
  }

  if (final.description) {
    setMeta("description", final.description);
    setMeta("og:description", final.ogDescription || final.description, true);
    setMeta("twitter:description", final.ogDescription || final.description);
  }

  if (final.keywords) {
    setMeta("keywords", final.keywords);
  }

  if (final.canonical) {
    setLink("canonical", final.canonical);
    setMeta("og:url", final.canonical, true);
    setMeta("twitter:url", final.canonical);
  }
}

export function initSEO() {
  const path = window.location.pathname;
  const segment = path.split("/").filter(Boolean)[0] || "home";
  updateSEO(segment);

  window.addEventListener("popstate", () => {
    const seg = window.location.pathname.split("/").filter(Boolean)[0] || "home";
    updateSEO(seg);
  });

  const origPush = history.pushState;
  const origReplace = history.replaceState;
  const notify = () => {
    const seg = window.location.pathname.split("/").filter(Boolean)[0] || "home";
    setTimeout(() => updateSEO(seg), 50);
  };
  history.pushState = function (...args) {
    // @ts-ignore
    const ret = origPush.apply(this, args);
    notify();
    return ret;
  } as any;
  history.replaceState = function (...args) {
    // @ts-ignore
    const ret = origReplace.apply(this, args);
    notify();
    return ret;
  } as any;

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace(/^#\/?/, "").split("/")[0] || "home";
    if (h) updateSEO(h);
  });
}

export function updateProfileSEO(donorName: string, bloodGroup: string, area: string, donorId: string) {
  const title = `${donorName} (${bloodGroup}) - ${area} | রক্তদাতা প্রোফাইল - CBDC`;
  const desc = `${donorName}, রক্তের গ্রুপ ${bloodGroup}, এলাকা ${area} - চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) এর ভেরিফাইড রক্তদাতা।`;
  updateSEO("profile", {
    title,
    description: desc,
    canonical: `${SITE_URL}/profile/${encodeURIComponent(donorId)}`,
    ogTitle: title,
    ogDescription: desc,
  });
}
