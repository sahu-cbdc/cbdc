# চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) — React + TypeScript + Vite + Firebase

মূল ৪টি ডেমো HTML পেজকে **React + TypeScript + Vite**-এ রূপান্তর করা হয়েছে — UI ডিজাইন
**১০০% হুবহু** রাখা হয়েছে। Backend/Data layer **Firebase**-এর সাথে যুক্ত এবং প্রজেক্টটি
**যেকোনো স্ট্যাটিক হোস্টিং সাইটে** run করা যায়।

## ফাইল ম্যাপিং ও URL

এখন **একটিই HTML entry** (`index.html`) — সব পেজ `.tsx` কম্পোনেন্ট হিসেবে
এই entry থেকেই বুট হয় (src/main.tsx + src/lib/router.ts)। সব URL
**hash-বিহীন clean path** (কোনো `#` নেই):

| URL | পেজ / ভিউ |
| --- | --- |
| `/` | পাবলিক সাইট (`src/pages/Home.tsx`) |
| `/signup`, `/login`, `/register`, `/emergency`, `/eligibility`, `/about` | হোমপেজের ভেতরের ভিউ |
| `/profile/<id>` | পাবলিক ডোনার প্রোফাইল ভিউ |
| `/doner`, `/doner/<screen>` | ডোনার প্যানেল (`src/pages/Doner.tsx`) |
| `/admin`, `/admin/<screen>` | অ্যাডমিন প্যানেল (`src/pages/Admin.tsx`) |
| `/moderator`, `/moderator/<screen>` | মডারেটর প্যানেল (`src/pages/Moderator.tsx`) |
| `/?uid=<donor id>` | ডোনার কার্ড মোড (শেয়ারযোগ্য পাবলিক কার্ড) |

পুরোনো লিংক (`/doner.html?uid=…`, `#/admin`, `#dashboard` ইত্যাদি) স্বয়ংক্রিয়ভাবে
সঠিক পেজে খুলে এবং clean URL-এ রূপান্তরিত হয় — শেয়ার করা পুরোনো লিংক ভাঙে না।


## যেকোনো হোস্টিং সাইটে চালানো

Build করলে **একটি `index.html` + assets** তৈরি হয় এবং সব asset
**relative path** (`./assets/...`) ব্যবহার করে। ফলে `dist/` ফোল্ডারটি **যেকোনো স্ট্যাটিক
হোস্টে** শুধু upload করলেই চলে:

- GitHub Pages, Netlify, Vercel, Cloudflare Pages/Workers, Firebase Hosting
- shared cPanel / FTP hosting, Apache, Nginx, S3/র static bucket
- sub-directory-তে বসালেও চলে (যেমন `https://host/cbdc/`)

Cloudflare Workers-এ deploy-এর জন্য `wrangler.jsonc`-এ SPA fallback
(`not_found_handling: single-page-application`) সেট করা আছে, আর Firebase
Hosting-এর জন্য `firebase.json`-এ rewrite (`** → /index.html`) আছে। Cloudflare
Pages/Netlify-এর জন্য build-এ `dist/_redirects` যোগ হয় (`/* → /index.html 200`) —
তাই `/doner`, `/admin`, `/doner/find`, `/profile/...` যেকোনো nested clean path
সরাসরি খুললেও (যেমন **Refresh করলে**) `index.html`-ই পরিবেশিত হয় এবং 404/blank
পেজ আসে না (পুরোনো ভাগ করা লিংকও ভাঙে না)। Nginx/Apache-এ হোস্ট করলে একই ধরনের
fallback (যেকোনো path → index.html) কনফিগার করতে হবে।

```bash
npm run build      # dist/ ফোল্ডার তৈরি
# dist/ ফোল্ডারের সব ফাইল যেকোনো স্ট্যাটিক হোস্টে upload করুন
```

Firebase Hosting-এ deploy (ঐচ্ছিক):

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting
```

## Theme ব্যবস্থা

- **Default ও স্থায়ী Theme = Light।** মোবাইলের System (Dark/Light) Theme অনুযায়ী UI
  বদলানোর পুরনো ব্যবস্থা **বন্ধ** করা হয়েছে (head script + `matchMedia` listener সরানো হয়েছে)।
- **User Panel (Doner) ও Admin Panel — দুটোতেই** Settings → চেহারা → **থিম**-এ ম্যানুয়াল
  Light/Dark পরিবর্তনের অপশন আছে। সেখান থেকে চাইলে theme বদলানো যায় (default Light)।

## Logo ব্যবস্থাপনা

- Logo ফাইল: **`public/img/logo.png`** (build-এ `dist/img/logo.png`)।
- পুরো সিস্টেম (হোম পেজ, ডোনার/অ্যাডমিন/মডারেটর প্যানেল, ডিজিটাল ডোনার কার্ড) **সরাসরি
  `img/logo.png` থেকে** logo load করে।
- **ভবিষ্যতে logo বদলাতে হলে শুধু `public/img/logo.png` ফাইলটি replace করুন** — নতুন logo
  স্বয়ংক্রিয়ভাবে সর্বত্র দেখাবে (কোডে কোনো পরিবর্তন লাগবে না)।

## ⭐ সহজে Text / কনটেন্ট বদলানো

সাইট-ব্যাপী সব Text (নাম, ট্যাগলাইন, ফোন, WhatsApp, ইমেইল, Facebook, এলাকা, রক্তের
গ্রুপ, নিয়ম) এক জায়গায় — **`src/config/site.ts`**-এ। এখানে একবার বদলালে সব পেজে
(Home + Doner + Admin + Moderator) বদলে যাবে।

- **Logo:** `public/img/logo.png` replace করলেই নতুন logo সর্বত্র।
- **UI ডিজাইন:** অপরিবর্তিত — শুধু Text/কনফিগ বদলায়।

বিস্তারিত: **[docs/EDITING.md](docs/EDITING.md)**।

## প্রজেক্ট স্ট্রাকচার

```
src/
├── main.tsx              # Home এন্ট্রি
├── main-doner.tsx        # Doner এন্ট্রি
├── main-admin.tsx        # Admin এন্ট্রি
├── main-moderator.tsx    # Moderator এন্ট্রি
├── global.d.ts           # global type declarations
├── config/
│   ├── site.ts           ★ সাইটের কেন্দ্রীয় Text (নাম, ফোন, ইমেইল, লিংক, নিয়ম…)
│   └── logo.ts           ★ পুরো সাইটের লোগোর একমাত্র উৎস
├── lib/
│   ├── firebase.ts       # একক Firebase instance (App / Auth / Realtime Database)
│   ├── rtdb.ts           # Realtime Database helper — ডেটার একমাত্র দরজা
│   ├── age.ts            # জন্ম তারিখ → বয়স (সব জায়গায় একই নিয়ম)
│   ├── forms.ts          # ইনলাইন ফর্ম ভ্যালিডেশন (popup নয়)
│   ├── authx.ts          # Auth, role resolve, password reset
│   ├── imgbb.ts          # ImgBB image hosting helper (upload → link → DB)
│   └── store.ts          # RTDB-backed shared store — মূল data source
└── pages/
    ├── Home.tsx          # পাবলিক ওয়েবসাইট + লগইন/নিবন্ধন/লগআউট (Firebase Auth)
    ├── Doner.tsx         # ডোনার (রক্তদাতা) প্যানেল
    ├── Admin.tsx         # অ্যাডমিন প্যানেল
    └── Moderator.tsx     # মডারেটর প্যানেল
