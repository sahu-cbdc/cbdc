# Firebase Integration — CBDC

এই ডকুমেন্টে Firebase-এর সাথে পুরো প্রজেক্ট কীভাবে যুক্ত হয়েছে, Database
structure, Authentication flow, Role & Permission model, **Image system (ImgBB)**
এবং Security Rules deploy করার ধাপগুলো বর্ণনা করা হয়েছে।

---

## ১. Backend সেবা (কী কী ব্যবহার হয়)

| কাজ | সার্ভিস |
| --- | --- |
| Authentication (register/login/logout/session) | Firebase Authentication |
| Structured data + complex query + realtime | Cloud Firestore (primary source of truth) |
| Image hosting | **ImgBB API** (Firebase Storage ব্যবহার হয় **না**) |

> Realtime Database (RTDB) প্রয়োজন অনুযায়ী পরে যোগ করা যেতে পারে (presence,
> live counters ইত্যাদি) — এখনকার অ্যাপে Firestore `onSnapshot`-ই realtime দেয়।

## ২. কনফিগারেশন

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

## ৩. Data Layer আর্কিটেকচার

- **`src/lib/firebase.ts`** — একক Firebase instance (App / Auth / Firestore)। **Storage নয়।**
- **`src/lib/store.ts`** — `window.CBDCShared` API-র Firestore-backed port। এটিই এখন
  **একমাত্র data source**:

  | আগে (demo) | এখন (Firebase) |
  | --- | --- |
  | localStorage `cbdc.shared.v1`-এ seed করা dummy data | Firestore `onSnapshot` থেকে লাইভ ডেটা |
  | BroadcastChannel + localStorage cross-page sync | Firestore realtime listener + offline cache |
  | `load()` = localStorage read | `load()` = in-memory cache (Firestore-fed) |
  | `save()/update()` = localStorage write | diff-based Firestore `setDoc`/`deleteDoc` |

- সব dummy/static seed data রিমুভ করা হয়েছে।
- পাসওয়ার্ড রিসেট Firebase Authentication-এর `sendPasswordResetEmail`; password change
  = re-auth + `updatePassword`।

## ৪. 🖼️ Image System (ImgBB API)

ছবি **Firebase Storage-এ নয়** — ImgBB API-তে upload হয় এবং ডাটাবেসে শুধু **link +
metadata** সেভ হয়।

**Flow:**
1. User/Admin ছবি select করে।
2. `src/lib/imgbb.ts` → `uploadImage(file)` → canvas-এ compress/resize → ImgBB
   `POST https://api.imgbb.com/1/upload` (multipart: `key` + `image`)।
3. ImgBB থেকে `url` / `thumbUrl` / `deleteUrl` ফেরত আসে।
4. শুধু সেই **link + metadata** Firestore-এ সেভ হয় (`gallery` collection-এ
   `url`/`imageUrl`/`thumbUrl`, `donors`/`accounts`-এ `photo` URL ইত্যাদি)।
5. UI-তে ওই link দিয়ে **সরাসরি ছবি** render হয়।

**যেখানে ImgBB ব্যবহার হয়:**
- Admin → গ্যালারিতে ছবি যোগ (link + title + status → Firestore `gallery`)
- Admin/Moderator → প্রোফাইল ছবি
- Doner → প্রোফাইল ছবি

**ImgBB API key-এর উৎস (priority ক্রমে):**
1. localStorage cache (`cbdc.imgbb.key`)
2. Firestore `settings/imgbb` doc (Admin Settings থেকে save — সব পেজ/browser-এ শেয়ার)
3. build-time env `VITE_IMGBB_API_KEY` (fallback)

> ⚠️ ImgBB key client-side (public) থাকে — এটা ImgBB-র স্বাভাবিক মডেল। key লিক হলে
> কেউ আপনার ImgBB quota ব্যবহার করতে পারে; তাই প্রোডাকশনে ImgBB account-এর
> monthly quota খেয়াল রাখুন।

## ৫. Firestore Database Structure

