# 🔍 CBDC ওয়েবসাইট SEO গাইড — নাম দিয়ে সার্চ করলে যেন পাওয়া যায়

এই ডকুমেন্টে ব্যাখ্যা করা হয়েছে কীভাবে ওয়েবসাইটটি SEO করা হয়েছে এবং ভবিষ্যতে কীভাবে গুগলে র‍্যাঙ্ক বাড়াবেন।

---

## ✅ যা করা হয়েছে (এই আপডেটে)

### ১. `index.html` — সম্পূর্ণ SEO Meta Tag
- **Title** এখন কিওয়ার্ড-সমৃদ্ধ: `চকবাজার ব্লাড ডোনার'স ক্লাব | CBDC - চট্টগ্রামে রক্তদাতা খুঁজুন | Chawkbazar Blood Donor's Club`
- **Description** দীর্ঘ ও তথ্যবহুল — বাংলা + ইংরেজি + এলাকা + ব্লাড গ্রুপ
- **Keywords** — ২০+ ভ্যারিয়েশন যোগ করা হয়েছে:
  ```
  চকবাজার ব্লাড ডোনার'স ক্লাব, CBDC, Chakbazar Blood Donor's Club, 
  Chawkbazar Blood Donors Club, চট্টগ্রাম ব্লাড ডোনার, blood donor chittagong...
  ```
- **Canonical**, **hreflang (bn/en)**, **robots**, **geo tags** (Chawkbazar, Chittagong)
- **Open Graph (Facebook)** + **Twitter Card** — শেয়ার করলে সুন্দর preview
- **Preconnect** — পারফরম্যান্স বাড়ায় (SEO ranking factor)

### ২. Structured Data (JSON-LD) — গুগল বুঝতে পারবে
৩টি schema যোগ করা হয়েছে:
- **NGO / Organization** — নাম, alternateName (CBDC, Chakbazar, Chawkbazar সব বানান), logo, contact, areaServed (২৪ থানা), sameAs (Facebook)
- **WebSite + SearchAction** — গুগল সাইটে সার্চ বক্স দেখাবে
- **BreadcrumbList** — হোম > ডোনার খুঁজুন > নিবন্ধন > জরুরি আবেদন

ফলে গুগলে সার্চ করলে Knowledge Panel আসার সম্ভাবনা বাড়বে।

### ৩. `robots.txt` + `sitemap.xml`
- `public/robots.txt` — সব public পেজ Allow, admin/moderator/doner Disallow, sitemap লিংক
- `public/sitemap.xml` — ৯টি গুরুত্বপূর্ণ URL, priority সহ, lastmod আজকের তারিখ
- Vite build করলে `dist/` এ কপি হয়, Firebase Hosting + Cloudflare দুই জায়গায় কাজ করে

### ৪. `manifest.json` — PWA + SEO
- name, short_name, description কিওয়ার্ড-সমৃদ্ধ
- icons, shortcuts (ডোনার খুঁজুন, জরুরি আবেদন, নিবন্ধন)
- গুগল PWA হিসেবে চিনবে, মোবাইল SEO বাড়বে

### ৫. Dynamic SEO (SPA জন্য) — `src/lib/seo.ts`
React SPA হওয়ায় পেজ পরিবর্তনে title/description বদলায় না — এটা SEO এর জন্য খারাপ।
নতুন `seo.ts` মডিউল:
- প্রতিটি route (`/`, `/donor-search`, `/register`, `/emergency`, `/eligibility`, `/about`, `/login`, `/signup`, `/profile/:id`) এর জন্য আলাদা title/description/keywords
- `showView()` কল হলে স্বয়ংক্রিয় `updateSEO()` কল হয়
- ডোনার প্রোফাইল খুললে `updateProfileSEO(name, group, area)` — যেমন `Rahim (B+) - Chawkbazar | রক্তদাতা প্রোফাইল - CBDC`
- `initSEO()` — history.pushState/replaceState monkey-patch করে back/forward এও SEO আপডেট

### ৬. `firebase.json` — SEO Headers
- X-Content-Type-Options, X-Frame-Options, XSS Protection
- sitemap.xml, robots.txt এর জন্য Cache-Control
- images জন্য immutable cache
- cleanUrls + trailingSlash false — duplicate content এড়ায়

### ৭. `noscript` Fallback
JS বন্ধ থাকলে বা crawler হলে বাংলা + ইংরেজি বিবরণ + লিংক দেখাবে — গুগলbot content পাবে।

---

## 🚀 এখন কী করতে হবে (আপনার কাজ)

SEO শুধু কোড নয়, বাইরের কাজও লাগে। নিচের ৮টি কাজ করলে ১-২ সপ্তাহে গুগলে নাম দিয়ে পাওয়া যাবে:

