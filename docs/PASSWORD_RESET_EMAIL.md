# 🔐 Firebase Password Reset Email — CBDC ব্র্যান্ডিং

পাসওয়ার্ড রিসেটের পুরো ব্যবস্থাটি **Firebase Authentication-এর built-in
password reset link** দিয়ে চলে। কোনো নিজস্ব SMTP সার্ভার বা
কোনো তৃতীয় পক্ষের সেবা লাগে না।

```
ব্যবহারকারী → /forgot-password (ওয়েবসাইটের সুন্দর full-page UI)
            → ইমেইল দেন
            → Firebase রিসেট লিংকসহ ইমেইল পাঠায়   ← এই ডকুমেন্ট এই ইমেইলটি নিয়ে
            → লিংকে ক্লিক → /reset-password (আমাদের নিজস্ব পেজ)
            → নতুন পাসওয়ার্ড সেট → লগইন
```

কোডে বাস্তবায়ন: `src/lib/authx.ts` →
`requestPasswordReset()`, `verifyResetCode()`, `completePasswordReset()`;
UI: `src/pages/Home.tsx`-এর `view-forgot` ও `view-reset` সেকশন।

---

## ধাপ ১ — Action URL নিজেদের সাইটে আনুন (সবচেয়ে গুরুত্বপূর্ণ)

ডিফল্টে Firebase নিজের সাদামাটা পেজে (`…firebaseapp.com/__/auth/action`) নিয়ে যায়।
আমাদের নিজস্ব, ব্র্যান্ডেড পেজ দেখাতে:

1. **Firebase Console → Authentication → Templates → Password reset**
2. ডান পাশে পেন্সিল (✏️ Edit) আইকনে ক্লিক করুন
3. **"Customize action URL"** লিংকে ক্লিক করে বসান:

   ```
   https://<আপনার-ডোমেইন>/reset-password
   ```

   উদাহরণ: `https://cbdc-a9418.web.app/reset-password`

4. Save করুন।

> কোডও একই ঠিকানা `continue URL` হিসেবে পাঠায় (`resetActionSettings()`), তাই
> Firebase Console → Authentication → Settings → **Authorized domains**-এ আপনার
> ডোমেইনটি যোগ করা থাকতে হবে।

---

## ধাপ ২ — ইমেইলের প্রেরক ও নাম

একই Templates স্ক্রিনে:

| ঘর | যা বসাবেন |
| --- | --- |
| **Sender name** | `চকবাজার ব্লাড ডোনার'স ক্লাব` |
| **From** | `noreply@<আপনার-প্রজেক্ট>.firebaseapp.com` (অথবা যাচাই করা custom domain) |
| **Reply to** | ক্লাবের প্রকৃত ইমেইল ঠিকানা |
| **Subject** | `আপনার পাসওয়ার্ড রিসেট করুন — চকবাজার ব্লাড ডোনার'স ক্লাব` |

---

## ধাপ ৩ — ইমেইলের বডি (কপি-পেস্ট করুন)

Templates → Password reset → Edit → **Message** ঘরে নিচের HTML হুবহু বসান।
`%LINK%` হলো Firebase-এর placeholder — এটি অবশ্যই থাকতে হবে, এটিই আসল রিসেট লিংক।

> লোগোর ঠিকানা: ইমেইলে relative path কাজ করে না, তাই এখানে **পূর্ণ URL** দিতে হয়।
> নিচের `https://cbdc-a9418.web.app/img/logo.png` অংশটি আপনার আসল ডোমেইন দিয়ে
> বদলে নিন (ওয়েবসাইটের `public/img/logo.png` ফাইলটিই এই ঠিকানায় পাওয়া যায়,
> অর্থাৎ লোগো এখানেও একটিই কেন্দ্রীয় উৎস থেকে আসে)।

