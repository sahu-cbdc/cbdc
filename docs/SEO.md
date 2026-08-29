# 🔍 CBDC SEO Audit & Guide — https://chawkbazarbloodclub.com

> **Primary Domain:** `https://chawkbazarbloodclub.com` — এটাই Google Search Console, Sitemap, Canonical সব জায়গায় ব্যবহার করতে হবে। `cbdc-a9418.web.app` শুধু Firebase-এর default URL, SEO-এর জন্য primary নয়।

---

## ✅ Audit — বর্তমানে কী ঠিক আছে, কী ভুল ছিল

### ভুল ছিল (এখন ঠিক করা হয়েছে)

1. **Domain ভুল ছিল:** আগের commit-এ সব জায়গায় `https://cbdc-a9418.web.app` ব্যবহার করা হয়েছিল। এখন সব `https://chawkbazarbloodclub.com` এ পরিবর্তন করা হয়েছে:
   - `index.html` canonical, og:url, twitter:url, JSON-LD @id/url
   - `public/robots.txt` Sitemap + Host
   - `public/sitemap.xml` সব loc
   - `src/lib/seo.ts` SITE_URL
   - `src/config/site.ts` website

2. **Sitemap live-এ HTML দেখাচ্ছিল:** `https://chawkbazarbloodclub.com/sitemap.xml` fetch করলে index.html আসছিল — কারণ আগের deploy-এ `sitemap.xml` dist-এ ছিল না, SPA fallback index.html serve করছিল। এখন `public/sitemap.xml` নিশ্চিতভাবে dist-এ copy হবে, `vite build` এর পর `dist/sitemap.xml` আছে কিনা যাচাই করা হয়েছে।

3. **robots.txt Cloudflare Managed override:** Live `robots.txt` দেখাচ্ছে `BEGIN Cloudflare Managed content` — মানে Cloudflare Dashboard-এ **Managed robots.txt** ON আছে। এটা OFF করতে হবে, না হলে custom robots.txt serve হবে না।  
   **Fix:** Cloudflare Dashboard → chawkbazarbloodclub.com → Security → Bots → Configure → Managed robots.txt OFF.

4. **Keyword meta tag অতিরঞ্জন:** ২৫+ keyword দেওয়া হয়েছিল, বলা হয়েছিল এটা সবচেয়ে গুরুত্বপূর্ণ — এটা সঠিক নয়। Google meta keywords ranking-এ ব্যবহার করে না। এখন keywords ছোট করা হয়েছে (৬-৮টি core), এবং ডকুমেন্টেশনে সঠিক priority বলা হয়েছে।

5. **১০ গুণ দ্রুত ranking দাবি ভুল:** `cbdcbd.org` নিলে ১০ গুণ দ্রুত rank হবে — এটা ভুল। Custom domain branding/trust-এর জন্য ভালো, কিন্তু ranking শুধু domain বদলালে ১০ গুণ বাড়ে না। এখন `chawkbazarbloodclub.com` ই primary, নতুন domain নেওয়ার দরকার নেই।

6. **৩–১৪ দিনে index guarantee ভুল:** Google কখন crawl/index করবে তার নির্দিষ্ট সময় নেই — কয়েক দিন, সপ্তাহ বা তারও বেশি লাগতে পারে। এখন guarantee না দিয়ে বাস্তব expectation লেখা হয়েছে।

7. **React SPA = Google বোঝে না — অতিরঞ্জন:** Google JavaScript render করতে পারে, কিন্তু গুরুত্বপূর্ণ content initial HTML-এ না থাকলে বা route ঠিকভাবে configured না থাকলে সমস্যা হতে পারে। এখন SPA জন্য `updateSEO()` + `initSEO()` রাখা হয়েছে, কিন্তু ভুল ব্যাখ্যা সরানো হয়েছে।

### যা ঠিক আছে (Keep)

- **Title & Description:** এখন concise — Title ~65 chars, Description ~155 chars, বাংলা + ইংরেজি + এলাকা
- **Canonical & hreflang:** `https://chawkbazarbloodclub.com/` — সঠিক
- **OG + Twitter:** image, title, description — সঠিক
- **Structured Data:** NGO, WebSite + SearchAction, BreadcrumbList — valid, primary domain ব্যবহার করে
- **noscript fallback:** crawler-এর জন্য crawlable content + internal links — ভালো
- **firebase.json headers:** security + cache — ভালো
- **_headers file:** Cloudflare Workers-এর জন্য Content-Type + Cache-Control — নতুন যোগ করা হয়েছে
- **SPA dynamic SEO:** `src/lib/seo.ts` — route change-এ title/description/canonical update — ভালো, তবে অতিরঞ্জিত দাবি ছাড়া

---

## 🔧 বর্তমান ফাইলগুলো (Primary Domain সহ)

- `index.html` — canonical `https://chawkbazarbloodclub.com/`, OG/Twitter, JSON-LD সব primary domain
- `public/robots.txt` — Allow /, Disallow /admin /moderator /doner, Sitemap `https://chawkbazarbloodclub.com/sitemap.xml`
- `public/sitemap.xml` — 8 URL, সব `https://chawkbazarbloodclub.com/...`
- `public/manifest.json` — PWA, shortcuts
- `public/_headers` — Cloudflare Workers headers (sitemap.xml = application/xml, robots.txt = text/plain)
- `src/lib/seo.ts` — SITE_URL = `https://chawkbazarbloodclub.com`
- `src/config/site.ts` — website = `https://chawkbazarbloodclub.com`
- `src/main.tsx` — initSEO + private panels noindex
- `src/pages/Home.tsx` — showView → updateSEO, renderProfile → updateProfileSEO