| Collection | Doc ID | Fields | Access |
| --- | --- | --- | --- |
| `donors` | donor id (`CBDC-2026-XXXX`) | name, bloodGroup, gender, age, phone, whatsapp, area, lastDonationDate, donations, totalDonations, status, available, verified, suspended, joined, occupation, ownerUid, photo (ImgBB URL) | approved = public read; staff = full |
| `requests` | request id | patientName, bloodGroup, bags, urgency, status, workflowStatus, hospitalName, hospitalAddress, requesterName, phone, whatsapp, createdAt, expiresAt, responders | anyone can create; approved = public read; staff = full |
| `members` | auto id | donor sign-up application (status: `pending`) | anyone can create; staff = read/manage |
| `users` | **auth uid** | name, username, email, phone, uid, photoURL (ImgBB URL), provider, role, status, createdAt | owner + staff |
| `admins` | **auth uid** | email, role (`admin`/`super`/`moderator`/`mod`), permissions[], name, username, designation | own read; console/Admin SDK write |
| `queue` | queue id (`PD-*`, `REQ-*`, `DN-*`, `GC-*`, `RP-*`) | kind, name, group, area, phone, … (moderation queue) | staff only |
| `gallery` | image id | title, caption, url (ImgBB link), imageUrl, thumbUrl, status, order | published = public read; staff = full |
| `notices` | notice id | title, body, audience, status, from, to | published = public read; staff = full |
| `accounts` | account id | panel/team account records | staff only |
| `settings` | `imgbb` | `{ key, updatedAt }` — ImgBB API key | public read (client key); staff write |

> **গুরুত্বপূর্ণ:** `users/{uid}` ও `admins/{uid}` doc ID **Firebase Auth uid**-তে
> কী করা হয় — Security Rules ওই uid দিয়েই role যাচাই করে। Signup-এ
> `setDoc(doc(db,"users", uid), ...)` ব্যবহার করা হয়েছে।

## ৬. Firebase Authentication

| কাজ | Implementation |
| --- | --- |
| Register (email/password) | `createUserWithEmailAndPassword` + `users` ও `members`-এ লেখা |
| Register (Google) | `signInWithPopup` + GoogleAuthProvider |
| Login | `signInWithEmailAndPassword` (username/phone দিলে `users` থেকে email resolve) |
| Logout | `signOut` (Home-এর লগইন গেট + Doner `doLogout`) |
| Session | `onAuthStateChanged` (Home, Doner, Admin, Moderator — সব পেজে) |
| Password reset | `sendPasswordResetEmail` (Home + Doner + Admin/Moderator) |
| Change password | `reauthenticateWithCredential` + `updatePassword` |

## ৭. Role ও Permission (Firebase-নিয়ন্ত্রিত)

- **Role resolve** (Home-এ লগইনের সময়): `admins` collection-এ `where("email","==",email)`
  query করে role বের করা হয় — `admin`/`super` → `/admin`, `moderator`/`mod` → `/moderator`,
  নাহলে donor (ওয়েবসাইটেই থাকে)।
- **Admin/Moderator panel gate**: `onAuthStateChanged` → Firebase user → `admins/{uid}`
  থেকে role/permissions → role না মিললে `index.html`-এ redirect।
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

## ৮. Security Rules deploy

```bash
# Firebase CLI ইনস্টল + লগইন (একবার)
npm i -g firebase-tools
firebase login

# Rules deploy (শুধু Firestore — Storage ব্যবহৃত হয় না)
firebase deploy --only firestore:rules

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
- `settings` — public read (ImgBB key), staff write।

## ৯. Environment Variables

Client-side Firebase config public থাকে (API key গোপন নয় — Security Rules-ই আসল guard)।
চাইলে Vite env ব্যবহার করা যাবে:

```bash
VITE_IMGBB_API_KEY=...   # ImgBB fallback key (build-time)
```

`src/lib/imgbb.ts`-এ `import.meta.env.VITE_IMGBB_API_KEY` পড়া হয় (সবচেয়ে কম priority)।
