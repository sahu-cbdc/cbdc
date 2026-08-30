# Firebase Integration — CBDC

এই ডকুমেন্টে Firebase-এর সাথে পুরো প্রজেক্ট কীভাবে যুক্ত হয়েছে, Database
structure, Authentication flow, Role & Permission model, **Image system (ImgBB)**
এবং Security Rules deploy করার ধাপগুলো বর্ণনা করা হয়েছে।

---

## ১. Backend সেবা (কী কী ব্যবহার হয়)

| কাজ | সার্ভিস |
| --- | --- |
| Authentication (register/login/logout/session) | Firebase Authentication |
| Structured data + realtime sync | **Firebase Realtime Database** (একমাত্র source of truth) |
| Image hosting | **ImgBB API** (Firebase Storage ব্যবহার হয় **না**) |

> **ডাটাবেস: Realtime Database (RTDB)-only।** Cloud Firestore ব্যবহার করা হয় **না**।
> প্রতিটি স্ক্রিন RTDB-র `onValue` listener-এ যুক্ত, তাই কোথাও কিছু Add / Edit / Delete
> করলে সেটি সঙ্গে সঙ্গে **সব dashboard-এ** (Home, Doner, Admin, Moderator) দেখা যায় —
> একই তথ্য দ্বিতীয়বার হাতে লেখার দরকার হয় না।
>
> ডেটা অ্যাক্সেসের একমাত্র জায়গা `src/lib/rtdb.ts`; পেজগুলো সরাসরি
> `firebase/database` আমদানি করে না।

## ২. কনফিগারেশন

Firebase config এক জায়গায় রাখা হয়েছে: **`src/lib/firebase.ts`**।

```ts
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "auth.chawkbazarbloodclub.com", // custom Firebase Auth domain
  projectId: "chokbazarbloodclub-69d5f",
  databaseURL: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  // ...
};
```

Project: **`chokbazarbloodclub-69d5f`** (`.firebaserc`-এও সেট করা আছে)।

### ২.১ Authentication নোট (গুরুত্বপূর্ণ)

- **Email/Password + Google** — দুটোই Firebase Console → Authentication →
  Sign-in method-এ চালু করে Save করতে হবে। না করলে `auth/configuration-not-found`
  বা `auth/operation-not-allowed` error আসবে।
- **লগইন ও অ্যাকাউন্ট তৈরি — দুটোর জন্যই একই Google flow** (`src/lib/authx.ts`
  → `googleSignInWithFallback`, আর সমাপ্তি Home.tsx → `continueGoogleAuth`)।
  ডেস্কটপে `signInWithPopup`, মোবাইল/WebView/পপ-আপ ব্লকে স্বয়ংক্রিয়
  `signInWithRedirect` fallback; redirect-ফলাফল ফিরে এসে `consumeGoogleRedirect`
  দিয়ে resume হয়।
- **একই অ্যাকাউন্ট, ডুপ্লিকেট নয়:** আগে থেকে একই Google account (বা একই ইমেইলে
  তৈরি অ্যাকাউন্ট) থাকলে নতুন অ্যাকাউন্ট তৈরি হয় না — RTDB `users`-এ
  UID/email দিয়ে খুঁজে **বিদ্যমান অ্যাকাউন্টেই** লগইন হয় এবং সরাসরি নিজের
  নির্ধারিত dashboard-এ যায়।
- **সেশন স্থায়ীত্ব:** `src/lib/firebase.ts`-এ `browserLocalPersistence` সেট করা —
  রিলোড/ব্রাউজার বন্ধ করলেও Firebase Auth session থাকে; সফল সাইন-ইনের পর
  `auth.currentUser` বসার বিষয়টিও কোডে যাচাই করা হয়।
