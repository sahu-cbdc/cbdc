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
| `/admin/set/approved` | **Approved Donations** — অনুমোদিত রক্তদান দেখুন, সম্পাদনা ও মুছুন |
| `/moderator`, `/moderator/<screen>` | মডারেটর প্যানেল (`src/pages/Moderator.tsx`) |
| `/?uid=<donor id>` | ডোনার কার্ড মোড (শেয়ারযোগ্য পাবলিক কার্ড) |

পুরোনো লিংক (`/doner.html?uid=…`, `#/admin`, `#dashboard` ইত্যাদি) স্বয়ংক্রিয়ভাবে
সঠিক পেজে খুলে এবং clean URL-এ রূপান্তরিত হয় — শেয়ার করা পুরোনো লিংক ভাঙে না।


## Approved Donations

- রক্তদান **Submit → Pending → Approve/Reject** সিস্টেম অপরিবর্তিত।
- Approve-র পরে Admin Panel-এ **Approved Donations** section-এ ছবিসহ স্থায়ী record যায়।
- Admin **View / Edit / Delete** করতে পারে (confirmation-সহ); Edit/Delete হলে donor statistics ও
  user-এর verified list **স্বয়ংক্রিয়ভাবে synchronized** হয়।
- **জীবন বাঁচিয়েছেন** এখন event-ভিত্তিক: ১টি রক্তদান = ১ জীবন (ব্যাগ দিয়ে হিসাব হয় না)।
  মোট ব্যাগ আলাদা `totalBags` হিসেবে থাকে।

## যেকোনো হোস্টিং সাইটে চালানো

Build করলে **একটি `index.html` + assets** তৈরি হয় এবং সব asset
**relative path** (`./assets/...`) ব্যবহার করে। ফলে `dist/` ফোল্ডারটি **যেকোনো স্ট্যাটিক
হোস্টে** শুধু upload করলেই চলে:

- GitHub Pages, Netlify, Vercel, Cloudflare Pages/Workers, Firebase Hosting
- shared cPanel / FTP hosting, Apache, Nginx, S3/র static bucket
- sub-directory-তে বসালেও চলে (যেমন `https://host/cbdc/`)

Cloudflare Workers-এ deploy-এর জন্য `wrangler.jsonc`-এ SPA fallback
(`not_found_handling: single-page-application`) সেট করা আছে, আর Firebase
Hosting-এর জন্য `firebase.json`-এ rewrite (`** → /index.html`) আছে — তাই
`/doner`, `/admin`, `/doner/find`, `/profile/...` যেকোনো nested clean path
সরাসরি খুললেও (যেমন **Refresh করলে**) `index.html`-ই পরিবেশিত হয় এবং 404/blank
পেজ আসে না (পুরোনো ভাগ করা লিংকও ভাঙে না)।

> 🔒 **নিরাপদ সার্ভার-সাইড ডিলিট** — Admin panel-এর ডোনার/অ্যাকাউন্ট ডিলিট
> আর ব্রাউজার থেকে হয় না: client শুধু লগইন করা অ্যাডমিনের Firebase ID token-সহ
> `POST /api/admin` (op: `delete`) গেটওয়েতে অনুরোধ পাঠায়। এই গেটওয়েটি **Cloudflare Worker**
> (`server/index.ts`; `wrangler.jsonc`-এর `main`) অথবা `vite dev`-এ থাকে।
> ডিলিটে RTDB রেকর্ডের পাশাপাশি **সংশ্লিষ্ট Firebase Authentication (লগইন)
> অ্যাকাউন্টও** মোছা হয় — তার জন্য একটি **server secret** লাগে (client-এ কোনো
> private key নেই, repo-তেও নয়):
>
> ```bash
> npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # service-account JSON
> npm run build && npx wrangler deploy
> ```
>
> নিরাপত্তা: লগইন অ্যাকাউন্ট মোছা হয় **ঠিক যাচাইকৃত লিংকড uid-টিই** — Donor ID
> ও Account আলাদা/অমিল হলে সার্ভার কিছুই মোছে না। **secret না দেওয়া থাকলে
> লিংকড-লগইন ডিলিট শুরুই হয় না (atomic — কোনো আংশিক ডিলিট নয়):** Admin panel
> ডিলিটের আগে `POST /api/admin` (op: `config-check`) দিয়ে preflight করে; secret
> অনুপস্থিত হলে একটিই স্পষ্ট বাংলা error দেখায় এবং **কিছুই মোছা হয় না**।
> শুধু static host (Firebase Hosting, Netlify, GitHub Pages …)-এ ডিলিট করলে
> স্পষ্ট ত্রুটি বার্তা দেখানো হয় এবং কোনো ডেটা মোছা হয় না।

