# আইডিয়া — Admin «Approved Donations» Management

> **অবস্থা:** **বাস্তবায়িত হয়েছে** (এই branch-এ)।
> নিচের ডিজাইন নোট অনুযায়ী নতুন `donations` node, Admin ও Donor/Home statistics update,
> পুরোনো verified data-র idempotent backfill যুক্ত করা হয়েছে।

---

## ১. বর্তমান সিস্টেম (কোড থেকে যা বোঝা গেল)

- ডোনার রক্তদান যোগ করে।
  - নিজের রেকর্ড: `users/{uid}/data/donations` → `{date, place, bags, patient, note, proof(ImgBB URL), ok:false}`
  - অ্যাডমিনের অপেক্ষমাণ তালিকা: `queue/{id}` → `{kind:"donation", ..., proof:!!proof}` — অর্থাৎ **প্রমাণ ছবির আসল URL এখানে আসে না, শুধু bool থাকে।**
- অ্যাডমিন/মডারেটর Approve করলে (`decide()`):
  - `donors/{id}/donations` ও `totalDonations` **ব্যাগ সংখ্যা হিসাবে** বাড়ে।
    - মন্তব্য: `4-bag donation is 4 verified units`
  - `users/{uid}/data/donations/[i]/ok = true`
  - `users/{uid}/data/verifiedDonations/{vkey} = {date, place, bags, at}`
  - তারপর `queue/{id}` মুছে যায়।
- **কোনো স্থায়ী «Approved Donation» রেকর্ড নেই।** Approve হয়ে গেলে তার আলাদা তালিকা/বিস্তারিত কোথাও থাকে না; শুধু ডোনারের aggregate সংখ্যা আর ইউজারের `verifiedDonations` ম্যাপ থাকে।
- ডোনার প্যানেলে «জীবন বাঁচিয়েছেন / মোট দান» = **ব্যাগের যোগফল** (`verifiedDonationUnits()` → `sum(bags)` এবং `donors/.../totalDonations`).

### সমস্যা / ঘাটতি
1. Approve-এর পর প্রশাসকের কাছে ছবিসহ সম্পূর্ণ রেকর্ড দেখার/সম্পাদনা/মোছার জায়গা নেই।
2. প্রমাণ ছবির URL queue-তে আসে না, তাই পরে দেখানোও সম্ভব না।
3. «জীবন বাঁচিয়েছেন» ব্যাগ অনুযায়ী বাড়ে, কিন্তু চাওয়া হয়েছে **প্রতি event = ১ জীবন**।
4. Edit/Delete-এর কোনো একক authoritative source নেই; দু-জায়গায় (donors + users/verifiedDonations) রেখে sync করা কঠিন।

---

## ২. প্রস্তাবিত সমাধান

### ক. নতুন RTDB node — `donations` (আধিকারিক/authoritative list)

প্রতিটি **approve হওয়া রক্তদান event** একটি নির্দিষ্ট রেকর্ড হবে:

```jsonc
{
  "id": "DN-<owner>-<date>",
  "kind": "donation",
  "donorId": "CBDC-2026-0001",
  "ownerUid": "<auth uid>",
  "name": "ডোনারের নাম",
  "group": "O+",
  "area": "চকবাজার",
  "phone": "01...",
  "photo": "<ডোনার প্রোফাইল ছবি>",
  "place": "হাসপাতাল / ক্যাম্প",
  "date": "2026-08-30",
  "bags": 2,              // তথ্যগত (কত ব্যাগ দেওয়া হয়েছে)
  "proof": "<ImgBB URL>", // রক্তদানের প্রমাণ/ছবি
  "patient": "রোগীর নাম (ঐচ্ছিক)",
  "note": "মন্তব্য (ঐচ্ছিক)",
  "approvedAt": "ISO date",
  "approvedBy": "অ্যাডমিন/মডারেটর",
  "updatedAt": "ISO date",
  "livesSaved": 1          // এক event = ১ জীবন
}
```

### খ. Approve-এর সময় কী হবে

- Queue approve-এ প্রমাণ ছবির URL **users/{uid}/data/donations** থেকে date+place মিলিয়ে নিয়ে এসে `donations/{id}` রেকর্ডে সংরক্ষণ করা হবে।
- `donors/{id}/donations` ও `totalDonations` **১ করে বাড়বে** (ব্যাগ নয়)।
- `users/{uid}/data/verifiedDonations`-এ `{date, place, bags, livesSaved:1, at}` রাখা হবে।
- সব একসাথে atomic `updatePaths()` দিয়ে লেখা হবে (আগের প্যাটার্নই থাকবে)।

### গ. Admin Panel — «Approved Donations» section