- **সমস্যা: "অ্যাকাউন্ট বেছে নেওয়ার পর সাইটে ফিরে আসে, লগইন হয় না"** — প্রায়
  সবসময় নিচের কনফিগারেশনের একটির অভাবে হয়:
  1. Firebase Console → Authentication → Sign-in method → **Google: Enabled**
     (এবং সেখানে "Project public-facing name" = **চকবাজার ব্লাড ডোনার্স ক্লাব** দিন)।
  2. Firebase Console → Authentication → Settings → **Authorized domains**-এ
     সাইট যে ডোমেইনে চলে (যেমন `cbdc-a9418.web.app`, `chawkbazarbloodclub.com`,
     custom Firebase Auth domain `auth.chawkbazarbloodclub.com`, প্রয়োজনে `localhost`) যোগ করা। অনুমোদিত ডোমেইন ছাড়া
     `auth/unauthorized-domain` আসে এবং সাইন-ইন শেষ হয় না। কোডে production
     authorized domain দুটি (`chawkbazarbloodclub.com`, `www.chawkbazarbloodclub.com`)
     `src/lib/authx.ts`-এর `AUTHORIZED_HOSTS`-এ যাচাই করা আছে; এই ডোমেইনে থাকলেও
     অস্বীকৃতি এলে আরও নির্দিষ্ট diagnostic বার্তা দেখানো হয়।
  3. সাইটটি যদি ভিন্ন হোস্টিং/প্রেভিউ ডোমেইনে চলে, সেটিও যোগ করতে হবে।
  **দ্রষ্টব্য:** `auth.chawkbazarbloodclub.com/__/auth/handler`
  হলো custom Firebase Auth domain-এর বাধ্যতামূলক প্রযুক্তিগত redirect —
  এটি মেলানো যাবে না; ব্র্যান্ডিং নিয়ন্ত্রিত হয় "Project public-facing name" ও
  Google OAuth consent screen দিয়ে (নিচের ২.২ দেখুন)।
- **API key restriction** দিলে `Identity Toolkit API` ও `Token Service API`
  allowed রাখুন এবং deploy করা ডোমেইনকে HTTP referrer allowlist-এ যোগ করুন।
- ঐচ্ছিক env override (`VITE_FIREBASE_API_KEY` ইত্যাদি) সেট করলে সবগুলোই দিতে হয়;
  আংশিক সেট intentional error-এ ফেলা হয় (ভুল config silent অনুমোদন এড়াতে)।
  RTDB `users/{uid}` প্রোফাইল login/signup-এর পর স্বয়ংক্রিয়ভাবে merge-আপডেট হয়।
- **একই ইমেইলে আগে অন্য পদ্ধতির অ্যাকাউন্ট থাকলে** (`auth/account-exists-with-different-credential`)
  নতুন অ্যাকাউন্ট না তৈরি করে ব্যবহারকারীকে ইমেইল/পাসওয়ার্ড লগইনে পাঠানো হয়
  (বাংলা বার্তাসহ)।
- **ত্রুটি বার্তা:** সব Firebase error কোড `authErrorMessage()`-এ বাংলা
  বার্তায় ম্যাপ করা — ব্যর্থ হলে ইউজার পরিষ্কার কারণ ও করণীয় দেখে।

### ২.২ Google Consent Screen / Branding (চকবাজার ব্লাড ডোনার্স ক্লাব)

Google লগইনের "Choose an account" স্ক্রিনে যেন `chokbazarbloodclub-69d5f`
নামটি **না দেখে** সাইটের আসল নাম দেখায় — সেজন্য একবারের কনফিগারেশন:

| কোথায় | কী বসাবেন |
| --- | --- |
| Firebase Console → Authentication → Sign-in method → Google → **Project public-facing name** | **চকবাজার ব্লাড ডোনার্স ক্লাব** |
| Google Cloud Console → OAuth consent screen → **App name** | **চকবাজার ব্লাড ডোনার্স ক্লাব** |
| OAuth consent screen → Authorized domains | সাইটের ডোমেইন + `firebaseapp.com` |
| Google Cloud → Credentials → OAuth client (Web) → Authorized redirect URIs | `https://auth.chawkbazarbloodclub.com/__/auth/handler` (custom Firebase Auth domain) |

বিস্তারিত ধাপ: `docs/GOOGLE_LOGIN_BRANDING.md`।

## ৩. Data Layer আর্কিটেকচার

- **`src/lib/firebase.ts`** — একক Firebase instance (App / Auth / Realtime Database)। **Storage নয়।**
- **`src/lib/rtdb.ts`** — RTDB read/write/listen helper (`watchList`, `addRow`, `updateRow`,
  `removeRow`, `findBy` …)। ডেটা স্পর্শ করার একমাত্র দরজা।