> 🛡️ **Duplicate অ্যাকাউন্ট/ডোনার প্রতিরোধ (একই Account/Email একবারই)** —
> Firebase UID-ই Account ও Donor রেকর্ডের primary ID। ইমেইলের uniqueness
> নিশ্চিত হয় RTDB-তে `identityIndex/email/<key> = <uid>` atomic claim দিয়ে
> (`src/lib/identity.ts`; rules: `database.rules.json → identityIndex` —
> **প্রথম UID-ই ইমেইল পায়**, অন্য কেউ দাবি/overwrite করতে পারে না):
>
> - **Signup** — auth account তৈরির পর, RTDB লেখার **আগে** claim; অন্য UID-এর
>   দাবি থাকলে নতুন প্রোফাইল তৈরিই বন্ধ (স্পষ্ট বাংলা বার্তা)।
> - **Google লগইন** — ইমেইলের পুরোনো (legacy) রেকর্ড অন্য UID-এ থাকলে
>   duplicate না বানিয়ে `POST /api/auth` (op: `resolve-legacy`) দিয়ে (server-secure,
>   service-account secret লাগে) রেকর্ডটি বর্তমান UID-এ মিলিয়ে দেয়।
> - **Donor তৈরি** — Admin/Moderator approval ও staff fast-path-এ আগে
>   `donors`-এ একই `ownerUid` খোঁজা হয়; থাকলে সেই ডোনার আইডিই পুনর্ব্যবহৃত হয়।
> - **Delete** — Account/Donor মুছলে ইমেইলের দাবিও মুক্ত হয় (ইমেইল আবার
>   ব্যবহারযোগ্য)।
> - **পুরোনো duplicate পরিষ্কার** — Admin panel-এর "ডুপ্লিকেট যাচাই" বাটন
>   (`POST /api/admin` op: `dedupe`, শুধু অ্যাডমিন) একই ইমেইলের একাধিক users রেকর্ড /
>   একই অ্যাকাউন্টের একাধিক ডোনার আইডি খুঁজে preview দেখায়; নিশ্চিত করলে এক
>   atomic write-এ নিরাপদে মিলিয়ে দেয় ও সূচি backfill করে। ফল live
>   listener-এই realtime দেখা যায়।
>
> প্রয়োজনীয় একবারের ধাপ: `firebase deploy --only database` (identityIndex rules
> প্রকাশের জন্য)।