public/
└── img/logo.png          ★ Logo (এই ফাইল replace করলেই সর্বত্র নতুন logo)
scripts/
└── smoke.mjs             # jsdom-ভিত্তিক smoke test (npm run smoke)

database.rules.json      # Realtime Database Security Rules
firebase.json            # Firebase CLI config
docs/FIREBASE.md         # ডেটাবেস স্ট্রাকচার, Auth, Role, deploy গাইড
docs/EDITING.md          # ★ Text/Logo/Config বদলানোর সহজ গাইড
docs/PASSWORD_RESET_EMAIL.md   # Firebase reset ইমেইল ব্র্যান্ডিং (template HTML)
docs/GOOGLE_LOGIN_BRANDING.md  # Google "Choose an account" স্ক্রিনের নাম ও লোগো
```

প্রতিটি `.tsx` ফাইলের ভিতরেই সেই পেজের নিজস্ব **UI (JSX), CSS, TypeScript, Functions ও
Logic** থাকে:

- **CSS** — মূল HTML-এর `<style>` ব্লক হুবহু কপি (`<style>{pageCss}</style>`)।
- **Static UI** — মূল HTML-এর `<body>` মার্কআপ হুবহু JSX-এ (`StaticShell`)।
- **Page logic** — মূল HTML-এর `<script type="module">` port (`initPage()` → `useEffect`)।

> **নোট:** মূল HTML-এর JavaScript logic অপরিবর্তিত রাখার জন্য সেই অংশে `// @ts-nocheck`
> ব্যবহার করা হয়েছে। React shell, shared store (`src/lib/store.ts`), data layer
> (`src/lib/rtdb.ts`) ও Firebase layer (`src/lib/firebase.ts`) TypeScript-typed।

## Firebase Integration (সারাংশ)

- **Data source:** **Firebase Realtime Database** (`donors`, `requests`, `members`, `users`,
  `admins`, `queue`, `gallery`, `notices`, `accounts`, `settings`)। Cloud Firestore ব্যবহৃত
  হয় **না**। প্রতিটি স্ক্রিন `onValue` listener-এ যুক্ত, তাই Add / Edit / Delete করলে সব
  dashboard-এ সঙ্গে সঙ্গে live update হয়। কোনো demo/mock/seed data নেই।
- **Auth:** Login / Register / Logout / Session — Firebase Authentication (email+password ও
  Google)। Password reset — Firebase-এর built-in reset link, সাইটের নিজস্ব
  `/forgot-password` ও `/reset-password` full-page UI দিয়ে; change password — re-auth +
  `updatePassword`।
- **Role & Permission:** RTDB `admins/{uid}` থেকে role ও `permissions[]`।
  Doner → `/doner`, Moderator → `/moderator`, Admin → `/admin` — প্রতিটি প্যানেল নিজেই
  gate করে, তাই Admin/Moderator কখনো সাধারণ Doner dashboard ব্যবহার করে না।
- **বয়স:** কোথাও সংরক্ষিত নয় — শুধু জন্ম তারিখ (`dob`) রাখা হয়, বয়স প্রতিবার হিসাব হয়।
- **Image hosting:** ImgBB API — ছবি upload → link + metadata RTDB-তে সেভ → UI-তে সরাসরি
  ছবি (Firebase Storage ব্যবহৃত হয় না)।
- **Sync:** Admin ↔ Moderator ↔ Donor ↔ Home — একই Realtime Database node-এ live sync।

বিস্তারিত: **[docs/FIREBASE.md](docs/FIREBASE.md)**।

## চালানো

```bash
npm install
npm run dev        # dev server (http://localhost:5173) — একটি entry; প্যানেলগুলো ভেতরের নেভিগেশনে
npm run build      # production build (dist/)
npm run preview    # production preview
npm run smoke      # jsdom-ভিত্তিক smoke test (৪টি পেজ render + logic চেক)
```
