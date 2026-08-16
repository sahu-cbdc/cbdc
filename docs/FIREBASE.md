# Firebase Integration — CBDC

এই ডকুমেন্টে Firebase-এর সাথে পুরো প্রজেক্ট কীভাবে যুক্ত হয়েছে, Database
structure, Authentication flow, Role & Permission model এবং Security Rules
deploy করার ধাপগুলো বর্ণনা করা হয়েছে।

---

## ১. কনফিগারেশন

Firebase config এক জায়গায় রাখা হয়েছে: **`src/lib/firebase.ts`**।

```ts
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "cbdc-a9418.firebaseapp.com",
  projectId: "cbdc-a9418",
  // ...
};
```

Project: **`cbdc-a9418`** (`.firebaserc`-এও সেট করা আছে)।

## ২. Data Layer আর্কিটেকচার

- **`src/lib/firebase.ts`** — একক Firebase instance (App / Auth / Firestore / Storage)।
- **`src/lib/store.ts`** — `window.CBDCShared` API-র Firestore-backed port। এটিই এখন
  **একমাত্র data source**:

  | আগে (demo) | এখন (Firebase) |
  | --- | --- |
  | localStorage `cbdc.shared.v1`-এ seed করা dummy data | Firestore `onSnapshot` থেকে লাইভ ডেটা |
  | BroadcastChannel + localStorage cross-page sync | Firestore realtime listener + offline cache |
  | `load()` = localStorage read | `load()` = in-memory cache (Firestore-fed) |
  | `save()/update()` = localStorage write | diff-based Firestore `setDoc`/`deleteDoc` |

- সব **dummy/static seed data** রিমুভ করা হয়েছে (store.ts-এর ২০ donor / requests /
  queue / gallery seed, Home-এর `DEMO_DONORS`/`DEMO_REQUESTS`/`DEFAULT_GALLERY`,
  Doner-এর `seedDonors()` ও `PUB_SEED`, Admin/Moderator-এর `seed()` ও `seedAccounts()`)।
- ডেমো OTP / localStorage "demo credentials" (`cbdc.demo.credentials`) সম্পূর্ণ বাদ —
  পাসওয়ার্ড রিসেট এখন Firebase Authentication-এর `sendPasswordResetEmail`।

## ৩. Firestore Database Structure

| Collection | Doc ID | Fields | Access |
| --- | --- | --- | --- |
| `donors` | donor id (`CBDC-2026-XXXX`) | name, bloodGroup, gender, age, phone, whatsapp, area, lastDonationDate, donations, totalDonations, status, available, verified, suspended, joined, occupation, ownerUid, photo | approved = public read; staff = full |
| `requests` | request id | patientName, bloodGroup, bags, urgency, status, workflowStatus, hospitalName, hospitalAddress, requesterName, phone, whatsapp, createdAt, expiresAt, responders | anyone can create; approved = public read; staff = full |
| `members` | auto id | donor sign-up application (status: `pending`) | anyone can create; staff = read/manage |
| `users` | **auth uid** | name, username, email, phone, uid, photoURL, provider, role, status, createdAt | owner + staff |
| `admins` | **auth uid** | email, role (`admin`/`super`/`moderator`/`mod`), permissions[], name, username, designation | own read; console/Admin SDK write |
| `queue` | queue id (`PD-*`, `REQ-*`, `DN-*`, `GC-*`, `RP-*`) | kind, name, group, area, phone, … (moderation queue) | staff only |
| `gallery` | image id | title, caption, imageUrl, url, status, order | published = public read; staff = full |
| `notices` | notice id | title, body, audience, status, from, to | published = public read; staff = full |
| `accounts` | account id | panel/team account records | staff only |

> **গুরুত্বপূর্ণ:** `users/{uid}` ও `admins/{uid}` doc ID **Firebase Auth uid**-তে
> কী করা হয় — Security Rules ওই uid দিয়েই role যাচাই করে। Signup-এ
> `setDoc(doc(db,"users", uid), ...)` ব্যবহার করা হয়েছে।

## ৪. Firebase Authentication

| কাজ | Implementation |
| --- | --- |
| Register (email/password) | `createUserWithEmailAndPassword` + `users` ও `members`-এ লেখা |
| Register (Google) | `signInWithPopup` + GoogleAuthProvider |
| Login | `signInWithEmailAndPassword` (username/phone দিলে `users` থেকে email resolve) |
| Logout | `signOut` (Home-এর লগইন গেট + Doner `doLogout`) |
| Session | `onAuthStateChanged` (Home, Doner, Admin, Moderator — সব পেজে) |
| Password reset | `sendPasswordResetEmail` (Home + Doner + Admin/Moderator) |
| Change password | `reauthenticateWithCredential` + `updatePassword` |

## ৫. Role ও Permission (Firebase-নিয়ন্ত্রিত)

- **Role resolve** (Home-এ লগইনের সময়): `admins` collection-এ `where("email","==",email)`
  query করে role বের করা হয় — `admin`/`super` → `/admin`, `moderator`/`mod` → `/moderator`,
  নাহলে donor (ওয়েবসাইটেই থাকে)।
- **Admin/Moderator panel gate**: `onAuthStateChanged` → Firebase user → `admins/{uid}`
  থেকে role/permissions → role না মিললে `/`-এ redirect।
- **Permission**: panel-এর `can()` এখন `ME.permissions` (Firestore `admins` doc-এর array)
  থাকলে সেটি ব্যবহার করে, না থাকলে role-ভিত্তিক default permission map (`ROLES`)।
- Security Rules-এও role যাচাই করা হয় (দেখুন `firestore.rules`)।

### Staff account তৈরি (কনসোল / Admin SDK)

Firebase Console → Authentication-এ user তৈরি করুন, তারপর Firestore-এ doc:

```
admins/{uid}
{
  "email": "staff@cbdc.org",
  "role": "admin",           // "admin" | "super" | "moderator" | "mod"
  "permissions": [],          // optional — role-based default না হলে
  "name": "শাহাদাত আহমেদ",
  "username": "shahadat",
  "designation": "সাধারণ সম্পাদক"
}
```

## ৬. Security Rules deploy

```bash
# Firebase CLI ইনস্টল + লগইন (একবার)
npm i -g firebase-tools
firebase login

# Rules deploy
firebase deploy --only firestore:rules
firebase deploy --only storage:rules

# (ঐচ্ছিক) hosting deploy — production build প্রথমে
npm run build
firebase deploy --only hosting
```

`firestore.rules`-এ যা যা আছে:

- `donors` / `requests` / `gallery` / `notices` — approved/published ডেটা public read.
- `members` / `requests` — public create (রেজিস্ট্রেশন ও ইমারজেন্সি আবেদন)।
- `users/{uid}` — owner read/write; staff full access।
- `admins/{uid}` — নিজের doc পড়া যায়; client থেকে write বন্ধ (console/Admin SDK)।
- `queue` / `accounts` — staff only।

## ৭. Environment Variables (production hardening)

Client-side Firebase config public থাকে (API key গোপন নয় — Security Rules-ই আসল
guard)। Production-এ চাইলে Vite env ব্যবহার করতে পারেন:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

এবং `src/lib/firebase.ts`-এ `import.meta.env.VITE_FIREBASE_*` থেকে পড়ানো যায়।
