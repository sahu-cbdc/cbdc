# 🔵 Google Login Branding ও সমস্যা সমাধান — "Choose an account" স্ক্রিন

Google দিয়ে লগইন করার সময় যে **"Choose an account"** / consent স্ক্রিন আসে,
সেখানে অ্যাপের নাম ও লোগো দেখায়। এটি কোড থেকে নিয়ন্ত্রিত হয় না — **Firebase
Console-এর "Project public-facing name"** এবং **Google Cloud Console-এর OAuth
consent screen** থেকে নিয়ন্ত্রিত হয়। নিচের ধাপগুলো একবার করলেই সেখানে
**"চকবাজার ব্লাড ডোনার্স ক্লাব"** নাম ও ওয়েবসাইটের অফিশিয়াল লোগো দেখাবে —
`chokbazarbloodclub-69d5f` টেকনিক্যাল নামটি আর দেখাবে না।

---

## লক্ষ্য

| স্ক্রিন | যা দেখাবে |
| --- | --- |
| "Choose an account"-এর উপরে | **চকবাজার ব্লাড ডোনার্স ক্লাব** |
| App লোগো | ওয়েবসাইটের অফিশিয়াল লোগো (`public/img/logo.png`) |
| Support / Developer email | ক্লাবের ইমেইল |

> ⚠️ গুরুত্বপূর্ণ: `chokbazarbloodclub-69d5f.firebaseapp.com/__/auth/handler`
> হলো বাধ্যতামূলক **টেকনিক্যাল redirect URL** — এটি কখনো বদলাবেন না। ব্র্যান্ডিং
> শুধু উপরের নাম/লোগো সেটিংস দিয়ে হয়; প্রযুক্তিগত ডোমেইন বদলাতে গেলে
> লগইন ভেঙে যাবে।

---

## ধাপ ১ — সঠিক প্রজেক্টে যান

<https://console.cloud.google.com/> খুলে উপরের প্রজেক্ট সিলেক্টর থেকে
**`chokbazarbloodclub-69d5f`** (Firebase প্রজেক্টটির সাথে একই) বেছে নিন।

> Firebase Console → ⚙️ Project settings → General-এ Project ID মিলিয়ে নিন।

---

## ধাপ ২ — Firebase দিকের সেটিং (সবার আগে এটি)

**Firebase Console → Authentication:**

1. **Sign-in method → Google → Enable** করুন (আগে থেকে চালু থাকলেও একবার
   খুলে দেখুন)। এখানে **"Project public-facing name"** ঘরটি
   **চকবাজার ব্লাড ডোনার্স ক্লাব** লিখে Save করুন — "Choose an account" স্ক্রিনে
   এই নামটিই দেখায়।
2. **Sign-in method → Email/Password → Enable** আছে কিনা দেখুন।
3. **Settings → Authorized domains** — যেসব ডোমেইনে সাইট চলে সব যোগ করুন:
   - `chokbazarbloodclub-69d5f.firebaseapp.com` (ডিফল্ট থাকে)
   - `cbdc-a9418.web.app` (Hosting)
   - আপনার কাস্টম ডোমেইন (যেমন `www.চকবাজার...` / `cbdc.pages.dev`)
   - ডেভেলপমেন্টের জন্য `localhost`

   এখানে ডোমেইন না থাকলে Google অ্যাকাউন্ট বেছে নেওয়ার পরেও লগইন
   সম্পন্ন হয় না (`auth/unauthorized-domain`)।

---

## ধাপ ৩ — Google Cloud OAuth consent screen

**Google Cloud Console → APIs & Services → OAuth consent screen → EDIT APP**

| ঘর | যা বসাবেন |
| --- | --- |
| **App name** | `চকবাজার ব্লাড ডোনার্স ক্লাব` |
| **User support email** | ক্লাবের ইমেইল ঠিকানা |
| **App logo** | `public/img/logo.png` আপলোড করুন (নিচের নিয়ম দেখুন) |
| **Application home page** | `https://<আপনার-ডোমেইন>/` |
| **Authorized domains** | আপনার ডোমেইন + `firebaseapp.com` |
| **Developer contact information** | ক্লাবের ইমেইল ঠিকানা |

**SAVE AND CONTINUE** চেপে শেষ ধাপ পর্যন্ত গিয়ে সংরক্ষণ করুন।

### লোগো আপলোডের নিয়ম (Google-এর শর্ত)

- ফরম্যাট: **JPG, PNG বা BMP**
- আকার: **120 × 120 px** (বর্গাকার), সর্বোচ্চ **1 MB**
- স্বচ্ছ (transparent) ব্যাকগ্রাউন্ড এড়িয়ে চলুন — সাদা ব্যাকগ্রাউন্ড ভালো দেখায়

