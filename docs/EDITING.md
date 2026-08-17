# 📝 সোর্স কোড ব্যবহার, Edit ও Update গাইড

এই গাইডে দেখানো হয়েছে — কীভাবে **UI ডিজাইন না বদলে** সহজে Text, Logo, যোগাযোগের তথ্য,
Firebase config ইত্যাদি পরিবর্তন করবেন, এবং ভবিষ্যতে কীভাবে সহজে fix/upgrade করবেন।

---

## ১. প্রজেক্ট স্ট্রাকচার (এক নজরে)

```
src/
├── config/
│   ├── site.ts          ★ সাইটের সব কেন্দ্রীয় Text এখানে (সবচেয়ে বেশি edit হবে)
│   └── logo.ts          ★ পুরো সাইটের লোগোর একমাত্র উৎস
├── lib/
│   ├── firebase.ts      Firebase config (project id, Realtime Database URL)
│   ├── rtdb.ts          Realtime Database helper — ডেটার একমাত্র দরজা
│   ├── age.ts           জন্ম তারিখ → বয়স (সব জায়গায় একই নিয়ম)
│   ├── forms.ts         ফর্ম ভ্যালিডেশন (popup নয় — ঘর highlight + ইনলাইন বার্তা)
│   ├── authx.ts         Auth, role resolve, password reset
│   ├── imgbb.ts         ImgBB image hosting helper
│   └── store.ts         RTDB live data layer (সাধারণত edit লাগে না)
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
  databaseURL: "https://chokbazarbloodclub-69d5f-default-rtdb.firebaseio.com",
  // ...
};
```

### ৩.২ ImgBB API key

- Admin Panel → Settings → সংযোগ → **ImgBB API কী** ঘরে বসিয়ে "সংরক্ষণ করুন"।
- এটা Realtime Database-এর `settings/imgbb`-এ সেভ হয় (সব পেজ/browser-এ শেয়ার, live)।
- বিকল্প: build-time env `VITE_IMGBB_API_KEY` (fallback)।

### ৩.৩ Database — Firebase Realtime Database

এই অ্যাপের একমাত্র ডাটাবেস **Firebase Realtime Database**। Cloud Firestore ব্যবহার
করা হয় **না**, Firebase Storage-ও নয় (ছবি → ImgBB, শুধু link ডাটাবেসে)।

- সব read/write একটাই জায়গা দিয়ে যায়: `src/lib/rtdb.ts`।
- প্রতিটি স্ক্রিন `watchList()` / `watchRow()` দিয়ে live subscribe করা, তাই কোথাও
  Add / Edit / Delete করলে **সব dashboard-এ সঙ্গে সঙ্গে** আপডেট হয় — একই তথ্য
  দ্বিতীয়বার লিখতে হয় না।
- schema ও security rules: `docs/FIREBASE.md` এবং `database.rules.json`।

### ৩.৪ Logo (এক জায়গা থেকে পুরো সাইট)

- সবচেয়ে সহজ: **`public/img/logo.png`** ফাইলটি নতুন ছবি দিয়ে replace করুন — ব্যস,
  ওয়েবসাইট, Doner Dashboard, Admin/Moderator প্যানেল, ডোনার কার্ড, favicon — সব
  জায়গায় নতুন লোগো চলে আসবে।
- অন্য কোনো URL (যেমন ImgBB link) ব্যবহার করতে চাইলে `src/config/logo.ts`-এর
  `LOGO_FILE` মানটি বদলান।
- কোনো পেজ/কম্পোনেন্টে আলাদা করে logo path লেখা **নিষেধ** — সবাই `logoUrl()`
  ব্যবহার করে।

### ৩.৫ বয়স ও জন্ম তারিখ

- ফর্মে শুধু **জন্ম তারিখ** নেওয়া হয়; বয়স আলাদা করে কোথাও লেখা বা সংরক্ষণ করা হয় না।
- বয়স সবসময় `src/lib/age.ts` → `ageFromDob()` দিয়ে হিসাব হয়, তাই তা কখনো পুরোনো হয় না।
- বয়সসীমার নিয়ম (১৮–৬০) `src/config/site.ts` → `SITE.rules.minAge/maxAge`-এ।

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
firebase deploy --only database
npm run build && firebase deploy --only hosting
```

---

## ৫. 🔧 ভবিষ্যতে fix/upgrade সহজ করার টিপস

- **সব ব্র্যান্ড/কনটেন্ট** `src/config/site.ts`-এ → এক জায়গায় বদলান।
- **প্রতি পেজ স্বয়ংসম্পূর্ণ**: প্রতিটি `.tsx`-এ নিজের CSS + UI + logic — একটা পেজের
  বদল অন্য পেজে প্রভাব ফেলে না।
- **Data layer আলাদা**: `src/lib/rtdb.ts` + `src/lib/store.ts` (Realtime Database),
  `src/lib/firebase.ts` (config), `src/lib/imgbb.ts` (ছবি) — UI থেকে data আলাদা,
  তাই backend বদলানো সহজ।
- **ফর্মের নিয়ম এক জায়গায়**: `src/lib/forms.ts` — placeholder নেই, popup নেই;
  ফাঁকা ঘর highlight হয় ও নিচে বার্তা আসে, পূরণ করলেই মুছে যায়।
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