- **`src/lib/age.ts`** — জন্ম তারিখ → বয়স (সব জায়গায় একই নিয়ম)।
- **`src/lib/forms.ts`** — ইনলাইন ফর্ম ভ্যালিডেশন (popup নয়, ঘর highlight + নিচে বার্তা)।
- **`src/config/logo.ts`** — পুরো সাইটের লোগোর একমাত্র উৎস।
- **`src/lib/store.ts`** — `window.CBDCShared` API-র RTDB-backed port:

  | আগে (demo) | এখন (Realtime Database) |
  | --- | --- |
  | localStorage `cbdc.shared.v1`-এ seed করা dummy data | RTDB `onValue` থেকে লাইভ ডেটা |
  | BroadcastChannel + localStorage cross-page sync | RTDB realtime listener (সব ট্যাব/ডিভাইসে) |
  | `load()` = localStorage read | `load()` = in-memory cache (RTDB-fed) |
  | `save()/update()` = localStorage write | diff-based RTDB `set` / `remove` |

- সব dummy/static seed data রিমুভ করা হয়েছে।
- পাসওয়ার্ড রিসেট Firebase Authentication-এর built-in reset link; password change
  = re-auth + `updatePassword`।

## ৪. 🖼️ Image System (ImgBB API)

ছবি **Firebase Storage-এ নয়** — ImgBB API-তে upload হয় এবং ডাটাবেসে শুধু **link +
metadata** সেভ হয়।

**Flow:**
1. User/Admin ছবি select করে।
2. `src/lib/imgbb.ts` → `uploadImage(file)` → canvas-এ compress/resize → ImgBB
   `POST https://api.imgbb.com/1/upload` (multipart: `key` + `image`)।
3. ImgBB থেকে `url` / `thumbUrl` / `deleteUrl` ফেরত আসে।
4. শুধু সেই **link + metadata** Realtime Database-এ সেভ হয় (`gallery` node-এ
   `url`/`imageUrl`/`thumbUrl`, `donors`/`accounts`-এ `photo` URL ইত্যাদি)।
5. UI-তে ওই link দিয়ে **সরাসরি ছবি** render হয়।

**যেখানে ImgBB ব্যবহার হয়:**
- Admin/Moderator → গ্যালারিতে ছবি যোগ (link + title + status → RTDB `gallery`)
- Admin/Moderator → প্রোফাইল ছবি
- Doner → প্রোফাইল ছবি

**ImgBB API key-এর উৎস (priority ক্রমে):**
1. localStorage cache (`cbdc.imgbb.key`)
2. RTDB `settings/imgbb` (Admin Settings থেকে save — সব পেজ/browser-এ শেয়ার)
3. build-time env `VITE_IMGBB_API_KEY` (fallback)

> ⚠️ ImgBB key client-side (public) থাকে — এটা ImgBB-র স্বাভাবিক মডেল। key লিক হলে
> কেউ আপনার ImgBB quota ব্যবহার করতে পারে; তাই প্রোডাকশনে ImgBB account-এর
> monthly quota খেয়াল রাখুন।

## ৫. Realtime Database Structure

প্রতিটি top-level node একটি map: `donors/{id} = {...}`। কোড পড়ার সময় সেটি
`{ id, ...value }` array-তে রূপান্তর করে (`src/lib/rtdb.ts` → `snapToList`)।