```bash
# ImageMagick থাকলে
convert public/img/logo.png -resize 120x120 -background white -flatten public/img/logo-google.png
```

### Redirect URI যাচাই (শুধু দেখুন, বদলাবেন না)

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
→ (Web client)** — Authorized redirect URIs তালিকায় এই ঠিকানাটি থাকতে হবে:

```
https://chokbazarbloodclub-69d5f.firebaseapp.com/__/auth/handler
```

এটি না থাকলে যোগ করুন; অন্য কিছু বদলাবেন না।

---

## ধাপ ৪ — যাচাইকরণ (verification)

- লোগো যোগ করার পর Google সাধারণত **brand verification** চায়।
  ফর্মটি পূরণ করে জমা দিন — অনুমোদন পেতে সাধারণত কয়েক কর্মদিবস লাগে।
- যাচাই সম্পন্ন হওয়ার আগ পর্যন্ত স্ক্রিনে অ্যাপের নাম দেখাবে, তবে লোগোর জায়গায়
  ডিফল্ট আইকন থাকতে পারে — এটি স্বাভাবিক।
- Publishing status **Testing** থাকলে শুধু Test users লগইন করতে পারবেন;
  সবার জন্য খুলতে **PUBLISH APP** চাপুন।

---

## ধাপ ৫ — পরীক্ষা

1. ব্রাউজারে ওয়েবসাইট খুলুন → **লগইন** → **"Google দিয়ে লগইন করুন"**
2. "Choose an account" স্ক্রিনে উপরে **চকবাজার ব্লাড ডোনার্স ক্লাব** ও
   ক্লাবের লোগো দেখা যাবে।
3. না দেখালে: ব্রাউজার ক্যাশ পরিষ্কার করুন, ছদ্মবেশী (incognito) উইন্ডোতে
   আবার চেষ্টা করুন — Google এই স্ক্রিন কিছু সময় ক্যাশ করে রাখে।

---

## 🛠️ সমস্যা সমাধান

| সমস্যা | কারণ / সমাধান |
| --- | --- |
| অ্যাকাউন্ট বেছে নেওয়ার পর সাইটে ফিরে আসে, লগইন হয় না | ① ধাপ ২-এর Authorized domains-এ সাইটের ডোমেইন আছে কিনা দেখুন ② ধাপ ২.১-এর মতো **নতুন করে** বিল্ড/ডিপ্লয় করুন ③ ধাপ ৩-এর redirect URI ঠিক আছে কিনা দেখুন |
| "এই ডোমেইন থেকে লগইনের অনুমতি নেই" বার্তা | ধাপ ২.৩ — বর্তমান ডোমেইনটি Authorized domains-এ যোগ করুন |
| পপ-আপ খোলে না / ব্লক হয় | কোড নিজেই স্বয়ংক্রিয়ভাবে **redirect**-এ চলে যায় (মোবাইল/পপ-আপ-ব্লকারে এটিই স্বাভাবিক পথ) |
| লগইন হয় কিন্তু ড্যাশবোর্ডে যায় না | ব্রাউজারের তৃতীয়-পক্ষ (third-party) cookies/storage বন্ধ থাকলে খুলে দিন; কোডে `browserLocalPersistence` দেওয়া আছে, তবুও খুব কঠোর প্রাইভেট মোডে সমস্যা হতে পারে |
| একই ইমেইলে আগে অ্যাকাউন্ট ছিল | নতুন ডুপ্লিকেট অ্যাকাউন্ট তৈরি হয় না — বিদ্যমান অ্যাকাউন্টেই লগইন হয়; অন্য পদ্ধতিতে তৈরি হলে ইমেইল/পাসওয়ার্ডে লগইন করতে বলা হয় |

---

## কোডে কী আছে

- `src/lib/authx.ts` → `googleSignInWithFallback()` — ডেস্কটপে popup, মোবাইল বা
  popup-blocked অবস্থায় স্বয়ংক্রিয় redirect; `prompt: "select_account"` দেওয়া
  আছে, তাই ব্যবহারকারী প্রতিবার অ্যাকাউন্ট বেছে নিতে পারেন।
- `src/lib/authx.ts` → `consumeGoogleRedirect()` — redirect থেকে ফিরে ফলাফল
  পুনরুদ্ধার; `src/lib/firebase.ts`-এ `browserLocalPersistence` — রিলোডের পরেও
  সেশন থাকে।
- লগইন ও সাইন-আপ দুটোর জন্য **একই** সমাপ্তি-ফ্লো (`Home.tsx` →
  `continueGoogleAuth`): আগে অ্যাকাউন্ট থাকলে সেটিতেই লগইন → নিজের
  নির্ধারিত dashboard; নতুন হলে বিদ্যমান নিবন্ধন ফর্ম।
