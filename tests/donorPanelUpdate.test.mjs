/**
 * Donor Panel — Account & Features Update regression suite
 * ═══════════════════════════════════════════════════════════════════════════
 * Covers:
 *   1. Username পরিবর্তন — নতুন field খালি থাকে, পুরোনো কপি হয় না
 *   2. Email পরিবর্তন — সরাসরি (password যাচাই + updateEmail), verification flow নেই
 *   3. Language — English নির্বাচনে Coming Soon; প্যানেল সবসময় বাংলা
 *   4. রক্তদান যোগ করুন — প্রমাণ Required, duplicate-safe submit, success popup
 *   5. আগের রক্তদান — record detail page, বাতিল status/কারণ, আবার পাঠান, Delete
 *   6. Account Delete — donor-linked cascade cleanup (donations/reports সহ)
 * Pages are single-file panels — asserted against production source, same as
 * tests/donorHomeFeed.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = p => readFileSync(path.join(process.cwd(), p), "utf8");
const doner = read("src/pages/Doner.tsx");
const admin = read("src/pages/Admin.tsx");
const moderator = read("src/pages/Moderator.tsx");
const rules = read("database.rules.json");
const addScreen = doner.slice(doner.indexOf("P.adddonation=()=>{"),
                              doner.indexOf("P.card=()=>{"));

function fnSource(src, signature, endMarker = "\n  }\n") {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, `function not found: ${signature}`);
  const end = src.indexOf(endMarker, i);
  return src.slice(i, end > i ? end : undefined);
}

/* ══════════ 1. Username পরিবর্তন ══════════ */

test("Username sheet: current shown, new field starts empty (no auto-copy)", () => {
  const sheet = fnSource(doner, "function sheetUsername()");
  assert.match(sheet, /<label>বর্তমান<\/label><input value="@\$\{esc\(a\.username\)\}" readonly>/);
  /* নতুন username field-এ পুরোনো username আর preload হয় না */
  assert.doesNotMatch(sheet, /id="un" value=/);
  assert.match(sheet, /id="un" placeholder="নতুন username লিখুন"/);
  /* একই username টাইপ করলে বার্তা থাকে */
  assert.match(sheet, /এটি আপনার বর্তমান username/);
  /* পরিবর্তনের পর নতুন username দিয়েই লগইন — নোট অক্ষত */
  assert.match(sheet, /নতুন username দিয়ে লগইন/);
});

/* ══════════ 2. Email পরিবর্তন ══════════ */