| Node | Key | Fields | Access |
| --- | --- | --- | --- |
| `donors` | donor id (`CBDC-2026-0001`) | name, bloodGroup, gender, **dob**, phone, whatsapp, area, lastDonationDate, donations, totalDonations, status, available, verified, suspended, joined, occupation, ownerUid, photo (ImgBB URL) | public read; admin/moderator write; **owner update (নিজের তথ্য, protected ফিল্ড বাদ) ও owner delete** |
| `_meta` | counter | `donorCounter/<year>` — পরবর্তী ধারাবাহিক Donor UID-এর atomic counter | public read; authenticated increment |
| `requests` | push id | patientName, bloodGroup, bags, urgency, status, workflowStatus, hospitalName, hospitalAddress, requesterName, phone, whatsapp, **patientDob**, createdAt, expiresAt, responders | anyone can create; public read; staff manage |
| `members` | push id | donor sign-up application (status `pending`, **dob**) | anyone can create; owner/staff read |
| `users` | **auth uid** | uid, name, username, email, phone, **dob**, gender, area, photoURL, provider, role, status, createdAt, **applicationCount**, `data:{donations,mine,notifs,activity,panel}` — `data/panel`-এ Admin/Moderator প্যানেলের নিজের সেটিংস (security/privacy/notif/prefs), সেশন ও কার্যকলাপ | owner + staff; `approved` donorStatus admin-only |
| `admins` | **auth uid** | email, role (`admin`/`moderator`), permissions[], name, username, designation | own read; admin write |
| `queue` | record id | kind (`donor`/`request`/`donation`), name, group, area, **dob**, phone, … | create খোলা (নতুন আবেদনের জন্য); পড়া/সম্পাদনা staff only |
| *(notification)* | — | Notification **RTDB-তে সংরক্ষিত হয় না** — আলাদা website notification storage (browser localStorage `cbdc.notifications.v1`) | — |
| `gallery` | image id | title, caption, url (ImgBB link), imageUrl, thumbUrl, status, order | public read; staff write |
| `notices` | notice id | title, body, audience, status, from, to | public read; staff write |
| `accounts` | account id | panel/team account records | staff only |
| `audit` | entry id | প্যানেলের অডিট লগ — at, who, role, act, target, mod | staff read; staff শুধু নতুন entry append করতে পারে (edit নেই), delete শুধু admin |
| `messages` | message id | ওয়েবসাইটের যোগাযোগ বার্তা — name, phone, text, read, at | staff read; authenticated create, staff manage (read-flag) |
| `reports` | report id | ডোনার প্যানেলের "সমস্যা জানান" রিপোর্ট — ownerUid, uid, name, username, email, type, text, screenshot (ImgBB URL), status (`open`/`resolved`), createdAt | staff read/manage; ব্যবহারকারী শুধু **নিজের** রিপোর্ট তৈরি/পড়া/মুছতে পারে |
| `settings` | `app` (public read), `$other` (staff read / admin write) | `app:{rules:{donorApproval,donationApproval,emergencyApproval,bloodGroupApproval,reqApproval},autoApproveEmergency}` — অন্য child (যেমন legacy `imgbb`) শুধু staff পড়তে পারে | `app`: public read; বাকি সব: staff read / admin write |

> **গুরুত্বপূর্ণ:**
> - `users/{uid}` ও `admins/{uid}`-এর key **Firebase Auth uid** — Security Rules
>   ওই uid দিয়েই role যাচাই করে (`root.child('admins').child(auth.uid)`)।
> - **বয়স কোথাও সংরক্ষিত হয় না।** শুধু `dob` (জন্ম তারিখ, `YYYY-MM-DD`) রাখা হয়,
>   আর বয়স প্রতিবার `src/lib/age.ts` → `ageFromDob()` দিয়ে হিসাব করা হয় —
>   ফলে বয়স কখনো পুরোনো হয় না।

### অনুমোদন ও সেটিংস (Admin Panel → নিয়ন্ত্রণ → অনুমোদন ও সেটিংস)

চারটি সুইচ — প্রতিটি বদলালেই সাথে সাথে RTDB `settings/app/rules`-এ সেভ হয় ও live
listener-এর মাধ্যমে সব প্যানেল/ওয়েবসাইটে কার্যকর হয় (কোনো reload লাগে না):

| সুইচ | RTDB key | ON | OFF |
| --- | --- | --- | --- |
| ডোনার আবেদন | `donorApproval` | নতুন Donor Application approval queue-এ যায় | আবেদন সরাসরি অনুমোদিত (staff হলে সরাসরি RTDB-তে; নইলে pending queue) |
| রক্তদান যাচাই | `donationApproval` | রক্তদান ভেরিফিকেশন queue-এ যায় | রক্তদান সরাসরি যাচাইকৃত (`ok:true`) — queue-তে যায় না |
| জরুরি আবেদন | `emergencyApproval` | জরুরি আবেদন approval queue-এ যায় | আবেদন সরাসরি প্রকাশিত |
| গ্রুপ বদল | `bloodGroupApproval` | গ্রুপ পরিবর্তন queue-এ যায় | গ্রুপ সরাসরি বদলে যায় (staff হলে সরাসরি RTDB-তে; নইলে pending queue) |

### ডোনার ব্যবস্থাপনা ↔ ডোনার আইডি ব্যবস্থাপনা — নিরাপদ সার্ভার ডিলিট