### ১. Google Search Console এ Submit করুন
1. https://search.google.com/search-console যান
2. Domain বা URL prefix দিয়ে `https://cbdc-a9418.web.app` যোগ করুন
3. Verification — HTML tag বা DNS (Firebase Hosting হলে HTML file upload সহজ)
4. Sitemaps > `https://cbdc-a9418.web.app/sitemap.xml` submit করুন
5. URL Inspection > `/`, `/donor-search`, `/register` প্রতিটি Request Indexing করুন

### ২. Google Business Profile (খুব গুরুত্বপূর্ণ)
- https://business.google.com এ `Chakbazar Blood Donor's Club - CBDC` নামে প্রোফাইল খুলুন
- Category: Blood bank / Non-profit / Charity
- Address: Chawkbazar, Chittagong, ফোন, ওয়েবসাইট লিংক
- এতে `চকবাজার ব্লাড ডোনার ক্লাব` লিখে সার্চ করলে Maps + Knowledge Panel এ আসবে

### ৩. Facebook Page/Group এ ওয়েবসাইট লিংক
- আপনার Facebook Page ও Group এর About/Bio তে `https://cbdc-a9418.web.app` লিংক দিন
- নিয়মিত পোস্টে ওয়েবসাইট শেয়ার করুন — Facebook থেকে backlink SEO বাড়ায়

### ৪. অন্যান্য Directory তে লিস্টিং
- চট্টগ্রামের local directory, blood donation list, NGO list এ CBDC নাম + ওয়েবসাইট লিংক দিন
- যেমন: `https://www.blooddonorsbd.com`, local news site

### ৫. কনটেন্টে কিওয়ার্ড ব্যবহার
- About সেকশনে ইতিমধ্যে আছে, কিন্তু ভবিষ্যতে Blog/Notice লিখলে `চকবাজার ব্লাড ডোনার'স ক্লাব`, `CBDC`, `Chawkbazar Blood Donor's Club` শব্দগুলো বারবার ব্যবহার করুন
- Footer এ Address + Phone + Email আছে — ভালো

### ৬. নিয়মিত আপডেট
- গুগল সক্রিয় সাইট পছন্দ করে। সপ্তাহে ১-২ বার গ্যালারি বা নোটিশ আপডেট করুন
- `sitemap.xml` এর lastmod তারিখ আপডেট করুন (আপাতত 2026-08-29)

### ৭. Custom Domain (যদি সম্ভব হয়)
- `cbdc-a9418.web.app` এর চেয়ে `cbdcbd.org` বা `chawkbazarbloodclub.com` হলে SEO অনেক ভালো
- Firebase Hosting এ custom domain যোগ করা যায় (ফ্রি SSL সহ)
- Domain এ `blood`, `chittagong`, `donor` শব্দ থাকলে আরও ভালো

### ৮. Page Speed
- ইতিমধ্যে preconnect যোগ করা হয়েছে
- ছবি compress করুন (logo.png WebP তে convert করলে আরও ভালো)
- Lighthouse (Chrome DevTools) এ 90+ score লক্ষ্য

---

## 🔑 কোন নাম দিয়ে সার্চ করলে পাওয়া যাবে (Target Keywords)

এই আপডেটের পর নিচের যেকোনো নামে সার্চ করলে আসার সম্ভাবনা বাড়বে:

**বাংলা:**
- চকবাজার ব্লাড ডোনার'স ক্লাব
- চকবাজার ব্লাড ডোনার ক্লাব
- চকবাজার রক্তদান
- চট্টগ্রাম ব্লাড ডোনার
- চট্টগ্রাম রক্তদাতা
- রক্তদাতা চট্টগ্রাম
- CBDC চকবাজার

**ইংরেজি:**
- CBDC
- Chakbazar Blood Donor's Club
- Chawkbazar Blood Donor's Club
- Chawkbazar Blood Donors Club
- Chittagong blood donor
- blood donor chittagong
- blood donor chawkbazar
- chittagong blood donor list
- chawkbazar blood bank

---

## 📁 ফাইল তালিকা

- `index.html` — মূল SEO
- `public/robots.txt` — crawler নির্দেশনা
- `public/sitemap.xml` — সাইটম্যাপ
- `public/manifest.json` — PWA manifest
- `src/lib/seo.ts` — SPA dynamic SEO
- `src/pages/Home.tsx` — showView + renderProfile এ SEO hook
- `firebase.json` — headers + cleanUrls

---

## ⚠️ নোট

- SEO রাতারাতি হয় না — Google Search Console এ submit করার পর 3-14 দিন লাগে index হতে
- `cbdc-a9418.web.app` Firebase এর subdomain — custom domain নিলে আরও দ্রুত র‍্যাঙ্ক হবে
- কোনো প্রশ্ন থাকলে এই ফাইল আপডেট করুন বা `src/config/site.ts` এ নাম/ফোন/ইমেইল বদলালে SEO তেও প্রভাব পড়বে
