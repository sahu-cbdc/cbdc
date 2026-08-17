# 📝 সোর্স কোড ব্যবহার, Edit ও Update গাইড

এই গাইডে দেখানো হয়েছে — কীভাবে **UI ডিজাইন না বদলে** সহজে Text, Logo, যোগাযোগের তথ্য,
Firebase config ইত্যাদি পরিবর্তন করবেন, এবং ভবিষ্যতে কীভাবে সহজে fix/upgrade করবেন।

---

## ১. প্রজেক্ট স্ট্রাকচার (এক নজরে)

```
src/
├── config/
│   └── site.ts          ★ সাইটের সব কেন্দ্রীয় Text এখানে (সবচেয়ে বেশি edit হবে)
├── lib/
│   ├── firebase.ts      Firebase config (project id ইত্যাদি)
│   ├── imgbb.ts         ImgBB image hosting helper
│   └── store.ts         Firestore data layer (সাধারণত edit লাগে না)
├── pages/
│   ├── Home.tsx         পাবলিক ওয়েবসাইট + লগইন
│   ├── Doner.tsx        ডোনার (রক্তদাতা) প্যানেল
│   ├── Admin.tsx        অ্যাডমিন প্যানেল
│   └── Moderator.tsx    মডারেটর প্যানেল
├── main.tsx / main-doner.tsx / main-admin.tsx / main-moderator.tsx   (এন্ট্রি)
└── global.d.ts          TypeScript global types

public/
└── img/logo.png         ★ Logo — এই ফাইল replace করলেই পুরো সাইটে নতুন logo

docs/
├── FIREBASE.md          Firebase schema / auth / deploy
└── EDITING.md           ★ (এই ফাইল) edit guide
```

---

## ২. ⭐ যেকোনো Text বদলানো (সবচেয়ে গুরুত্বপূর্ণ)

### ২.১ সাইট-ব্যাপী Text → `src/config/site.ts`

নাম, ট্যাগলাইন, ফোন, WhatsApp, ইমেইল, Facebook, এলাকা, রক্তের গ্রুপ, নিয়ম —
এই সব **এক জায়গায়** `src/config/site.ts`-এ আছে। এখানে একবার বদলালে
**Home + Doner + Admin + Moderator — সব পেজে** বদলে যাবে।

```ts
export const SITE = {
  name: "চকবাজার ব্লাড ডোনার'স ক্লাব",     // ← এখানে বদলান
  phone: "01617725464",                      // ← ফোন বদলান
  whatsapp: "8801617725464",                 // ← WhatsApp বদলান
  email: "cbdc@example.com",                 // ← ইমেইল বদলান
  facebookGroup: "https://...",              // ← গ্রুপ লিংক বদলান
  rules: { minAge: 18, maxAge: 60, interval: 90 },
  // ...
};
```

বদলে `npm run build` চালালেই হয়ে যাবে।

### ২.২ পেজ-নির্দিষ্ট Text (UI কপি)

হোমপেজের হিরো, সেকশন বর্ণনা, বাটন লেবেল, নোটিশ-বার্তা ইত্যাদি page-specific text
সংশ্লিষ্ট `.tsx` ফাইলের ভিতরেই আছে। খুঁজে বদলাতে:

```bash
grep -rn "যে লেখাটা বদলাতে চান" src/pages/
```

> বাংলা/ইংরেজি অনুবাদ জোড়া (i18n dictionary) Doner/Admin/Moderator ফাইলের ভিতরে
> `"বাংলা":"English"` ফরম্যাটে আছে — `grep -n "শব্দ"` দিয়ে পেয়ে যাবেন।

### ২.৩ Logo → `public/img/logo.png`

- ফাইল: **`public/img/logo.png`**
- **শুধু এই ফাইলটি replace করুন** — নতুন logo স্বয়ংক্রিয়ভাবে সর্বত্র (হোম, প্যানেল,
  ডোনার কার্ড) দেখাবে। কোডে কিছু বদলাতে হবে না।
- (মনে রাখুন: আগে `legacy/`-এর base64 logo ছিল, এখন সব `img/logo.png` পড়ে।)