> ওয়েবসাইটে শুধুই **Firebase Realtime Database** ও **Firebase Authentication**
> ব্যবহৃত হয়। **Firebase Storage ব্যবহার করা হয় না** — ছবি ImgBB-এ থাকে,
> তাই ডিলিট সিস্টেমে কোনো Storage dependency নেই।

**দুটি স্বাধীন entity:**

| স্ক্রিন | দেখায় | Delete scope | সার্ভার যেটি মোছে |
| --- | --- | --- | --- |
| ডোনার ব্যবস্থাপনা | শুধু **Website/Firebase অ্যাকাউন্ট-ওয়ালা** ডোনার (`users/{uid}` আছে) | `account` | `users/{uid}` · `admins/{uid}` · `accounts/*` — **ডোনার আইডি অক্ষত** |
| ডোনার আইডি ব্যবস্থাপনা | **সব** ডোনার আইডি (`donors/{donorId}`) — অ্যাকাউন্ট ছাড়াও | `donor` | `donors/{donorId}` · `members/*` · `queue/*` — **অ্যাকাউন্ট অক্ষত** |

Flow: **Select (checkbox → শুধু নির্বাচন) → Confirmation → POST
`<base>api/admin/delete` (Bearer Firebase ID token) → server: token verify →
admin role verify → identity verify → RTDB delete → Success → Realtime UI Update**

**১. কেন সার্ভার-সাইড (ব্রাউজার আর কিছু মোছে না)**
`src/lib/accountDelete.ts` শুধু authenticated অনুরোধ পাঠায়। একমাত্র deletion
engine `server/deleteApi.ts` — ওই একই logic চলে:
- production → **Cloudflare Worker** (`server/index.ts`; `wrangler.jsonc` → `main`),
- `vite dev` → Vite middleware (`vite.config.ts` → `cbdcDeleteApi`) — build/preview-এ নেই।

**২. নিরাপত্তা সার্ভার-সাইড (কোথাও কোনো private key নেই)**
- ID token যাচাই: Firebase Identity Toolkit `accounts:lookup` (শুধু public web API key),
- `admins/{uid}/role === 'admin'` (এবং disabled নয়) — মডারেটর/ডোনার 403,
- প্রতিটি RTDB read/write client-এর token দিয়ে (`?auth=<token>`) → **RTDB Security
  Rules-ই** দ্বিতীয় স্তরের সুরক্ষা,
- নিজের অ্যাকাউন্ট delete → 400; ভুল UID → 400; অজানা Donor ID → 404;
  ভুল/অমিল identity → কিছুই মোছা হয় না,
- **Firebase Authentication (লগইন) account মোছা যায় না** — Admin SDK/private key
  ছাড়া সম্ভব নয়; তাই success-এর সাথে স্পষ্ট warning দেওয়া হয়
  (Console → Authentication থেকে মুছতে হবে)। কোনো মিথ্যে সাফল্য নয়।

**৩. Realtime** — server-এর multi-path delete-এর পর existing listener-ই donor list,
donor count, dashboard পরিসংখ্যান ও উভয় ব্যবস্থাপনা স্ক্রিন সাথে সাথে আপডেট করে;
**page reload বা পুরো ডেটাবেস রিলোড লাগে না**; কোনো নতুন listener যোগ হয় না।

**৪. UI (দুই স্ক্রিন, ডিজাইন অপরিবর্তিত)**
- একই কার্ড/পঙ্‌ক্তি ডিজাইন; কোনো আলাদা "দেখুন" বাটন নেই,
- কার্ড/পঙ্‌ক্তির অন্য অংশে ক্লিক → বিদ্যমান ডোনার প্রোফাইল (`openDonor`),
- চেকবক্সে ক্লিক → শুধু নির্বাচন/বাতিল (`stopPropagation`) — প্রোফাইল খোলে না,
- একক ও bulk ডিলিট, প্রতিটির আগে confirmation; প্রতিটি entity আলাদাভাবে সার্ভারে যাচাই হয়।

Deploy: `npm run build` → `npx wrangler deploy` (Worker + assets) অথবা শুধু
`firebase deploy --only database` (rules)। Authorization delete-এর জন্য কোনো
Admin SDK নেই — তাই লগইন account মুছতে হলে Firebase Console → Authentication।

### নিরাপত্তা স্থাপত্য (কোনো secret frontend-এ নেই)

