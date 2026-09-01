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
  assert.match(doner, /document\.documentElement\.lang="bn"/);
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
  /* বাতিলের কারণ donationNotes (staff-written) থেকে দেখানো হয় */
  assert.match(page, /বাতিলের কারণ:/);
  assert.match(page, /donNoteText\(x\)/);
  assert.match(page, /rejNote/);
  /* proof image */
  assert.match(page, /রক্তদানের প্রমাণ ছবি/);
  assert.match(page, /x\.proof\?/);
  /* আবার পাঠান (rejected) + Delete */
  assert.match(page, /id="dn_resend"/);
  assert.match(page, /id="dn_del"/);
});

test("Donation delete removes user record + queue item + mirror (save errors surface)", () => {
  const del = fnSource(doner, "async function deleteDonationRecord(");
  assert.match(del, /RAW\.donations=RAW\.donations\.filter\(y=>y!==rec\)/);
  assert.match(del, /delete RAW\.verifiedDonations\[vkey\]/);
  /* save ব্যর্থ হলে স্পষ্ট বার্তা — নীরব ব্যর্থতা নয় */
  assert.match(del, /রেকর্ড সংরক্ষণ করা যায়নি[^"]*"|সংরক্ষণ করা যায়নি/);
  /* deterministic key দিয়ে pending queue item-ও মুছে যায় — orphan নয় */
  assert.match(del, /`queue\/\$\{dnId\}`\]:null/);
  /* বাতিল note key-ও পরিষ্কার হয় */
  assert.match(del, /data\/donationNotes\/\$\{vkey\}`\]:null/);
  /* যাচাইকৃত রেকর্ড মুছলে approved log row + donor stats-ও sync হয় */
  assert.match(del, /`donations\/\$\{dnId\}`\]=null/);
  assert.match(del, /donors\/\$\{d\.id\}\/donations`\]=Math\.max\(0,\(Number\(d\.donations\)\|\|0\)-1\)/);
  assert.match(del, /donors\/\$\{d\.id\}\/totalBags`\]=Math\.max\(0,\(Number\(d\.totalBags\)\|\|0\)-bags\)/);
});

test("Resend clears rejected status and re-queues the record", () => {
  const bind = doner.slice(doner.indexOf('if(id==="donation")'));
  assert.match(bind, /delete x\.status;delete x\.rejectNote;delete x\.rejectedAt;/);
  assert.match(bind, /আবার পাঠানো হয়েছে — যাচাইয়ের অপেক্ষায়/);
  /* proof ছাড়া resend নিষিদ্ধ */
  assert.match(bind, /প্রমাণ ছবি ছাড়া আবার পাঠানো যাবে না/);
});

test("Rejected donations never re-enter the moderation queue", () => {
  assert.match(doner, /RAW\.donations\.filter\(x=>!isVerifiedOrLegacy\(x\)&&!donRejected\(x\)\)\.forEach/);
});

test("Rejection state is read from staff-written donationNotes, never from the record", () => {
  /* notes RAW-তে আলাদা — RAW.donations-এ merge করে ফেরত লেখা হয় না */
  assert.match(doner, /RAW\.donationNotes=row\.data\.donationNotes/);
  assert.match(doner, /\["donations","activity"\]\.forEach\(k=>\{ if\(Array\.isArray\(row\.data\[k\]\)\)RAW\[k\]=row\.data\[k\]; \}\);/);
  assert.match(doner, /const donRejected=\(x:any\)=>donNote\(x\)\?\.status==="rejected"/);
  /* counters ও list দুই জায়গাতেই donRejected */
  assert.match(doner, /dn\.filter\(x=>!isVerifiedDonation\(x\)&&!donRejected\(x\)\)\.length/);
  assert.match(doner, /const rej=donRejected\(x\);/);
});

test("Admin/Moderator rejection writes a keyed donationNote (race-free, with reason)", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
    const decide = fnSource(src, "async function decide(");
    const i = decide.indexOf('if(q.kind==="donation"&&owner){');
    assert.ok(i > 0, `${name}: donation reject write-back missing`);
    const block = decide.slice(i, i + 1200);
    /* stable verKey দিয়ে লেখা হয় — array-index নয়, তাই donor এদিকে রেকর্ড
       সরালেও ভুল রেকর্ডে লেখা হয় না */
    assert.match(block, /const vkey=donationVerKey\(q\.date,q\.place\);/);
    assert.match(block, /users\/\$\{owner\}\/data\/donationNotes\/\$\{vkey\}`\]=\{status:"rejected"/);
    assert.match(block, /note:String\(note\|\|""\)\.slice\(0,200\),at:nowIso\(\)/);
    /* পুরোনো index-ভিত্তিক লেখা আর নেই */
    assert.doesNotMatch(block, /data\/donations\/\$\{di\}\/status/);
  }
});

