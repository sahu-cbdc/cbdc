# চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) — React + TypeScript + Vite + Firebase

মূল ৪টি ডেমো HTML পেজকে **React + TypeScript + Vite**-এ রূপান্তর করা হয়েছে — UI ডিজাইন
**১০০% হুবহু** রাখা হয়েছে (কোনো নতুন ডিজাইন করা হয়নি)। Backend/Data layer এখন **সম্পূর্ণ
Firebase**-এর সাথে যুক্ত: Firestore-ই মূল data source এবং Firebase Authentication session
পরিচালনা করে।

## ফাইল ম্যাপিং

| মূল HTML | React কম্পোনেন্ট | রুট |
| --- | --- | --- |
| `index.html` | `src/pages/Home.tsx` | `/` |
| `doner.html` | `src/pages/Doner.tsx` | `/doner` |
| `admin.html` | `src/pages/Admin.tsx` | `/admin` |
| `moderator.html` | `src/pages/Moderator.tsx` | `/moderator` |

মূল HTML ফাইলগুলো `legacy/` ফোল্ডারে রেফারেন্স হিসেবে রাখা হয়েছে (হুবহু, অপরিবর্তিত)।

## প্রজেক্ট স্ট্রাকচার

```
src/
├── main.tsx              # React entry
├── App.tsx               # path → component mapping + title
├── global.d.ts           # global type declarations (window.CBDCShared ইত্যাদি)
├── lib/
│   ├── firebase.ts       # একক Firebase instance (App / Auth / Firestore / Storage)
│   └── store.ts          # Firestore-backed shared store (window.CBDCShared API) — মূল data source
└── pages/
    ├── Home.tsx          # পাবলিক ওয়েবসাইট + লগইন/নিবন্ধন/লগআউট (Firebase Auth)
    ├── Doner.tsx         # ডোনার (রক্তদাতা) প্যানেল
    ├── Admin.tsx         # অ্যাডমিন প্যানেল
    └── Moderator.tsx     # মডারেটর প্যানেল
scripts/
└── smoke.mjs             # jsdom-ভিত্তিক smoke test (npm run smoke)

firestore.rules          # Firestore Security Rules
storage.rules            # Storage Security Rules
firestore.indexes.json   # Firestore indexes
firebase.json            # Firebase CLI config (rules + hosting)
docs/FIREBASE.md         # Firebase ডেটাবেস স্ট্রাকচার, Auth, Role ও deploy গাইড
```

প্রতিটি `.tsx` ফাইলের ভিতরেই সেই পেজের নিজস্ব **UI (JSX), CSS, TypeScript, Functions ও
Logic** থাকে:

- **CSS** — মূল HTML-এর `<style>` ব্লক হুবহু কপি (`<style>{pageCss}</style>`)।
- **Static UI** — মূল HTML-এর `<body>` মার্কআপ হুবহু JSX-এ (`StaticShell`)।
- **Page logic** — মূল HTML-এর `<script type="module">` port (`initPage()` → `useEffect`)।

> **নোট:** মূল HTML-এর JavaScript logic অপরিবর্তিত রাখার জন্য সেই অংশে `// @ts-nocheck`
> ব্যবহার করা হয়েছে — runtime আচরণে কোনো পার্থক্য না আসে। React shell, shared store
> (`src/lib/store.ts`) ও Firebase layer (`src/lib/firebase.ts`) TypeScript-typed।

## Firebase Integration (সারাংশ)

- **Data source:** Firestore (`donors`, `requests`, `members`, `users`, `admins`, `queue`,
  `gallery`, `notices`, `accounts`). সব **dummy/static seed data রিমুভ** করা হয়েছে।
- **Auth:** Login / Register / Logout / Session — Firebase Authentication (email+password ও
  Google)। Password reset — `sendPasswordResetEmail`, change password — re-auth +
  `updatePassword`।
- **Role & Permission:** `admins/{uid}` collection থেকে role (`admin`/`super`/`moderator`/`mod`)
  ও `permissions[]`। Admin/Moderator panel gate ও `can()` permission check Firebase-নিয়ন্ত্রিত।
- **Sync:** Admin ↔ Moderator ↔ Donor ↔ Home — সবাই একই Firestore collection-এ live sync হয়।
- **localStorage:** demo-data নির্ভরতা বাদ — এখন শুধু user preference cache (theme/lang ইত্যাদি)।

বিস্তারিত: **[docs/FIREBASE.md](docs/FIREBASE.md)**।

## নেভিগেশন

মূল HTML-এর মতোই multi-page অ্যাপ — পেজগুলোর মধ্যে নেভিগেশন full page-load হয়
(state Firestore-এ থাকে, তাই কিছু হারায় না):

- `admin.html` / `moderator.html` / `doner.html` / `index.html` → `/admin` / `/moderator` / `/doner` / `/`
- পেজের ভিতরের hash নেভিগেশন (যেমন `#signup`, `#donor-search`) আগের মতোই কাজ করে।

## চালানো

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build
npm run preview    # production preview
npm run smoke      # jsdom-ভিত্তিক smoke test (৪টি পেজ render + logic চেক)
```

## Rules deploy (Firebase CLI)

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

> Firestore-এ data, `users`/`admins` role doc এবং Firebase Auth user তৈরি করার ধাপ
> `docs/FIREBASE.md`-তে দেওয়া আছে।
