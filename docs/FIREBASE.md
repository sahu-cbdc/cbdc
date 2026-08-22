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
  authDomain: "chokbazarbloodclub-69d5f.firebaseapp.com",
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
- **Google login popup প্রথম পছন্দ; মোবাইল/WebView/পপ-আপ ব্লকে redirect fallback**
  — বাস্তবায়ন `src/lib/authx.ts`-এ (`googleSignInWithFallback` +
  `consumeGoogleRedirect`)। redirect-ফলাফল boot-এ resume হয়।
- **Authorized domains**: Custom/Cloudflare ডোমেইন (যেমন `cbdc.pages.dev`,
  `cbdc.workers.dev` বা নিজস্ব ডোমেইন) থেকে Google লগইন চালাতে সেই ডোমেইন Platform
  console-এর Auth Settings-এ যোগ করতে হয় — না হলে `auth/unauthorized-domain` আসে।
  Console-এর নতুন UI-তে Settings ট্যাব না দেখালে এই সেটিং এখন Google Cloud
  Console → APIs & Services ➜ OAuth consent screen / Identity Toolkit config-এও
  ম্যানেজ করা যায়।
- **API key restriction** দিলে `Identity Toolkit API` ও `Token Service API`
  allowed রাখুন এবং deploy করা ডোমেইনকে HTTP referrer allowlist-এ যোগ করুন।
- ঐচ্ছিক env override (`VITE_FIREBASE_API_KEY` ইত্যাদি) সেট করলে সবগুলোই দিতে হয়;
  আংশিক সেট intentional error-এ ফেলা হয় (ভুল config silent অনুমোদন এড়াতে)।
  RTDB `users/{uid}` প্রোফাইল login/signup-এর পর স্বয়ংক্রিয়ভাবে merge-আপডেট হয়।
- **Google consent screen branding** (App name + logo) — দেখুন
  `docs/GOOGLE_LOGIN_BRANDING.md`।

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
| `users` | **auth uid** | uid, name, username, email, phone, **dob**, gender, area, photoURL, provider, role, status, createdAt, `data:{donations,mine,notifs,activity}` | owner + staff; `approved` donorStatus admin-only |
| `admins` | **auth uid** | email, role (`admin`/`moderator`), permissions[], name, username, designation | own read; admin write |
| `queue` | record id | kind (`donor`/`request`/`donation`), name, group, area, **dob**, phone, … | create খোলা (নতুন আবেদনের জন্য); পড়া/সম্পাদনা staff only |
| *(notification)* | — | Notification **RTDB-তে সংরক্ষিত হয় না** — আলাদা website notification storage (browser localStorage `cbdc.notifications.v1`) | — |
| `gallery` | image id | title, caption, url (ImgBB link), imageUrl, thumbUrl, status, order | public read; staff write |
| `notices` | notice id | title, body, audience, status, from, to | public read; staff write |
| `accounts` | account id | panel/team account records | staff only |
| `settings` | `imgbb`, `app` | `imgbb:{key,updatedAt}`, `app:{autoApproveEmergency}` | public read; staff write |

> **গুরুত্বপূর্ণ:**
> - `users/{uid}` ও `admins/{uid}`-এর key **Firebase Auth uid** — Security Rules
>   ওই uid দিয়েই role যাচাই করে (`root.child('admins').child(auth.uid)`)।
> - **বয়স কোথাও সংরক্ষিত হয় না।** শুধু `dob` (জন্ম তারিখ, `YYYY-MM-DD`) রাখা হয়,
>   আর বয়স প্রতিবার `src/lib/age.ts` → `ageFromDob()` দিয়ে হিসাব করা হয় —
>   ফলে বয়স কখনো পুরোনো হয় না।

## ৬. Firebase Authentication

| কাজ | Implementation |
| --- | --- |
| Register (email/password) | `createUserWithEmailAndPassword` + RTDB `users/{uid}`; donor application আলাদা ভাবে Doner Panel থেকে pending queue-এ যায় |
| Register (Google) | `signInWithPopup` + GoogleAuthProvider |
| Login | `signInWithEmailAndPassword` (username/phone দিলে RTDB `users` থেকে email resolve) |
| Logout | `signOut` (Home-এর লগইন গেট + Doner `doLogout`) |
| Session | `onAuthStateChanged` (Home, Doner, Admin, Moderator — সব পেজে) |
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
```

`database.rules.json`-এ যা যা আছে:

- `donors` / `requests` / `gallery` / `notices` — public read (পাবলিক ওয়েবসাইটের জন্য)।
- `donors/{id}` — **owner update**: ডোনার নিজের public record-এর নিজস্ব তথ্য
  (name, gender, dob, area, phone, whatsapp, lastDonationDate, available, photo)
  আপডেট করতে পারে — RTDB live listener-এর মাধ্যমে সাথে সাথে মেইন ওয়েবসাইট ও সব
  প্যানেলে দেখা যায়, কোনো refresh লাগে না। Admin-নিয়ন্ত্রিত ফিল্ড
  (donorId/verified/suspended/donations/status/bloodGroup/…) `.validate`-এ রক্ষিত —
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