test("Email sheet: direct change flow, no verification-email popup", () => {
  const sheet = fnSource(doner, "function sheetEmail()", "\n  }\n  \n");
  /* verification-email flow সম্পূর্ণ বাদ */
  assert.doesNotMatch(sheet, /যাচাই মেইল পাঠানো হয়েছে/);
  assert.doesNotMatch(sheet, /যাচাই মেইল পাঠান/);
  /* সরাসরি flow: বর্তমান → নতুন → password → পরিবর্তন করুন */
  assert.match(sheet, /<label>বর্তমান ইমেইল<\/label><input value="\$\{esc\(a\.email\)\}" readonly>/);
  assert.match(sheet, /<label>নতুন ইমেইল <i>\*<\/i><\/label><input id="ne" type="email">/);
  assert.match(sheet, /<label>পাসওয়ার্ড দিয়ে নিশ্চিত করুন <i>\*<\/i><\/label>/);
  assert.match(sheet, /id="go">পরিবর্তন করুন</);
  /* password সঠিক হলেই ইমেইল পরিবর্তন — re-auth + updateEmail */
  assert.match(sheet, /reauthenticateWithCredential/);
  assert.match(sheet, /updateEmail\(user,v\)/);
  /* RTDB + identity index sync */
  assert.match(sheet, /pushAccountToRtdb\(\)/);
  assert.match(sheet, /releaseEmailIdentity\(old/);
  assert.match(sheet, /claimEmailIdentity\(v/);
  /* Google-account branch অক্ষত */
  assert.match(sheet, /photoSource==="google"/);
});

/* ══════════ 3. Language ══════════ */

test("Language: English select shows Coming Soon and never switches", () => {
  const bind = doner.slice(doner.indexOf('if(id==="prefs")'));
  assert.match(bind, /English — Coming Soon/);
  assert.match(bind, /ইংরেজি এখনো চালু হয়নি/);
  /* English-এ prefs.lang আর বদলায় না — applyLang()-এর EN path আর ডাকা হয় না */
  assert.doesNotMatch(bind, /STORE\.prefs\.lang=b\.dataset\.lg/);
  assert.match(bind, /b\.dataset\.lg!=="en"/);
  /* note container prefs screen-এ আছে */
  assert.match(doner, /id="lg_note"/);
});

test("Donor panel always renders Bangla (English UI removed)", () => {
  /* boot-এ lang জোর করে বাংলা — পুরোনো cached "en" দিয়েও English UI আসে না */
  assert.match(doner, /STORE\.prefs\.lang="bn";/);
  assert.match(doner, /Donor Panel-এ English UI এখনো চালু নয়/);
});

/* ══════════ 4. রক্তদান যোগ করুন ══════════ */

test("Add donation: proof image is required with specific errors", () => {
  const bind = fnSource(doner, "function bindAddDonation()");
  assert.match(bind, /প্রমাণ ছবি দিন — প্রমাণ ছাড়া রক্তদান যোগ করা যাবে না/);
  /* তারিখ ও স্থান required অক্ষত */
  assert.match(bind, /রক্তদানের তারিখ দিন/);
  assert.match(bind, /স্থান \/ হাসপাতাল লিখুন/);
  /* ফর্মে প্রমাণ আবশ্যক লেবেল */
  assert.match(doner, /<label>প্রমাণ \(ছবি\) <i>\*<\/i><\/label>/);
  assert.match(doner, /আবশ্যক — প্রমাণ ছাড়া যোগ করা যাবে না/);
  /* প্রমাণ field-এ আর "ঐচ্ছিক" লেখা নেই; ঐচ্ছিক শুধু রোগীর নাম ও মন্তব্য */
  assert.doesNotMatch(addScreen, /রসিদ \/ ব্যাগের ছবি · সর্বোচ্চ ৪ MB · ঐচ্ছিক/);
  assert.equal(addScreen.split("ঐচ্ছিক").length - 1, 2);
});

test("Add donation: submit is duplicate-safe with disabled button + success popup", () => {
  const bind = fnSource(doner, "function bindAddDonation()");
  /* চলাকালীন button disabled */
  assert.match(bind, /if\(aSave\.disabled\)return;/);
  assert.match(bind, /aSave\.disabled=true;aSave\.textContent="সংরক্ষণ হচ্ছে…"/);
  assert.match(bind, /finally\{\s*aSave\.disabled=false;aSave\.innerHTML=orig;\s*\}/);
  /* duplicate date+place check অক্ষত */
  assert.match(bind, /RAW\.donations\.some\(x=>x\.date===date&&x\.place===place\)/);
  /* সফল হলে success popup */
  assert.match(bind, /sheet\("রক্তদান যোগ হয়েছে"/);
  assert.match(bind, /রক্তদানটি সফলভাবে যোগ হয়েছে/);
  /* intro টেক্সট প্রমাণ-required অনুযায়ী (পুরোনো "না থাকলেও যোগ করা যাবে" সরানো) */
  assert.match(doner, /প্রমাণ ছবি আবশ্যক/);
  assert.doesNotMatch(addScreen, /না থাকলেও যোগ করা যাবে/);
});

/* ══════════ 5. আগের রক্তদান ══════════ */

test("Previous donations: every record opens the detail page", () => {
  assert.match(doner, /data-drec="\$\{donationVerKey\(x\)\}"/);
  assert.match(doner, /DONATION_DETAIL_ID=id;\s*go\("set","donation"\)/);
  /* detail sub-screen নিবন্ধিত */
  assert.match(doner, /\{id:"donation",title:"রক্তদানের বিবরণ",parent:"donor"\}/);
});

test("Donation detail: verified shows info/proof/status + Delete; rejected shows reason + আবার পাঠান", () => {
  const page = fnSource(doner, "P.donation=()=>{");
  /* graceful empty state — data না থাকলে crash নয় */
  assert.match(page, /রেকর্ডটি পাওয়া যায়নি/);
  /* status pill: যাচাইকৃত / বাতিল / যাচাইয়ের অপেক্ষায় */
  assert.match(page, /যাচাইকৃত/);
  assert.match(page, /বাতিল/);
  assert.match(page, /যাচাইয়ের অপেক্ষায়/);
  /* বাতিলের কারণ দেখানো হয় */
  assert.match(page, /বাতিলের কারণ:/);
  assert.match(page, /x\.rejectNote/);
  /* proof image */
  assert.match(page, /রক্তদানের প্রমাণ ছবি/);
  assert.match(page, /x\.proof\?/);
  /* আবার পাঠান (rejected) + Delete */
  assert.match(page, /id="dn_resend"/);
  assert.match(page, /id="dn_del"/);
});

test("Donation delete removes user record (+pending queue item, verified mirror)", () => {
  const del = fnSource(doner, "async function deleteDonationRecord(");
  assert.match(del, /RAW\.donations=RAW\.donations\.filter\(y=>y!==rec\)/);
  assert.match(del, /delete RAW\.verifiedDonations\[vkey\]/);
  /* pending রেকর্ডের moderation queue item-ও মুছে যায় — orphan নয় */
  assert.match(del, /`queue\/\$\{qid\}`\]:null/);
});

test("Resend clears rejected status and re-queues the record", () => {
  const bind = doner.slice(doner.indexOf('if(id==="donation")'));
  assert.match(bind, /delete x\.status;delete x\.rejectNote;delete x\.rejectedAt;/);
  assert.match(bind, /আবার পাঠানো হয়েছে — যাচাইয়ের অপেক্ষায়/);
  /* proof ছাড়া resend নিষিদ্ধ */
  assert.match(bind, /প্রমাণ ছবি ছাড়া আবার পাঠানো যাবে না/);
});

test("Rejected donations never re-enter the moderation queue", () => {
  assert.match(doner, /RAW\.donations\.filter\(x=>!isVerifiedOrLegacy\(x\)&&String\(x\.status\|\|""\)!=="rejected"\)\.forEach/);
});

test("Admin/Moderator donation rejection writes status + reason back to the donor record", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
    const decide = fnSource(src, "async function decide(");
    const i = decide.indexOf('if(q.kind==="donation"&&owner){');
    assert.ok(i > 0, `${name}: donation reject write-back missing`);
    const block = decide.slice(i, i + 1600);
    assert.match(block, /users\/\$\{owner\}\/data\/donations\/\$\{di\}\/status`\]="rejected"/);
    assert.match(block, /users\/\$\{owner\}\/data\/donations\/\$\{di\}\/rejectedAt`\]=nowIso\(\)/);
    assert.match(block, /if\(note\)paths\[`users\/\$\{owner\}\/data\/donations\/\$\{di\}\/rejectNote`\]=String\(note\)\.slice\(0,200\)/);
  }
});