```html
<div style="margin:0;padding:0;background:#f2faf6;font-family:'Segoe UI',system-ui,-apple-system,'Noto Sans Bengali','SolaimanLipi',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px;">

    <!-- Header / brand -->
    <div style="text-align:center;padding:6px 0 18px;">
      <img src="https://cbdc-a9418.web.app/img/logo.png" width="76" height="76" alt="CBDC"
           style="width:76px;height:76px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 6px 16px rgba(8,122,75,.22);display:inline-block;">
      <div style="margin-top:10px;color:#064f37;font-size:17px;font-weight:800;">
        চকবাজার ব্লাড ডোনার'স ক্লাব
      </div>
      <div style="color:#65736f;font-size:12px;margin-top:2px;">
        মানবতার সেবায় আমরা রক্তদাতা
      </div>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border:1px solid rgba(8,122,75,.14);border-radius:20px;padding:30px 26px;box-shadow:0 18px 45px rgba(15,52,43,.10);">

      <h1 style="margin:0 0 10px;color:#102b2a;font-size:21px;line-height:1.4;text-align:center;">
        পাসওয়ার্ড রিসেট করুন
      </h1>

      <p style="margin:0 0 20px;color:#65736f;font-size:14px;line-height:1.85;text-align:center;">
        আপনার <strong style="color:#102b2a;">%EMAIL%</strong> অ্যাকাউন্টের পাসওয়ার্ড
        পরিবর্তনের অনুরোধ পাওয়া গেছে। নিচের বোতামে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:26px 0;">
        <a href="%LINK%"
           style="display:inline-block;padding:14px 30px;border-radius:12px;background:#087a4b;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 8px 20px rgba(8,122,75,.28);">
          নতুন পাসওয়ার্ড সেট করুন
        </a>
      </div>

      <!-- Note -->
      <div style="padding:13px 15px;border:1px solid #bfe0d0;border-radius:12px;background:#f6fbf8;color:#2f5b4a;font-size:12.5px;line-height:1.8;">
        🔐 নিরাপত্তার জন্য লিংকটি সীমিত সময়ের জন্য কার্যকর এবং শুধু একবার ব্যবহার করা যায়।
      </div>

      <p style="margin:18px 0 0;color:#65736f;font-size:12.5px;line-height:1.85;">
        আপনি যদি পাসওয়ার্ড পরিবর্তনের অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন —
        আপনার পাসওয়ার্ড অপরিবর্তিত থাকবে।
      </p>

      <p style="margin:16px 0 0;color:#8b9a95;font-size:11.5px;line-height:1.7;word-break:break-all;">
        বোতাম কাজ না করলে এই ঠিকানাটি ব্রাউজারে কপি-পেস্ট করুন:<br>
        <a href="%LINK%" style="color:#087a4b;">%LINK%</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 8px 6px;color:#8b9a95;font-size:11.5px;line-height:1.8;">
      চকবাজার ব্লাড ডোনার'স ক্লাব · চকবাজার, চট্টগ্রাম<br>
      হেল্পলাইন: 01617725464<br>
      <span style="color:#a7b3af;">এটি একটি স্বয়ংক্রিয় বার্তা — অনুগ্রহ করে উত্তর দেবেন না।</span>
    </div>
  </div>
</div>
```

---

## ধাপ ৪ — যাচাই

1. ওয়েবসাইটে `/forgot-password` খুলুন।
2. একটি বাস্তব ইমেইল দিয়ে **"রিসেট লিংক পাঠান"** চাপুন।
3. ইমেইল খুলে ডিজাইনটি দেখুন — লোগো, সবুজ CTA ও বাংলা লেখা ওয়েবসাইটের সঙ্গে
   মিলে যাওয়ার কথা।
4. বোতামে ক্লিক করলে আপনার সাইটেরই `/reset-password` পেজ খুলবে, সেখানে দুইবার
   নতুন পাসওয়ার্ড দিয়ে সংরক্ষণ করুন।

---

## দ্রষ্টব্য

- Firebase-এর email template-এ শুধু `%LINK%`, `%EMAIL%`, `%APP_NAME%`,
  `%DISPLAY_NAME%` — এই placeholder গুলোই কাজ করে।
- একাধিক ভাষার template দরকার হলে Templates স্ক্রিনের উপরে ভাষা নির্বাচক আছে।
- লোগো বদলালে শুধু `public/img/logo.png` replace করলেই ওয়েবসাইট **ও** এই ইমেইল —
  দুই জায়গাতেই নতুন লোগো দেখাবে (কারণ ইমেইলও ওই একই ফাইলের URL ব্যবহার করছে)।
