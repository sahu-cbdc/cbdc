# চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) — React + TypeScript + Vite + Firebase

মূল ৪টি ডেমো HTML পেজকে **React + TypeScript + Vite**-এ রূপান্তর করা হয়েছে — UI ডিজাইন
**১০০% হুবহু** রাখা হয়েছে। Backend/Data layer **Firebase**-এর সাথে যুক্ত এবং প্রজেক্টটি
**যেকোনো স্ট্যাটিক হোস্টিং সাইটে** run করা যায়।

## ফাইল ম্যাপিং

| মূল HTML | React কম্পোনেন্ট | এন্ট্রি (পেজ ফাইল) |
| --- | --- | --- |
| `index.html` | `src/pages/Home.tsx` | `index.html` |
| `doner.html` | `src/pages/Doner.tsx` | `doner.html` |
| `admin.html` | `src/pages/Admin.tsx` | `admin.html` |
| `moderator.html` | `src/pages/Moderator.tsx` | `moderator.html` |

মূল HTML ফাইলগুলো `legacy/` ফোল্ডারে রেফারেন্স হিসেবে রাখা হয়েছে (হুবহু, অপরিবর্তিত)।

## যেকোনো হোস্টিং সাইটে চালানো

Build করলে **৪টি আলাদা HTML ফাইল** (index/doner/admin/moderator) তৈরি হয় এবং সব asset
**relative path** (`./assets/...`) ব্যবহার করে। ফলে `dist/` ফোল্ডারটি **যেকোনো স্ট্যাটিক
হোস্টে** শুধু upload করলেই চলে — কোনো server-side rewrite/SPA fallback লাগে না:

- GitHub Pages, Netlify, Vercel, Cloudflare Pages, Firebase Hosting
- shared cPanel / FTP hosting, Apache, Nginx, S3/র static bucket
- sub-directory-তে বসালেও চলে (যেমন `https://host/cbdc/`)

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

## প্রজেক্ট স্ট্রাকচার

```
src/
├── main.tsx              # Home এন্ট্রি
├── main-doner.tsx        # Doner এন্ট্রি
├── main-admin.tsx        # Admin এন্ট্রি
├── main-moderator.tsx    # Moderator এন্ট্রি
├── global.d.ts           # global type declarations
├── lib/
│   ├── firebase.ts       # একক Firebase instance (App / Auth / Firestore / Storage)
│   └── store.ts          # Firestore-backed shared store — মূল data source
└── pages/
    ├── Home.tsx          # পাবলিক ওয়েবসাইট + লগইন/নিবন্ধন/লগআউট (Firebase Auth)
    ├── Doner.tsx         # ডোনার (রক্তদাতা) প্যানেল
    ├── Admin.tsx         # অ্যাডমিন প্যানেল
    └── Moderator.tsx     # মডারেটর প্যানেল
public/
└── img/logo.png          # Logo (বদলালেই সর্বত্র নতুন logo)
scripts/
└── smoke.mjs             # jsdom-ভিত্তিক smoke test (npm run smoke)

firestore.rules          # Firestore Security Rules
storage.rules            # Storage Security Rules
firestore.indexes.json   # Firestore indexes
firebase.json            # Firebase CLI config
docs/FIREBASE.md         # Firebase ডেটাবেস স্ট্রাকচার, Auth, Role ও deploy গাইড
```

প্রতিটি `.tsx` ফাইলের ভিতরেই সেই পেজের নিজস্ব **UI (JSX), CSS, TypeScript, Functions ও
Logic** থাকে:

- **CSS** — মূল HTML-এর `<style>` ব্লক হুবহু কপি (`<style>{pageCss}</style>`)।
- **Static UI** — মূল HTML-এর `<body>` মার্কআপ হুবহু JSX-এ (`StaticShell`)।
- **Page logic** — মূল HTML-এর `<script type="module">` port (`initPage()` → `useEffect`)।

> **নোট:** মূল HTML-এর JavaScript logic অপরিবর্তিত রাখার জন্য সেই অংশে `// @ts-nocheck`
> ব্যবহার করা হয়েছে। React shell, shared store (`src/lib/store.ts`) ও Firebase layer
> (`src/lib/firebase.ts`) TypeScript-typed।

## Firebase Integration (সারাংশ)

- **Data source:** Firestore (`donors`, `requests`, `members`, `users`, `admins`, `queue`,
  `gallery`, `notices`, `accounts`). সব dummy/static seed data রিমুভ করা হয়েছে।
- **Auth:** Login / Register / Logout / Session — Firebase Authentication (email+password ও
  Google)। Password reset — `sendPasswordResetEmail`, change password — re-auth +
  `updatePassword`।
- **Role & Permission:** `admins/{uid}` থেকে role ও `permissions[]`; panel gate Firebase-নিয়ন্ত্রিত।
- **Sync:** Admin ↔ Moderator ↔ Donor ↔ Home — একই Firestore collection-এ live sync।

বিস্তারিত: **[docs/FIREBASE.md](docs/FIREBASE.md)**।

## চালানো

```bash
npm install
npm run dev        # dev server (http://localhost:5173) — / /doner.html /admin.html /moderator.html
npm run build      # production build (dist/)
npm run preview    # production preview
npm run smoke      # jsdom-ভিত্তিক smoke test (৪টি পেজ render + logic চেক)
```