---

## 🚀 এখন কী করতে হবে (সঠিক গাইড)

### ১. Cloudflare Dashboard — Managed robots.txt OFF
- Dashboard → chawkbazarbloodclub.com → Security → Bots → Managed robots.txt **OFF**
- না হলে তোমার custom `public/robots.txt` live-এ দেখাবে না

### ২. Google Search Console — সঠিক property
- https://search.google.com/search-console
- **Domain property** বা **URL prefix** হিসেবে `https://chawkbazarbloodclub.com/` যোগ করো (web.app নয়)
- Verification: DNS TXT বা HTML file (Cloudflare DNS হলে TXT সহজ)
- Sitemaps → `sitemap.xml` submit (full URL নয়, শুধু `sitemap.xml` লিখলেই হবে, কারণ property ইতিমধ্যে `chawkbazarbloodclub.com`)
- URL Inspection → `/`, `/donor-search`, `/register`, `/emergency`, `/about` — Request Indexing (একবারে ১-২টি, spam নয়)

### ৩. Indexing Expectation — সঠিক
- Submit করার পর Google কয়েক দিন থেকে কয়েক সপ্তাহের মধ্যে crawl করে — নির্দিষ্ট ৩–১৪ দিন guarantee নেই
- `site:chawkbazarbloodclub.com` দিয়ে চেক করতে পারো index হয়েছে কিনা
- Search Console → Pages → Indexing report দেখো

### ৪. Content SEO — আসল গুরুত্বপূর্ণ
Google এখন যেগুলো দেখে:
- **Title:** প্রতি পেজে unique, 50–65 chars, brand + keyword (এখন ঠিক আছে)
- **Meta description:** 120–160 chars, actionable (এখন ঠিক আছে)
- **H1/H2:** প্রতি পেজে ১টি H1, keyword সহ। Hero-তে `রক্ত দিন, জীবন বাঁচান` আছে — About section-এ H2 হিসেবে `চকবাজার ব্লাড ডোনার'স ক্লাব` আছে, ভালো
- **Crawlable content:** noscript + visible text — আছে
- **Internal links:** Home → donor-search, register, emergency, about — আছে
- **Sitemap:** আছে, এখন primary domain
- **Structured data:** NGO + WebSite SearchAction + Breadcrumb — আছে
- **Page speed:** preconnect আছে, logo.png compress + WebP হলে আরও ভালো হবে
- **Mobile usability:** responsive — আছে, Search Console Mobile Usability চেক করো

### ৫. Backlinks & Local SEO
- Facebook Page/Group Bio তে `https://chawkbazarbloodclub.com` লিংক (এখনো web.app থাকলে বদলাও)
- Google Business Profile: `Chawkbazar Blood Donor's Club - CBDC` নামে, category Blood bank / Non-profit, address Chawkbazar, phone, website `https://chawkbazarbloodclub.com`
- Local directories / blood donor lists এ listing

### ৬. Firebase authDomain — পরিবর্তন করবে না
- `authDomain` SEO-এর সাথে সম্পর্কিত নয় — `chokbazarbloodclub-69d5f.firebaseapp.com` ই থাকবে
- SEO শুধু hosting domain নিয়ে

---

## 🔑 Target Keywords (বাস্তবসম্মত)

**Primary:**
- চকবাজার ব্লাড ডোনার'স ক্লাব
- CBDC
- Chawkbazar Blood Donor's Club
- chawkbazarbloodclub.com

**Secondary:**
- চট্টগ্রাম ব্লাড ডোনার
- চট্টগ্রাম রক্তদাতা
- blood donor chittagong
- চকবাজার রক্তদান

এগুলো Title, H1/H2, About content, Footer-এ স্বাভাবিকভাবে আছে — keyword stuffing নয়।

---

## 📁 Deployment Check

```bash
npm run build
ls dist/ | grep -E "sitemap|robots|manifest|_headers"
# sitemap.xml, robots.txt, manifest.json, _headers সব থাকতে হবে

# Cloudflare Workers deploy
npx wrangler deploy
# বা Firebase Hosting
firebase deploy --only hosting
```

Live check:
- https://chawkbazarbloodclub.com/robots.txt → custom robots.txt দেখাবে (Cloudflare Managed OFF হলে)
- https://chawkbazarbloodclub.com/sitemap.xml → XML দেখাবে, HTML নয়
- View Source → canonical = https://chawkbazarbloodclub.com/

---

## ⚠️ নোট

- SEO রাতারাতি হয় না — Search Console submit + ভালো content + backlink সময় নেয়
- meta keywords Google ranking-এ ব্যবহার করে না — Title, description, H1/H2, content, sitemap, structured data, speed, mobile usability আসল
- Primary domain সবসময় `https://chawkbazarbloodclub.com` — কোথাও `cbdc-a9418.web.app` hardcode করবে না (authDomain ছাড়া)