test("Approve matches the donor by ownerUid first, then donorId, then name", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
    const decide = fnSource(src, "async function decide(");
    const i = decide.indexOf('} else if(q.kind==="donation"&&ok){');
    assert.ok(i > 0, `${name}: approve block missing`);
    const block = decide.slice(i, i + 600);
    assert.match(block, /String\(x\.ownerUid\|\|""\)===qw/);
    assert.match(block, /DB\.donors\.find\(x=>x\.name===q\.name\)/);
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

/* ═══════════════════════════════════════════════════════════════════════════
   Bug-fix regression suite (rules ↔ architecture, cascade, consistency)
   ═══════════════════════════════════════════════════════════════════════════ */
const identity = read("src/lib/identity.ts");
const home = read("src/pages/Home.tsx");
const authx = read("src/lib/authx.ts");
const notify = read("src/lib/notify.ts");
const donationLog = read("src/lib/donationLog.ts");

test("Rules: donors may write ONLY their own accounts row (owner-uid scoped)", () => {
  const parsed = JSON.parse(rules);
  const w = parsed.rules.accounts.$id[".write"];
  /* admin full access অক্ষত */
  assert.match(w, /role'\)\.val\(\) === 'admin'/);
  /* delete শুধু নিজের row */
  assert.match(w, /!newData\.exists\(\) && data\.exists\(\) && data\.child\('uid'\)\.val\(\) === auth\.uid/);
  /* create/update শুধু নিজের uid দিয়ে */
  assert.match(w, /newData\.exists\(\) && newData\.child\('uid'\)\.val\(\) === auth\.uid && \(!data\.exists\(\) \|\| data\.child\('uid'\)\.val\(\) === auth\.uid\)/);
});

test("Rules: users/{uid}/data is staff-writable (moderator write-backs must not fail)", () => {
  const parsed = JSON.parse(rules);
  const w = parsed.rules.users.$uid.data[".write"];
  assert.match(w, /\$uid === auth\.uid \|\| root\.child\('admins'\)\.child\(auth\.uid\)\.exists\(\)/);
});

test("Rules: owner may decrement donor stats by exactly one verified donation", () => {
  const parsed = JSON.parse(rules);
  const v = parsed.rules.donors.$id[".validate"];
  /* identity fields equality-locked থাকে */
  assert.match(v, /newData\.child\('ownerUid'\)\.val\(\) === data\.child\('ownerUid'\)\.val\(\)/);
  /* decrement branch: donations ও totalDonations -1, totalBags clamp, lastDonationDate unchanged */
  assert.match(v, /newData\.child\('donations'\)\.val\(\) === data\.child\('donations'\)\.val\(\) - 1/);
  assert.match(v, /newData\.child\('totalDonations'\)\.val\(\) === data\.child\('totalDonations'\)\.val\(\) - 1/);
  assert.match(v, /newData\.child\('totalBags'\)\.val\(\) >= 0 && newData\.child\('totalBags'\)\.val\(\) <= data\.child\('totalBags'\)\.val\(\)/);
  assert.match(v, /newData\.child\('lastDonationDate'\)\.val\(\) === data\.child\('lastDonationDate'\)\.val\(\)/);
});

test("Rules: loginIndex is public-read, claim-once, owned by the claiming email", () => {
  const parsed = JSON.parse(rules);
  assert.equal(parsed.rules.loginIndex[".read"], true);
  for (const kind of ["username", "phone"]) {
    const w = parsed.rules.loginIndex[kind].$key[".write"];
    /* create-if-absent (claim-once); overwrite/delete শুধু দাবিকারী email-ই পারে */
    assert.match(w, /newData\.isString\(\) && newData\.val\(\)\.contains\('@'/);
    assert.match(w, /!data\.exists\(\) \|\| data\.val\(\) === auth\.token\.email/);
    assert.match(w, /!newData\.exists\(\) && \(data\.val\(\) === auth\.token\.email/);
  }
});

test("identity.ts: atomic claim-once login index helpers", () => {
  assert.match(identity, /export function loginIndexKey/);
  assert.match(identity, /export async function lookupLoginKey/);
  const claim = fnSource(identity, "export async function claimLoginKey(");
  /* অন্যের email থাকলে abort — race-safe claim */
  assert.match(claim, /current !== mail\) return undefined/);
  const rel = fnSource(identity, "export async function releaseLoginKey(");
  /* নিজের email ছাড়া কারো entry মুছে না */
  assert.match(rel, /snap\.val\(\) !== mail\) return false/);
  assert.match(identity, /export async function claimLoginEntries/);
  assert.match(identity, /export async function releaseLoginEntries/);
});

test("Login resolves username/phone via loginIndex first (works pre-auth)", () => {
  const fn = fnSource(home, "async function resolveEmailByIdentifier(");
  assert.match(fn, /lookupLoginKey\("username",q\)/);
  assert.match(fn, /lookupLoginKey\("phone",dq\)/);
  /* users-node query fallback নেই — লগইনের আগে (unauthenticated) `users` read
     rules-এ সবসময় permission-denied, তাই সেসব query কখনো সফল হতো না; শুধু
     দুইটি অপ্রয়োজনীয় denied round-trip-এ login ধীর করত (দ্রুত লগইন)। */
  assert.doesNotMatch(fn, /findBy\(NODES\.users, "username", q\)/);
  assert.doesNotMatch(fn, /findBy\(NODES\.users, "phone", digits\(q\)\)/);
});

test("Signup blocks a username already claimed in loginIndex", () => {
  const i = home.indexOf('lookupLoginKey("username",o.username)');
  assert.ok(i > 0, "signup loginIndex username check missing");
  const seg = home.slice(i - 400, i + 400);
  assert.match(seg, /if\(owner\) dupUser=\{username:o\.username,uid:owner\};/);
  assert.match(seg, /NODES\.members, "username", o\.username/);
});

test("ensureUserProfile claims the login index (fail-open)", () => {
  const i = authx.indexOf("export async function ensureUserProfile(");
  const fn = authx.slice(i, i + 5000);
  assert.match(fn, /claimLoginEntries\(base\.email, username, phone\)/);
});

test("Account delete cascade: deterministic queue/approved-log ids + groupChange + loginIndex", () => {
  const del = fnSource(doner, "async function deleteAccountNow(");
  /* সঠিক DN স্কিম: DN-<uid8>-<date>-<vkey> — queue ও donations দুটোই */
  assert.match(del, /const delUid8=uid\.replace\(\/\[\^A-Za-z0-9\]\/g,""\)\.slice\(-8\)\|\|"unknown";/);
  assert.match(del, /const dn="DN-"\+delUid8\+"-"\+dd\+"-"\+vk;/);
  assert.match(del, /paths\[`queue\/\$\{dn\}`\]=null;/);
  assert.match(del, /paths\[`donations\/\$\{dn\}`\]=null;/);
  /* পুরোনো ভুল প্যাটার্নের key-ও পরিষ্কার হয় */
  assert.match(del, /queue\/DN-\$\{uid\}-\$\{String\(x\.date\)\.replace\(\/-\/g,""\)\}`\]=null/);
  /* pending গ্রুপ-বদল অনুরোধের queue row */
  assert.match(del, /if\(delGc&&delGc\.id&&String\(delGc\.status\|\|""\)==="pending"\) paths\[`queue\/\$\{delGc\.id\}`\]=null;/);
  /* loginIndex release */
  assert.match(del, /releaseLoginEntries\(delEmail,/);
});

test("Resend clears the staff rejection note and re-queues", () => {
  const bind = doner.slice(doner.indexOf('if(id==="donation")'));
  assert.match(bind, /delete \(RAW\.donationNotes as any\)\[donationVerKey\(x\)\];/);
  assert.match(bind, /data\/donationNotes\/\$\{donationVerKey\(x\)\}`\]:null/);
  /* save ব্যর্থতায় স্পষ্ট বার্তা */
  assert.match(bind, /সংরক্ষণ করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন/);
});

test("Add-donation surfaces save failures instead of silently succeeding", () => {
  const bind = fnSource(doner, "function bindAddDonation()");
  assert.match(bind, /try\{ await saveData\(\); \}\s*\n\s*catch\(saveErr\)\{/);
  assert.match(bind, /toast\("সংরক্ষণ করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন","er"\)/);
});

test("Cancellation notifies the donor (with reason) exactly once per record", () => {
  assert.match(doner, /id:"dn-rej-"\+sanitizeKey\(vk\)/);
  assert.match(doner, /title:"রক্তদান যাচাই বাতিল হয়েছে"/);
  assert.match(doner, /seen\.donRej&&seen\.donRej\[vk\]\)return;/);
  /* প্রথম বুটে পুরোনো বাতিল baseline — notification-ঝড় নয় */
  assert.match(doner, /seen\.donRej=\{\};/);
  assert.match(notify, /donRej\?: Record<string, number>;/);
});

test("donationVerKey has one implementation and trims date/place", () => {
  assert.match(donationLog, /String\(date \|\| ""\)\.trim\(\) \+ "\|" \+ String\(place \|\| ""\)\.trim\(\)/);
  /* Doner নিজের কপি নয় — lib থেকে import */
  assert.match(doner, /import \{ donationVerKey as verKeyOf \} from "\.\.\/lib\/donationLog";/);
  assert.match(doner, /const donationVerKey=\(x:any\)=>verKeyOf\(x&&x\.date,x&&x\.place\);/);
  assert.doesNotMatch(doner, /const donationVerKey=\(x:any\)=>\{\s*\n\s*const s=/);
});

test("Username change is atomic-claim based and releases the old username", () => {
  const sheet = fnSource(doner, "function sheetUsername()");
  assert.match(sheet, /claimLoginKey\("username",v,mail\)/);
  assert.match(sheet, /claim\.reason==="conflict"\?"এই username ইতিমধ্যে ব্যবহৃত"/);
  assert.match(sheet, /releaseLoginKey\("username",old,mail\)/);
  /* availability check DB থেকেই */
  assert.match(sheet, /lookupLoginKey\("username",v\)/);
});

test("Phone change claims/releases the login index entry", () => {
  const sheet = fnSource(doner, "function sheetPhone()");
  assert.match(sheet, /claimLoginKey\("phone",digits\(v\),mail\)/);
  assert.match(sheet, /releaseLoginKey\("phone",digits\(old\),mail\)/);
});

test("Email change migrates loginIndex entries to the new email", () => {
  const sheet = fnSource(doner, "function sheetEmail()");
  assert.match(sheet, /releaseLoginEntries\(old,a\.username,a\.phone\)/);
  assert.match(sheet, /claimLoginEntries\(v,a\.username,a\.phone\)/);
});

test("Record delete from the list matches by key, not by array index", () => {
  assert.match(doner, /data-delrec="\$\{donationVerKey\(x\)\}"/);
  const bind = fnSource(doner, "function bindAddDonation()");
  assert.match(bind, /RAW\.donations\.find\(x=>x&&donationVerKey\(x\)===b\.dataset\.delrec\)/);
  assert.doesNotMatch(bind, /RAW\.donations\[i\]/);
});

test("Confirm dialog binds its own overlay (stacked-sheet safe)", () => {
  const fn = fnSource(doner, "function confirmS(");
  assert.match(fn, /const _ov=s\.previousElementSibling;/);
  assert.doesNotMatch(fn, /document\.querySelector\("\.ov"\)\.addEventListener/);
});

test("Donation detail uses Bangla delete label and truthful policy text", () => {
  assert.match(doner, /id="dn_del">\$\{ICON\.trash\(15\)\} মুছুন</);
  assert.match(doner, /ভুল রেকর্ড আগের রক্তদান তালিকা বা বিবরণ পেজ থেকে নিজেই মুছে ফেলা যাবে/);
  /* প্রদর্শিত নীতিমালায় (adddonation screen) আর "সতর্কবাতা" প্রতিশ্রুতি নেই */
  assert.doesNotMatch(addScreen, /দিলে সতর্কবার্তা দেখাবে/);
});