| বিষয় | কীভাবে |
| --- | --- |
| Firebase service | শুধু Realtime Database + Authentication (Firestore/Storage নয়) |
| Admin SDK / service account | কোথাও নেই — client-এও না, সার্ভারেও না (Worker শুধু public API key + client token) |
| অন্য user-এর Auth delete | ব্রাউজার থেকে সম্ভব নয় (Firebase নিরাপত্তা) → RTDB মোছা হয় + স্পষ্ট warning; Firebase Console থেকে Auth account মুছতে হয় |
| ছবি আপলোড (ImgBB) | সরাসরি ImgBB API — key মূলত RTDB `settings/imgbb`-এ (admin লেখে), source/bundle-এ কোনো literal নেই |
| `VITE_*` env | bundle-এ inline হয় → কোনো third-party secret এখানে রাখা যাবে না |
| `import.meta.env` | পুরো অবজেক্ট না পড়ে শুধু নির্দিষ্ট public key (`src/lib/firebase.ts` → `publicEnv()`) |
| localStorage | production data-এর উৎস নয় — RTDB-ই single source of truth (cache শুধু `vite dev`-এ) |
| RTDB rules | private node-এ auth + staff/owner check; public read শুধু ওয়েবসাইটের node-এ |

### Image flow (ImgBB — অপরিবর্তিত)

```
Image Upload → ImgBB → Image URL → Firebase Realtime Database
```

Profile / donor / gallery / notice / donation proof / report screenshot — সব ছবি ImgBB-তে
upload হয়; ImgBB থেকে পাওয়া URL + metadata RTDB-এ সেভ হয়। Website · Donor · Admin ·
Moderator Panel সব জায়গায় RTDB-এর সংরক্ষিত ImgBB URL ব্যবহার করে ছবি দেখানো হয়।
Firebase Storage ব্যবহার করা হয় না, এবং এই flow-এ কোনো Cloud Function নেই।

### Host-independent deploy

কোডে কোনো host-নির্দিষ্ট path নেই। Root deploy → ডিফল্ট `base: "/"`; sub-directory হোস্টিং →
`VITE_BASE=/cbdc/` env। Firebase Hosting · Cloudflare Pages (`wrangler.jsonc`, SPA rewrite) ·
Netlify · Vercel — যেকোনো static host-এ `dist/` serve করলেই চলে।

> ⚠️ **নিরাপদ ডিলিট endpoint** শুধু সেই host-এ কাজ করে যেখানে সার্ভার-সাইড
> endpoint আছে: Cloudflare Workers (`npm run build && npx wrangler deploy`) অথবা
> `vite dev` (development middleware)। শুধু static host (Firebase Hosting ইত্যাদি)-এ
> ডিলিট করলে স্পষ্ট ত্রুটি বার্তা দেখানো হয় — ডেটা মোছা হয় না।

## ৬. Firebase Authentication

| কাজ | Implementation |
| --- | --- |
| Register (email/password) | `createUserWithEmailAndPassword` + RTDB `users/{uid}`; donor application আলাদা ভাবে Doner Panel থেকে pending queue-এ যায় |
| Register (Google) | লগইনের সাথে **একই** ফ্লো — `signInWithPopup` (ডেস্কটপ) / `signInWithRedirect` fallback; নতুন হলে বিদ্যমান নিবন্ধন ফর্মে যায়, আগে থেকে অ্যাকাউন্ট থাকলে ডুপ্লিকেট ছাড়াই সরাসরি লগইন |
| Login | `signInWithEmailAndPassword` (username/phone দিলে RTDB `users` থেকে email resolve); Google — একই ফ্লো |
| Logout | `signOut` (Home-এর লগইন গেট + Doner `doLogout`) |
| Session | `browserLocalPersistence` + **একটিমাত্র** `onAuthStateChanged` (`src/lib/authState.ts`); Home / Doner / Admin / Moderator সবাই সেই shared subscriber ব্যবহার করে — duplicate listener নেই। রিলোডের পরেও সেশন থাকে |
| Password reset | Firebase built-in reset link + সাইটের নিজস্ব `/forgot-password` ও `/reset-password` full-page UI (দেখুন `docs/PASSWORD_RESET_EMAIL.md`) |
| Change password | `reauthenticateWithCredential` + `updatePassword` |

## ৭. Role ও Permission (ডাটাবেস-নিয়ন্ত্রিত)