/* ══════════ 6. Account Delete — cascade cleanup ══════════ */

test("Account delete cascades: approved donation log + reports + all previous scopes", () => {
  const del = fnSource(doner, "async function deleteAccountNow(");
  /* আগের scopes অক্ষত */
  assert.match(del, /paths\[`users\/\$\{uid\}`\]=null/);
  assert.match(del, /paths\[`donors\/\$\{d\.id\}`\]=null/);
  assert.match(del, /paths\[`members\/\$\{m\.id\}`\]=null/);
  assert.match(del, /paths\[`queue\/\$\{q\.id\}`\]=null/);
  assert.match(del, /paths\[`requests\/\$\{r\.id\}`\]=null/);
  assert.match(del, /paths\[`accounts\/\$\{a\.id\}`\]=null/);
  assert.match(del, /paths\[`admins\/\$\{uid\}`\]=null/);
  assert.match(del, /releaseEmailIdentity\(claimEmail, uid\)/);
  /* নতুন: approved donations log (donations node) */
  assert.match(del, /approved donation cleanup|donations\/\$\{x\.id\}`\]=null/);
  assert.match(del, /approved\.filter\(x=>ownerMatches\(x\) \|\| emailMatches\(x\)\)/);
  /* নতুন: donor-এর reports */
  assert.match(del, /reports\.filter\(x=>ownerMatches\(x\)\)/);
  assert.match(del, /paths\[`reports\/\$\{x\.id\}`\]=null/);
  /* Auth delete + local cache cleanup অক্ষত */
  assert.match(del, /deleteUser\(user\)/);
  assert.match(del, /cbdcMemberUsername/);
});

test("RTDB rules: owner may DELETE (only) own approved donation records", () => {
  const parsed = JSON.parse(rules);
  const w = parsed.rules.donations.$id[".write"];
  assert.match(w, /!newData\.exists\(\) && auth != null && data\.child\('ownerUid'\)\.val\(\) === auth\.uid/);
  /* admin/moderator পুরোনো অনুমতি অক্ষত */
  assert.match(w, /role'\)\.val\(\) === 'admin'/);
  assert.match(w, /role'\)\.val\(\) === 'moderator'/);
  /* validate অক্ষত — create/edit নিয়ম বদলায় না */
  const v = parsed.rules.donations.$id[".validate"];
  assert.match(v, /newData\.child\('livesSaved'\)\.val\(\) === 1/);
});