### ২.৪ Theme

- Default = **Light** (সব পেজে)।
- User Panel (Doner) ও Admin/Moderator Panel → Settings → চেহারা → থিম-এ ম্যানুয়াল
  Light/Dark toggle আছে।

---

## ৩. ⚙️ Backend / Config বদলানো

### ৩.১ Firebase project (config)

`src/lib/firebase.ts` → `firebaseConfig`:

```ts
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "chokbazarbloodclub-69d5f",   // ← নতুন project হলে এখানে বদলান
  // ...
};
```

### ৩.২ ImgBB API key

- Admin Panel → Settings → সংযোগ → **ImgBB API কী** ঘরে বসিয়ে "সংরক্ষণ করুন"।
- এটা Firestore `settings/imgbb`-এ সেভ হয় (সব পেজ/browser-এ শেয়ার)।
- বিকল্প: build-time env `VITE_IMGBB_API_KEY` (fallback)।

### ৩.৩ Database (Firestore — RTDB নয়)

**সিদ্ধান্ত:** এই অ্যাপ **শুধু Cloud Firestore** ব্যবহার করে। Realtime Database (RTDB)
ব্যবহৃত হয় না — কারণ:

- Data structured + query-heavy (`where status=="approved"`, `where email`, `orderBy`)
  — Firestore-ই এর জন্য সঠিক টুল।
- Firestore-এর `onSnapshot` দিয়েই real-time update পাওয়া যাচ্ছে।
- RTDB শুধু high-frequency ছোট লেখার (presence/typing/counter) জন্য ভালো — এই অ্যাপে
  দরকার নেই, আর যোগ করলে আলাদা sync + cost + জটিলতা বাড়ে।

কোনো Firebase Storage-ও ব্যবহৃত হয় না (ছবি → ImgBB, link Firestore-এ)।

---

## ৪. 🚀 Build / Run / Deploy

```bash
npm install
npm run dev        # dev server — http://localhost:5173
npm run build      # production build → dist/ (যেকোনো স্ট্যাটিক হোস্টে upload করুন)
npm run preview    # production preview
npm run smoke      # ৪টি পেজ render + logic চেক (jsdom)
```

Firebase deploy:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
npm run build && firebase deploy --only hosting
```

---

## ৫. 🔧 ভবিষ্যতে fix/upgrade সহজ করার টিপস

- **সব ব্র্যান্ড/কনটেন্ট** `src/config/site.ts`-এ → এক জায়গায় বদলান।
- **প্রতি পেজ স্বয়ংসম্পূর্ণ**: প্রতিটি `.tsx`-এ নিজের CSS + UI + logic — একটা পেজের
  বদল অন্য পেজে প্রভাব ফেলে না।
- **Data layer আলাদা**: `src/lib/store.ts` (Firestore), `src/lib/firebase.ts` (config),
  `src/lib/imgbb.ts` (ছবি) — UI থেকে data আলাদা, তাই backend বদলানো সহজ।
- **একটা জিনিস ভাঙলে চেক:** `npm run build` + `npm run smoke` চালান — syntax/runtime
  সমস্যা ধরা পড়বে।
- **নতুন পেজ যোগ করতে:** `src/pages/`-এ নতুন `.tsx` কম্পোনেন্ট → `src/lib/router.ts`-এ
  `PageName`-এ নাম যোগ করুন → `src/main.tsx`-এর `ActivePage()`-এ lazy import + case
  যোগ করুন (আলাদা `.html` এন্ট্রি আর নেই — শুধু index.html)।

---

## ৬. UI ডিজাইন বদলাবেন না (গুরুত্বপূর্ণ নোট)

- CSS প্রতিটি পেজের ভিতরে `pageCss` ভেরিয়েবলে আছে (মূল HTML-এর হুবহু কপি)।
- শুধু Text বদলাতে `src/config/site.ts` বা পেজের ভিতরের string edit করুন — **CSS/class/
  structure স্পর্শ করবেন না**।
- Logo বদলাতে শুধু `public/img/logo.png` replace করুন (মাপ মোটামুটি square রাখলে সব
  জায়গায় ভালো দেখাবে)।