role নির্ধারণের **একমাত্র জায়গা** `src/lib/authx.ts` → `resolveUserRole()`:

1. RTDB `admins/{uid}` — staff রেকর্ড (uid দিয়ে)
2. না পেলে `admins` node-এ email দিয়ে খোঁজা
3. তাও না পেলে → `donor`

`users` node-এ `role:"admin"` লেখা থাকলেও তা **গ্রাহ্য নয়** — `admins`-ই একমাত্র
কর্তৃপক্ষ (নিরাপত্তা)।

Website-এ role শুধুমাত্র ৩টি: **Admin** (Full Access), **Moderator**, **Doner**। আলাদা কোনো Super Admin role নেই।

**কে কোথায় যাবে** — `panelForRole()`:

| RTDB role | পেজ |
| --- | --- |
| `admin` | `/admin` — Admin Panel (Full Access) |
| `moderator` / `mod` | `/moderator` — Moderator Panel |
| অন্য সব (`donor`) | `/doner` — Doner Dashboard |

- লগইন/সাইনআপ শেষে `finishLogin()` এই ম্যাপ ধরেই সরাসরি নিজ dashboard-এ পাঠায়
  (কোনো success popup ছাড়াই)।
- প্রতিটি প্যানেল boot-এ নিজেই আবার যাচাই করে: ভুল প্যানেলে ঢুকলে ব্যবহারকারীকে
  তার নিজের dashboard-এ সরিয়ে দেওয়া হয়। **Admin/Moderator কখনোই সাধারণ Doner
  dashboard ব্যবহার করে না**, এবং উল্টোটাও নয়।
- **Permission**: Admin সব permission পায়। Moderator সীমিত moderation কাজ করতে পারে;
  donor application approve করে public `donors` node-এ যোগ করার ক্ষমতা Admin ও
  Moderator উভয়েরই আছে (Security Rules-এ `admins/{uid}/role` দিয়ে যাচাই)।
- Security Rules-এও একই যাচাই আছে (দেখুন `database.rules.json`)।

### Donor application flow

1. নতুন account তৈরি/login করলে user শুধু Doner role-এ থাকে — auto donor হয় না এবং কোনো Donor UID তৈরি হয় না।
2. Doner Panel → “রক্তদাতা হিসেবে যুক্ত হন” থেকে আবেদন করলে সেটি `queue`-এ `pending` থাকে (Donor UID তখনো তৈরি হয় না)।
3. Admin approve করলে তবেই `donors/{donorId}` তৈরি হয়। সেখানে `donorId`-টি **আবেদন approve হওয়ার সিরিয়াল অনুযায়ী** তৈরি হয় (`CBDC-<year>-0001`, `0002`, …) — account তৈরির সময় নয়।
4. `users/{uid}/donorId` তখনই approval-এর সময় set হয় এবং স্থায়ী থাকে (পরবর্তী login/update-এ পরিবর্তন হয় না)।
5. `users/{uid}/donorStatus` user নিজে `approved` করতে পারে না; Security Rules-এ এটি Admin-only।

### Staff account তৈরি

Firebase Console → Authentication-এ user তৈরি করুন, তারপর Realtime Database-এ:

```
admins/<auth-uid>
{
  "email": "staff@cbdc.org",
  "role": "admin",            // "admin" | "moderator" | "mod"
  "permissions": [],           // ঐচ্ছিক — না দিলে role-ভিত্তিক ডিফল্ট
  "name": "শাহাদাত আহমেদ",
  "username": "shahadat",
  "designation": "সাধারণ সম্পাদক"
}
```

লেখামাত্রই ব্যবহারকারী পরের লগইনে (বা রিফ্রেশে) নতুন প্যানেল পাবেন — কোনো
কোড deploy লাগে না।

## ৮. Security Rules deploy

```bash
# Firebase CLI ইনস্টল + লগইন (একবার)
npm i -g firebase-tools
firebase login

# Rules deploy (Realtime Database — Firestore/Storage ব্যবহৃত হয় না)
firebase deploy --only database

# (ঐচ্ছিক) hosting deploy — production build প্রথমে
npm run build
firebase deploy --only hosting

# নিরাপদ ডিলিট endpoint-সহ পুরো সাইট — Cloudflare Workers (দেখুন wrangler.jsonc)
npm run build
npx wrangler deploy
```