> ⚠️ **`_redirects` ফাইল এখানে নেই** — Cloudflare Workers-এর static-asset engine
> `/* → /index.html 200`-টাইপ `_redirects` rule-কে infinite-loop হিসেবে নাকচ করে
> দেয় (`Invalid _redirects configuration: Infinite loop detected`)। Workers-এ
> SPA fallback **শুধু `wrangler.jsonc`-এর `not_found_handling` দিয়েই** কাজ করে,
> তাই `_redirects` যোগ করা উচিত নয়। শুধুমাত্র যদি Cloudflare **Pages** বা
> **Netlify**-এ হোস্ট করা হয়, সেক্ষেত্রে ওই প্ল্যাটফর্মে আলাদাভাবে
> `/* /index.html 200` রুল যোগ করতে হবে। Nginx/Apache-এ হোস্ট করলে একই ধরনের
> fallback (যেকোনো path → index.html) কনফিগার করতে হবে।

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
  Google)। Google-এর জন্য শুধু official `GoogleAuthProvider` (popup + redirect fallback);
  কোনো manual OAuth client / client secret নেই। Auth state-এর **একটিমাত্র**
  `onAuthStateChanged` `src/lib/authState.ts`-এ নিবন্ধিত — বাকি সব জায়গা সেই
  shared subscriber ব্যবহার করে (duplicate listener নেই)। Password reset — Firebase-এর
  built-in reset link, সাইটের নিজস্ব `/forgot-password` ও `/reset-password` full-page UI
  দিয়ে; change password — re-auth + `updatePassword`।
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
```

## স্থাপত্য ও নিরাপত্তা (Architecture & Security)

**ব্যবহৃত service — শুধু তিনটি:**

| Service | কাজ |
| --- | --- |
| **Firebase Authentication** | Login, Signup, Google Login, Password Reset, account identity |
| **Firebase Realtime Database** | ওয়েবসাইটের সব data ও configuration (single source of truth) |
| **ImgBB** | ওয়েবসাইটের সব image hosting |

**কোনো Cloud Functions নেই · Firestore নেই · Firebase Storage নেই।**

**Image flow (অপরিবর্তিত):**
```
Image Upload → ImgBB → Image URL → Firebase Realtime Database
```
Profile / donor / gallery / notice / donation proof / report screenshot — সব ছবি ImgBB-তে
upload হয়; ImgBB থেকে পাওয়া URL ও metadata RTDB-তে সেভ হয়। Website · Donor · Admin ·
Moderator Panel সব জায়গায় RTDB-এর সংরক্ষিত ImgBB URL-ই ব্যবহার করা হয়। ছবি বদল/মুছলে
RTDB-এর পুরোনো URL/reference-ও update/remove হয়।

**নিরাপত্তা**
- frontend source / HTML / bundled JS-এ কোনো private key, secret বা sensitive credential নেই
- client-এ শুধু Firebase-এর publicly-safe web config (Rules-ই আসল নিরাপত্তা)
- `VITE_*` env bundle-এ inline হয় — তাই কোনো secret সেখানে রাখা হয় না; `import.meta.env`
  পুরো অবজেক্ট না পড়ে শুধু নির্দিষ্ট public key পড়া হয়
- ImgBB-র private API key কেবল এক জায়গায় — সার্ভার-সাইড `server/config/imgbb.ts` (env `IMGBB_API_KEY` দিয়ে override হয়); `/api/media` ছাড়া কেউ ছুঁতে পারে না, client/source/bundle-এ কখনোই নেই
- Client পায় শুধু public সেটিংস (`src/config/imgbb.ts` — ছবির কম্প্রেশন); upload সরাসরি client→ImgBB নয়, লগইন-verify করা `/api/media` gateway দিয়ে
- RTDB Security Rules: `users`/`admins`/`accounts`/`queue`/`audit`/`messages`/`reports`/`members`
  — সব private node-এ auth + staff/owner check; public read শুধু `donors`/`requests`/`gallery`/
  `notices`/`settings` (পাবলিক ওয়েবসাইটের জন্য)
- ডোনার/অ্যাকাউন্ট ডিলিট: RTDB-এর সব সংশ্লিষ্ট তথ্য **এবং সংশ্লিষ্ট Firebase Authentication
  (লগইন) অ্যাকাউন্ট** নিরাপদ server endpoint দিয়ে মোছা হয় (server-side service-account
  secret — client-এ কোনো private key নেই)। Donor ID ও Account আলাদা হলে ভুল অ্যাকাউন্ট
  কখনো মোছা হয় না; লগইন ডিলিট ব্যর্থ হলে কিছুই মোছা হয় না (স্পষ্ট বাংলা বার্তা)
- localStorage production data-এর উৎস নয় — RTDB-ই single source of truth (cache শুধু `vite dev`-এ)

**Host-independent:** কোনো host-নির্দিষ্ট path/URL নেই। Root deploy-এ ডিফল্ট `base: "/"`;
sub-directory হোস্টিং-এ শুধু `VITE_BASE=/cbdc/` env (Firebase Hosting · Cloudflare Pages
(wrangler.jsonc) · Netlify · Vercel · যেকোনো static host + SPA rewrite)।

### Deploy checklist

```bash
npm ci && npm run build            # dist/ — যেকোনো host-এ serve করা যায়
firebase deploy --only database    # RTDB Security Rules
firebase deploy --only hosting     # (ঐচ্ছিক) Firebase Hosting ব্যবহার করলে
```
কোনো Cloud Function deploy করতে হয় না — পুরো সিস্টেম Auth + RTDB + ImgBB দিয়েই চলে।