- প্রবেশ: `আরও → ব্যবস্থাপনা → Approved Donations` অথবা People-এর কাছে; শুধু **অ্যাডমিন** (`donation.manage`)।
- তালিকা: তারিখ উল্টোভাবে। প্রতিটি কার্ডে নাম, গ্রুপ, তারিখ, স্থান, ব্যাগ, প্রমাণ ছবির thumbnail।
- একটিতে ক্লিক করলে **সম্পূর্ণ তথ্য + ছবি** (আলাদা ট্যাব `view` / detail sheet)।
- **Edit:** date, place, bags, proof URL, patient, note পরিবর্তন। বাধ্যতামূলক confirm → optimistic নয়, RTDB সফলে তবেই UI।
- **Delete:** শক্তিশালী confirm; delete হলে:
  - `donations/{id}` মুছে যায়
  - ডোনারের `donations`, `totalDonations`, `lastDonationDate` নতুন list অনুযায়ী **recompute**
  - `users/{uid}/data/donations`-এ সংশ্লিষ্ট `ok` মুছে/আনসেট
  - `users/{uid}/data/verifiedDonations`-এর পুরোনো key মুছে যায়
  - অডিট লগ লেখা হয়

### ঘ. Edit/Delete-এর পর donor statistics auto-update

একটি ছোট helper (যেমন `recomputeDonorFromDonations(donorId, ownerUid)`):
1. `donations` node থেকে ওই ডোনারের সব approved record পড়ে
2. `count = রেকর্ড সংখ্যা` (event), `last = সর্বোচ্চ date`
3. `paths` একসাথে:
   - `donors/{id}/donations`
   - `donors/{id}/totalDonations`
   - `donors/{id}/lastDonationDate`
   - `users/{owner}/data/donations/*/ok` (মিল অনুযায়ী)
   - `users/{owner}/data/verifiedDonations/*` (পুরোনো + নতুন matching)

এতে Edit/Delete করলে stats কখনো অসমতল থাকে না।

### ঙ. «জীবন বাঁচিয়েছেন» = event-ভিত্তিক

- `src/pages/Doner.tsx`
  - `verifiedDonationUnits()` → `verifiedDonationEvents()` (object-এর **value সংখ্যা**, bag যোগফল নয়)
  - হোম/প্রোফাইলের «জীবন বাঁচিয়েছেন / মোট রক্তদান» = `donors/.../totalDonations` (যা এখন event সংখ্যা)
- **বিকল্প (প্রস্তাবিত):** আরেকটি আলাদা stat `totalBags` / «মোট ব্যাগ» রাখতে পারি — তাহলে একটা রক্তদানে ৩ ব্যাগ দিলে «জীবন বাঁচিয়েছেন ১, মোট ব্যাগ ৩» দুটোই সঠিক দেখাবে। তবে ফিচার অনুযায়ী main stat হবে **জীবন = event**।

### চ. পুরোনো ডেটা (migration/backfill)

আগে Approve হওয়া রক্তদানের তথ্য `users/{uid}/data/verifiedDonations`-এ থাকে।
প্রথমবার Admin খুললে একটি **optional backfill** চালানো যেতে পারে:

- `verifiedDonations`-এর প্রতিটি এন্ট্রি → `donations/{id}`-এ কপি (proof না থাকলে খালি, classes/groups ডোনার রেকর্ড থেকে)
- ডোনারের `donations`, `totalDonations` event-count-এ রূপান্তর

এটা না করলে পুরোনো রেকর্ড তালিকায় দেখা যাবে না, কিন্তু aggregate number-এ event-count বদলানোর সময় সতর্কতা দরকার।

---

## ৩. টেকনিক্যাল ফাইল / স্পট

| ফাইল | কাজ |
| --- | --- |
| `src/lib/firebase.ts` | `NODES.donations` |
| `src/lib/store.ts` | `donations` collection live listener + state |
| `database.rules.json` | `donations`: read admin-only, write admin/moderator, validate `livesSaved === 1` |
| `src/pages/Admin.tsx` | approve-তে record তৈরি; Approved Donations sub-page; edit/delete; stats recompute |
| `src/pages/Doner.tsx` | «জীবন বাঁচিয়েছেন» event-count; verified badge |
| `docs/FIREBASE.md` / `README.md` | নোড ও নিয়ম আপডেট |

---

## ৪. যে বিষয়ে আপনার সিদ্ধান্ত দরকার

1. **মডারেটর** কি Approved Donations **দেখতে/সম্পাদনা** পারবে, নাকি শুধু অ্যাডমিন? (আমার পরামর্শ: **শুধু অ্যাডমিন**, মডারেটর শুধু queue approve করতে পারবে)
2. **«মোট ব্যাগ»** আলাদা stat/column রাখব কি? (আমার পরামর্শ: রাখব, কারণ it's informative; কিন্তু «জীবন বাঁচিয়েছেন» হবেন event-count)
3. **পুরোনো approved records** কি backfill করবon? (আমার পরামর্শ: হ্যাঁ, তবে আলাদা অ্যাডমিন বাটন/মাইগ্রেশন হিসেবে, যাতে ভুলে ঝুঁকি না থাকে)
4. Admin-এর «রক্তদান যোগ করুন» (donor profile-এ manual add) **একই `donations` node** দিয়ে যাবে কি? (আমার পরামর্শ: হ্যাঁ — সব জায়গা থেকে এক source)