`database.rules.json`-এ যা যা আছে:

- `donors` / `requests` / `gallery` / `notices` — public read (পাবলিক ওয়েবসাইটের জন্য)।
- `donors/{id}` — **owner update**: ডোনার নিজের public record-এর নিজস্ব তথ্য
  (name, gender, dob, area, phone, bloodGroup, whatsapp, lastDonationDate, available, photo)
  আপডেট করতে পারে — RTDB live listener-এর মাধ্যমে সাথে সাথে মেইন ওয়েবসাইট ও সব
  প্যানেলে দেখা যায়, কোনো refresh লাগে না। Admin-নিয়ন্ত্রিত ফিল্ড
  (donorId/verified/suspended/donations/status/…) `.validate`-এ রক্ষিত —
  owner পরিবর্তন করতে পারে না। owner নিজের record delete-ও করতে পারে
  (ডোনার তালিকা থেকে সরে যাওয়া)।
- `members` / `requests` / `queue` — নতুন রেকর্ড তৈরি খোলা (রেজিস্ট্রেশন ও ইমারজেন্সি
  আবেদন), কিন্তু পড়া/সম্পাদনা মালিক বা staff ছাড়া বন্ধ।
- `users/{uid}` — owner read/write; staff full access; `role` ফিল্ড শুধু Admin বদলাতে পারে; `donorStatus:"approved"` শুধু Admin লিখতে পারে।
- **Notification System — RTDB-তে নয়:** Notification মূল Firebase Realtime Database-এ
  সংরক্ষিত হয় না। এগুলো **আলাদা Website Notification Data/Storage**-এ থাকে
  (browser localStorage, `cbdc.notifications.v1` — `src/lib/notify.ts`)। RTDB শুধু
  source data দেয়: ডোনার প্যানেল RTDB-র live পরিবর্তন (আবেদন approved/rejected,
  নতুন matching জরুরি আবেদন, ডোনার আবেদন/গ্রুপ/রক্তদান-যাচাই) দেখে notification
  তৈরি করে — তাই real-time দেখা যায়, কিন্তু notification নিজে RTDB-তে লেখা হয় না।
  প্রতিটি notification-এর `expiresAt` = তৈরির ২৪ ঘণ্টা পর; তখন এটি **এই আলাদা
  storage থেকেও** স্বয়ংক্রিয়ভাবে মুছে যায় (pruneExpired)। ফলে notification
  auto-clear করলে main RTDB-র Donor/আবেদন/অন্যান্য ডাটার কোনো প্রভাব পড়ে না।
  কোনো hardcoded/demo notification নেই।
- `admins/{uid}` — নিজের রেকর্ড পড়া যায়; লেখা শুধু Admin।
- `accounts` — staff only।
- `settings` — public read (ImgBB client key), staff write।
- `.indexOn` — যেসব ফিল্ডে খোঁজা হয় (`email`, `username`, `phone`, `status` …) সেগুলোতে
  index দেওয়া আছে, তাই query দ্রুত চলে ও কনসোলে warning আসে না।

## ৯. Environment Variables

Client-side Firebase config public থাকে (API key গোপন নয় — Security Rules-ই আসল guard)।
চাইলে Vite env ব্যবহার করা যাবে:

```bash
VITE_IMGBB_API_KEY=...   # ImgBB fallback key (build-time)
```

`src/lib/imgbb.ts`-এ `import.meta.env.VITE_IMGBB_API_KEY` পড়া হয় (সবচেয়ে কম priority)।

চাইলে পুরো Firebase config-ও env দিয়ে override করা যায় — তখন **সবগুলো required
ভ্যারিয়েবল একসাথে** দিতে হবে (`VITE_FIREBASE_DATABASE_URL` সহ)। বিস্তারিত `.env.example`-এ।

## ১০. আরও ডকুমেন্ট

- `docs/PASSWORD_RESET_EMAIL.md` — Firebase password reset ইমেইলকে সাইটের ডিজাইনে
  ব্র্যান্ড করা (কপি-পেস্ট করার মতো template HTML সহ)।
- `docs/GOOGLE_LOGIN_BRANDING.md` — Google "Choose an account" স্ক্রিনে অ্যাপের নাম
  **Chawkbazar Blood Donor's Club** ও অফিশিয়াল লোগো দেখানোর ধাপ।
