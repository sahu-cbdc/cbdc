# 🔵 Google Login Branding — "Choose an account" পেজ

Google দিয়ে লগইন করার সময় যে **"Choose an account"** / consent স্ক্রিন আসে,
সেখানে অ্যাপের নাম ও লোগো দেখায়। সেটি Firebase বা এই কোড থেকে নয় — **Google Cloud
Console-এর OAuth consent screen** থেকে নিয়ন্ত্রিত হয়। নিচের ধাপগুলো একবার করলেই
সেখানে **"Chawkbazar Blood Donor's Club"** নাম ও ওয়েবসাইটের অফিশিয়াল লোগো দেখাবে।

---

## লক্ষ্য

| Google স্ক্রিনে | যা দেখাবে |
| --- | --- |
| App name | **Chawkbazar Blood Donor's Club** |
| App logo | ওয়েবসাইটের অফিশিয়াল লোগো (`public/img/logo.png`) |
| Support / Developer email | ক্লাবের ইমেইল |
| Application home page | ওয়েবসাইটের ঠিকানা |

---

## ধাপ ১ — সঠিক প্রজেক্টে যান

<https://console.cloud.google.com/> খুলে উপরের প্রজেক্ট সিলেক্টর থেকে
**`chokbazarbloodclub-69d5f`** (Firebase প্রজেক্টটির সাথে একই) বেছে নিন।

> Firebase Console → ⚙️ Project settings → General-এ Project ID মিলিয়ে নিন।

---

## ধাপ ২ — OAuth consent screen সম্পাদনা

**APIs & Services → OAuth consent screen → EDIT APP**

| ঘর | যা বসাবেন |
| --- | --- |
| **App name** | `Chawkbazar Blood Donor's Club` |
| **User support email** | ক্লাবের ইমেইল ঠিকানা |
| **App logo** | `public/img/logo.png` আপলোড করুন (নিচের নিয়ম দেখুন) |
| **Application home page** | `https://<আপনার-ডোমেইন>/` |
| **Application privacy policy link** | `https://<আপনার-ডোমেইন>/about` |
| **Application terms of service link** | `https://<আপনার-ডোমেইন>/about` |
| **Authorized domains** | আপনার ডোমেইন + `firebaseapp.com` |
| **Developer contact information** | ক্লাবের ইমেইল ঠিকানা |

**SAVE AND CONTINUE** চেপে শেষ ধাপ পর্যন্ত গিয়ে সংরক্ষণ করুন।

### লোগো আপলোডের নিয়ম (Google-এর শর্ত)

- ফরম্যাট: **JPG, PNG বা BMP**
- আকার: **120 × 120 px** (বর্গাকার), সর্বোচ্চ **1 MB**
- স্বচ্ছ (transparent) ব্যাকগ্রাউন্ড এড়িয়ে চলুন — সাদা ব্যাকগ্রাউন্ড ভালো দেখায়

প্রজেক্টের লোগোটিকে ঠিক মাপে বানাতে:

```bash
# ImageMagick থাকলে
convert public/img/logo.png -resize 120x120 -background white -flatten public/img/logo-google.png
```

তারপর `logo-google.png` ফাইলটি Google Console-এ আপলোড করুন।

---

## ধাপ ৩ — যাচাইকরণ (verification)

- লোগো যোগ করার পর Google সাধারণত **brand verification** চায়।
  ফর্মটি পূরণ করে জমা দিন — অনুমোদন পেতে সাধারণত কয়েক কর্মদিবস লাগে।
- যাচাই সম্পন্ন হওয়ার আগ পর্যন্ত স্ক্রিনে অ্যাপের নাম দেখাবে, তবে লোগোর জায়গায়
  ডিফল্ট আইকন থাকতে পারে — এটি স্বাভাবিক।
- Publishing status **Testing** থাকলে শুধু Test users লগইন করতে পারবেন;
  সবার জন্য খুলতে **PUBLISH APP** চাপুন।

---

## ধাপ ৪ — Firebase দিকের সেটিং

**Firebase Console → Authentication →**

1. **Sign-in method → Google** — চালু (Enabled) আছে কিনা দেখুন; এখানে
   **Project public-facing name** ঘরটিও `Chawkbazar Blood Donor's Club` করে দিন।
2. **Settings → Authorized domains** — আপনার লাইভ ডোমেইন (এবং প্রয়োজনে
   `localhost`) যোগ করা আছে কিনা নিশ্চিত করুন; না থাকলে
   `auth/unauthorized-domain` error আসবে।

---

## ধাপ ৫ — পরীক্ষা

1. ব্রাউজারে ওয়েবসাইট খুলুন → **লগইন** → **"Google দিয়ে লগইন করুন"**
2. "Choose an account" স্ক্রিনে উপরে **Chawkbazar Blood Donor's Club** ও
   ক্লাবের লোগো দেখা যাবে।
3. না দেখালে: ব্রাউজার ক্যাশ পরিষ্কার করুন, ছদ্মবেশী (incognito) উইন্ডোতে
   আবার চেষ্টা করুন — Google এই স্ক্রিন কিছু সময় ক্যাশ করে রাখে।

---

## কোডে কী আছে

`src/lib/authx.ts` → `googleSignInWithFallback()` — ডেস্কটপে popup, মোবাইল বা
popup-blocked অবস্থায় স্বয়ংক্রিয় redirect। এখানে `prompt: "select_account"` দেওয়া
আছে, তাই ব্যবহারকারী প্রতিবার অ্যাকাউন্ট বেছে নিতে পারেন — এবং সেই স্ক্রিনেই
উপরের branding দেখায়।
