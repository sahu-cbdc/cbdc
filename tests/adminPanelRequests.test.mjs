/**
 * Admin Panel — ১–৭ অনুরোধের regression suite
 * ═══════════════════════════════════════════════════════════════════════════
 * Covers:
 *   1. অনুমোদন ও সেটিংস — ON/OFF toggle বাটন (টিক-চেকবক্স নয়), RTDB সেভ অক্ষত
 *   2. ডোনার ব্যবস্থাপনা / ডোনার আইডি ব্যবস্থাপনা — search box + filter
 *   3. নিরাপত্তা — Admin-এর forgot-password Donor Panel-এর মতোই in-sheet
 *      email reset (full-page redirect নেই)
 *   4. অ্যাকাউন্ট ও নিয়ন্ত্রণ — Admin নিজের রক্তদানের হিসাব + নতুন রেকর্ড যোগ
 *   5. Login গতি — প্যানেলগুলো users/{uid} একবারই পড়ে (knownProfile)
 *   6. Access & Role — role বদলালে আগের তথ্য অক্ষত থাকে (overwrite নেই)
 *   7. সার্ভার-সাইড Donor ID delete — donations/requests/reports সহ সম্পূর্ণ
 *      Permanent Delete (functional test — in-memory DeleteIo)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { handleAdminEntityDelete } from "../server/deleteApi.ts";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const admin = read("src/pages/Admin.tsx");
const doner = read("src/pages/Doner.tsx");
const moderator = read("src/pages/Moderator.tsx");

/* ══════════ 1. অনুমোদন ও সেটিংস — ON/OFF toggle ══════════ */

test("Approval settings: proper ON/OFF toggle buttons (.tg), no tick checkboxes", () => {
  const i = admin.indexOf("SUBP.rules=el=>{");
  assert.ok(i >= 0, "SUBP.rules not found");
  const rules = admin.slice(i, admin.indexOf("/* ---------- global search", i));
  /* চারটি সুইচই .tg টগল বাটন (role=switch) */
  assert.match(rules, /APPROVAL_TOGGLES\.map\(\(\[k,t,help,state\]\)=>`<div class="row">/);
  assert.match(rules, /class="tg \$\{r\[k\]!==false\?"on":""\}" data-rl="\$\{k\}" role="switch"/);
  /* টিক-মার্ক checkbox আর নেই */
  assert.doesNotMatch(rules, /type="checkbox" data-rl=/);
  /* চারটি সুইচই আছে (ডোনার আবেদন, রক্তদান যাচাই, জরুরি আবেদন, গ্রুপ বদল) */
  for (const key of ["donorApproval", "donationApproval", "emergencyApproval", "bloodGroupApproval"]) {
    assert.match(admin, new RegExp(`"${key}"`));
  }
  /* toggle চাপলে RTDB settings/app-এ সেভ + audit (সংযোগ অক্ষত) */
  assert.match(rules, /pushSettings\(\)/);
  assert.match(rules, /logAudit\("অনুমোদন সেটিংস হালনাগাদ"/);
  assert.match(rules, /key==="emergencyApproval"\)r\.reqApproval=r\.emergencyApproval/);
});

test("Approval settings wiring reaches the donor panel & main website", () => {
  /* Doner panel APPROVAL_SETTINGS — settings/app live listener থেকে */
  assert.match(doner, /watchRow\(NODES\.settings,"app"/);
  assert.match(doner, /donorApproval:rules\.donorApproval!==false/);
  assert.match(doner, /donationApproval:rules\.donationApproval!==false/);
  assert.match(doner, /bloodGroupApproval:rules\.bloodGroupApproval!==false/);
  /* Main website emergency auto-approve */
  assert.match(read("src/pages/Home.tsx"), /AUTO_APPROVE_EMERGENCY=rules\.emergencyApproval===false/);
});

/* ══════════ 2. ডোনার ব্যবস্থাপনা / ডোনার আইডি — search ══════════ */

test("Donor management & Donor ID screens have a working search box", () => {
  assert.match(admin, /let teamSel=new Set\(\), donorIdSel=new Set\(\), dmQ=""/);
  assert.match(admin, /id="dmq" value="\$\{esc\(dmQ\)\}" placeholder="নাম \/ আইডি \/ ফোন \/ এলাকা খুঁজুন…"/);
  assert.match(admin, /filterDonorManage\(donorManageRows\(false\),dmQ\)/);
  assert.match(admin, /filterDonorManage\(donorManageRows\(true\),dmQ\)/);
  /* টাইপ করলেই ফিল্টার — input handler */
  assert.match(admin, /dmq\.oninput/);
  assert.match(admin, /d\.name,d\.id,d\.donorId,d\.phone,d\.area,d\.group,username/);
});

test("Donor ID management shows ALL donor IDs (unfiltered, not just approved)", () => {
  /* unfiltered RTDB watch — store-এর donors শুধু approved রাখে, তাই ডোনার আইডি
     স্ক্রিনের জন্য আলাদা সরাসরি (public-read) listener */
  assert.match(admin, /let stopDonorIdWatch=\(\)=>\{\}, donorIdRows=\[\], donorIdRowsReady=false;/);
  assert.match(admin, /function watchDonorIds\(\)\{/);
  assert.match(admin, /stopDonorIdWatch=watchList\(NODES\.donors,rows=>\{/);
  /* শুধু ডোনার আইডি স্ক্রিনে ব্যবহৃত; store/অন্য স্ক্রিন স্পর্শ করে না */
  assert.doesNotMatch(admin.slice(admin.indexOf("function watchDonorIds"), admin.indexOf("function watchAccounts")), /status/);
  /* list rendering — ডোনার আইডি স্ক্রিনে raw rows + অরফান আইডি; ডোনার
     ব্যবস্থাপনায় শুধু ডোনার তালিকার rows */
  assert.match(admin, /const base=all&&donorIdRowsReady\?allDonorIdRows\(\):donorIdRows;/);
  /* screen waits for the raw list before showing anything (no false empty) */
  assert.match(admin, /if\(!dataReady\("donors"\)\|\|!donorIdRowsReady\)\{el\.innerHTML=skelRows\(4\);return\}/);
  /* delete + profile + boot wiring use the same raw list */
  assert.match(admin, /const list=\(donorIdRowsReady\?allDonorIdRows\(\):donorIdRows\)/);
  assert.match(admin, /\|\|donorIdRows\.find\(x=>x\.id===\(ARG\|\|dvId\)\)/);
  assert.match(admin, /watchDonorIds\(\);watchReports\(\);/);
  /* people-screen count reflects the full list */
  assert.match(admin, /bn\(donorIdRowsReady\?donorIdRows\.length:DB\.donors\.length\)/);
});

test("Donor management = only donors on the donor list (no account-only rows)", () => {
  /* team স্ক্রিন শুধু ডোনার তালিকার rows দেখায় — অ্যাকাউন্ট থাকলেই নয় */
  const team = admin.slice(admin.indexOf("SUBP.team=el=>{"), admin.indexOf("SUBP.donorid=el=>{"));
  assert.match(team, /donorManageRows\(false\)/);
  assert.match(team, /!donorIdRowsReady\)\{el\.innerHTML=skelRows\(4\);return\}/);
  assert.match(team, /wireDonorManage\(el,rows,teamSel,"list"\)/);
  assert.doesNotMatch(team, /accountDonors\(\)/);
  /* donorManageRows(false) base = শুধু donorIdRows (ডোনার তালিকা) */
  assert.match(admin, /const base=all&&donorIdRowsReady\?allDonorIdRows\(\):donorIdRows;/);
  /* ডোনার ব্যবস্থাপনার ডিলিট = তালিকা থেকে সরানো (permanent নয়) */
  assert.match(admin, /\$\("#tdel"\)\.onclick=\(\)=>scope==="list"\?removeDonorsFromList\(\[\.\.\.sel\]\):bulkDeleteEntities\("donor",\[\.\.\.sel\]\)/);
  /* সরানো = donors/{id} + queue/members + users/{uid}/donorStatus... — অ্যাকাউন্ট/ইতিহাস অক্ষত */
  const rm = admin.slice(admin.indexOf("async function removeDonorsFromList"), admin.indexOf("function roleSheet(uid){"));
  assert.match(rm, /paths\[`donors\/\$\{id\}`\]=null/);
  assert.match(rm, /paths\[`users\/\$\{uid\}\/donorStatus`\]=null/);
  assert.match(rm, /paths\[`users\/\$\{uid\}\/donorId`\]=null/);
  assert.match(rm, /await updatePaths\(paths\)/);
  assert.match(rm, /releaseDonorSerial\(id\)/);
  assert.doesNotMatch(rm, /serverDeleteEntity|deleteAuthUser/);
  /* আপডেট সরাসরি donors/{id}-এ (lossy store full-replace নয়); `group`/`last`
     পুরোনো key → canonical `bloodGroup`/`lastDonationDate`-তে লেখা হয় যেন
     পাবলিক/অন্য প্যানেল stale না দেখায় (item 10) */
  const edit = admin.slice(admin.indexOf("function editDonorField"), admin.indexOf("function donorAction"));
  assert.match(edit, /const RTDB_DONOR_KEY:Record<string,string>=\{group:"bloodGroup",last:"lastDonationDate"\}/);
  assert.match(edit, /updateRow\(NODES\.donors,String\(d\.id\|\|""\),\{\[rKey\]:v\}\)/);
  assert.doesNotMatch(edit, /await persist\(\)/);
  /* linked অ্যাকাউন্ট (users/{ownerUid}) একই তথ্যে হালনাগাদ — কোনো প্যানেল stale থাকে না */
  assert.match(edit, /await syncLinkedDonorAccount\(d,key,v\)/);
  assert.match(admin, /const LINKED_ACCOUNT_KEY:Record<string,string>=\{\s*name:"name",gender:"gender",dob:"dob",phone:"phone",group:"bloodGroup",area:"area",last:"lastDonation"\s*\}/);
  /* verify/suspend টগলও সরাসরি ডোনার রেকর্ডে */
  assert.match(admin, /updateRow\(NODES\.donors,String\(d\.id\|\|""\),\{verified:nv\}\)/);
  assert.match(admin, /updateRow\(NODES\.donors,String\(d\.id\|\|""\),\{suspended:nv\}\)/);
});

test("Donor ID screen includes orphan IDs (in account but not on donor list)", () => {
  assert.match(admin, /function orphanDonorIdRows\(\)\{/);
  assert.match(admin, /const did=String\(\(u&&\(u\.donorId\|\|u\.id\)\)\|\|""\)\.trim\(\)/);
  assert.match(admin, /donorIds\.has\(did\)/);
  assert.match(admin, /orphan:true/);
  assert.match(admin, /function allDonorIdRows\(\)\{/);
  assert.match(admin, /orphanDonorIdRows\(\)\.forEach\(o=>rows\.push\(o\)\)/);
  /* অরফান সারিতে ক্লিক → সংক্ষিপ্ত শিট (ডোনার workspace নয়) */
  assert.match(admin, /if\(row&&row\.d\.orphan\)openOrphanIdSheet\(row\.d\);else openDonor\(x\.dataset\.row\)/);
  assert.match(admin, /function openOrphanIdSheet\(d\)\{/);
  assert.match(admin, /deleteOneEntity\(d,"donor"\)/);
  /* অরফান ব্যাজ */
  assert.match(admin, /d\.orphan\?`<span style="color:var\(--amb\)">শুধু অ্যাকাউন্টে — তালিকায় নেই<\/span>`/);
  /* অ্যাকাউন্ট/ব্যবহারকারী বদলালে ডোনার আইডি স্ক্রিনও রি-রেন্ডার */
  assert.match(admin, /\["team","access","donorid"\]\.includes\(SUB\)/);
});

test("Donor management keeps select-all, delete-selected and duplicate check", () => {
  const manage = admin.slice(admin.indexOf("function donorManageHtml"), admin.indexOf("/* ══════════ ডুপ্লিকেট যাচাই"));
  assert.match(manage, /id="tall"/);
  assert.match(manage, /id="tdel"/);
  assert.match(manage, /ডুপ্লিকেট যাচাই/);
  assert.match(manage, /id="tdedupe"/);
});

/* ══════════ 3. নিরাপত্তা — forgot password (Donor Panel-এর হুবহু সিস্টেম) ══════════ */

test("Admin forgot password: in-sheet email reset (no full-page redirect)", () => {
  const i = admin.indexOf("function sheetForgot(){");
  assert.ok(i >= 0, "sheetForgot not found");
  const sheet = admin.slice(i, admin.indexOf("/* ---------- delete my own admin account", i));
  assert.match(sheet, /requestPasswordReset\(shared\.auth, email\)/);
  assert.match(sheet, /লিংক পাঠানো হচ্ছে…/);
  assert.match(sheet, /রিসেট লিংক পাঠানো হয়েছে/);
  assert.match(sheet, /আবার পাঠান/);
  /* পুরোনো redirect পথ নেই */
  assert.doesNotMatch(sheet, /location\.assign\(appBase\(\)\+"forgot-password"\)/);
  /* Password change → Firebase Auth-এ সাথে সাথে (setOrChangePassword) */
  assert.match(admin, /await setOrChangePassword\(user, email, currentPassword, newPassword\)/);
});

/* ══════════ 4. Admin নিজের রক্তদান (অ্যাকাউন্ট ও নিয়ন্ত্রণ) ══════════ */

test("Admin profile: donation count shown + direct record add (ছোট ফর্ম)", () => {
  const account = admin.slice(admin.indexOf("SUBP.account=el=>{"), admin.indexOf("SUBP.security=el=>{"));
  assert.match(account, /মোট রক্তদান/);
  assert.match(account, /myDonationCount\(\)/);
  assert.match(account, /নতুন রক্তদান যোগ করুন/);
  assert.match(account, /"addDonation"/);
  /* add sheet — শুধু তারিখ + স্থান (ডোনারের দীর্ঘ ফর্ম নয়) */
  const sheet = admin.slice(admin.indexOf("function addMyDonationSheet"), admin.indexOf("function adminDonorForm"));
  assert.match(sheet, /md_date/);
  assert.match(sheet, /md_place/);
  assert.match(sheet, /saveApprovedDonation\(record,null\)/);
  assert.match(sheet, /users\/\$\{uid\}\/lastDonation/);
  assert.match(sheet, /logAudit\("নিজের রক্তদান রেকর্ড যোগ"/);
  /* meAction-এ কল */
  assert.match(admin, /if\(a==="addDonation"\)addMyDonationSheet\(page\);/);
});

/* ══════════ 5. Login গতি — প্যানেল boot-এ একক users/{uid} read ══════════ */

test("Panels read users/{uid} once at boot (faster login, no duplicate read)", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
    assert.match(src, /{knownProfile:profileRow}/, `${name}: knownProfile missing`);
  }
  assert.match(doner, /{knownProfile:row}/, "Doner: knownProfile missing");
  /* প্যানেল আগে দেখায়, session write পেছনে (অপ্রয়োজনীয় loading নেই) */
  assert.match(admin, /proceed\(\);\s*\n\s*try\{ await saveMe\(\)/);
  assert.match(moderator, /proceed\(\);\s*\n\s*try\{ await saveMe\(\)/);
});

/* ══════════ 6. Access & Role — আগের তথ্য অক্ষত ══════════ */

test("Role change preserves existing identity (no blank re-entry, no duplicate)", () => {
  const i = admin.indexOf("async function roleManageSheet(");
  assert.ok(i >= 0, "roleManageSheet not found");
  const sheet = admin.slice(i, admin.indexOf("async function deleteManagedAccount(uid)", i));
  assert.match(sheet, /liveUser=accountUsers\.find/);
  assert.match(sheet, /liveAdmin=accountAdmins\.find/);
  assert.match(sheet, /firstFilled\(/);
  assert.match(sheet, /firstFilled\(a\.name,liveAdmin&&liveAdmin\.name/);
  /* admins/{uid} — merge; খালি মান লেখা হয় না */
  assert.match(sheet, /Object\.keys\(identity\)\.forEach\(k=>\{if\(identity\[k\]\)staff\[k\]=identity\[k\]\}\)/);
  /* duplicate user data তৈরি হয় না — শুধু role/permission + identity copy */
  assert.doesNotMatch(sheet, /setRow\(NODES\.users/);
});

/* ══════════ 7. Access & Role — donors/{id} fallback (ফাঁকা ফিল্ড নয়) ══════════ */

test("Access & Role: account rows fall back to donors/{id} via ownerUid (no blanks)", () => {
  /* accountDonorRow — ownerUid, তারপর uid ফিল্ডে মেলে */
  assert.match(admin, /function accountDonorRow\(uid\)/);
  assert.match(admin, /String\(d\.ownerUid\|\|""\)===u/);
  assert.match(admin, /String\(d\.uid\|\|""\)===u/);
  /* refreshAccounts-এ শুধু ফাঁকা ফিল্ড পূরণ হয় (আগের মান overwrite নয়) */
  const ra = admin.slice(admin.indexOf("function refreshAccounts(){"), admin.indexOf("function watchAccounts(){"));
  assert.match(ra, /const d=accountDonorRow\(uid\);if\(!d\)return;/);
  assert.match(ra, /fillIf\(/);
  assert.match(ra, /fillIf\("name",d\.name\)/);
  /* roleManageSheet-এও liveDonor fallback */
  assert.match(admin, /liveDonor=accountDonorRow\(uid\)/);
  assert.match(admin, /liveDonor&&liveDonor\.name/);
  /* team build-এও donor fallback */
  assert.match(admin, /profile=users\.get\(uid\)\|\|accountDonorRow\(uid\)\|\|\{\}/);
  /* ডোনার তালিকা এলেই accounts refresh হয় (store hook) */
  assert.match(admin, /meta\.node==="donors"\)\{ try\{ refreshAccounts\(\)/);
});

/* ══════════ 8. Login গতি/স্থিতিশীলতা — boot re-entrancy guard ══════════ */

test("Panels skip re-boot on same-uid auth events (token refresh) — no duplicate watchers", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator], ["Doner", doner]]) {
    assert.match(src, /let bootedUid=""/, name + ": bootedUid guard missing");
    /* Admin/Moderator-এ `if(bootedUid===user.uid)return;`; Doner-এ PUBLIC_MODE
       check-এর পর `if(user && bootedUid===user.uid)return;` */
    assert.match(src, /if\((user && )?bootedUid===user\.uid\)return;/, name + ": same-uid skip missing");
    assert.match(src, /bootedUid=user\.uid/, name + ": bootedUid assignment missing");
  }
});

/* ══════════ 9. সার্ভার-সাইড Donor ID delete — সম্পূর্ণ Permanent Delete ══════════ */

function makeMemoryIo() {
  const data = {
    "admins/ADMIN_0123456789abcdef":
      { uid: "ADMIN_0123456789abcdef", role: "admin", status: "active", name: "বস" },
    "donors/DONOR-001": { id: "DONOR-001", ownerUid: "USER_0123456789abcdef", name: "রহিম", group: "O+" },
    "donors/DONOR-002": { id: "DONOR-002", ownerUid: "USER_OTHER_0123456789", name: "করিম" },
    "users/USER_0123456789abcdef": { uid: "USER_0123456789abcdef", name: "রহিম", email: "rahim@example.com", username: "rahim" },
    "admins/USER_0123456789abcdef": { uid: "USER_0123456789abcdef", role: "moderator", status: "active", name: "রহিম" },
    "members/M-1": { id: "M-1", ownerUid: "USER_0123456789abcdef", name: "রহিম" },
    "queue/Q-1": { id: "Q-1", kind: "donor", ownerUid: "USER_0123456789abcdef" },
    "donations/DN-1": { id: "DN-1", donorId: "DONOR-001", ownerUid: "USER_0123456789abcdef", date: "2026-01-10" },
    "donations/DN-2": { id: "DN-2", donorId: "DONOR-002", date: "2026-02-10" },
    "requests/REQ-1": { id: "REQ-1", ownerUid: "USER_0123456789abcdef", patient: "রোগী" },
    "requests/REQ-2": { id: "REQ-2", ownerUid: "USER_OTHER_0123456789", patient: "অন্য" },
    "reports/RP-1": { id: "RP-1", ownerUid: "USER_0123456789abcdef", type: "সমস্যা" },
    "accounts/AC-1": { id: "AC-1", ownerUid: "USER_0123456789abcdef" },
  };
  const applied = [];
  const io = {
    async verifyToken() {
      return { uid: "ADMIN_0123456789abcdef" };
    },
    async get(p) {
      return data[p] !== undefined ? data[p] : null;
    },
    async list(node) {
      const out = {};
      for (const [p, v] of Object.entries(data)) {
        if (p.startsWith(node + "/")) out[p.slice(node.length + 1)] = v;
      }
      return out;
    },
    async apply(paths) {
      for (const p of Object.keys(paths)) applied.push(p);
      return true;
    },
    async deleteAuthUser() {
      return "deleted";
    },
  };
  return { io, applied };
}

test("Server donor-ID delete: permanent full cleanup (donations/requests/reports included, others untouched)", async () => {
  const { io, applied } = makeMemoryIo();
  const result = await handleAdminEntityDelete(
    { scope: "donor", donorId: "DONOR-001", uid: "USER_0123456789abcdef", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true);
  assert.equal(result.auth, "deleted");
  const set = new Set(applied);
  /* ডোনার, আবেদন, queue, History (donations), নিজের requests/reports, অ্যাকাউন্ট */
  assert.ok(set.has("donors/DONOR-001"));
  assert.ok(set.has("members/M-1"));
  assert.ok(set.has("queue/Q-1"));
  assert.ok(set.has("donations/DN-1"), "donor's donation history deleted");
  assert.ok(set.has("requests/REQ-1"), "donor's own requests deleted");
  assert.ok(set.has("reports/RP-1"), "donor's own reports deleted");
  assert.ok(set.has("users/USER_0123456789abcdef"));
  assert.ok(set.has("admins/USER_0123456789abcdef"));
  assert.ok(set.has("accounts/AC-1"));
  /* অন্যের তথ্য স্পর্শ হয় না */
  assert.ok(!set.has("donors/DONOR-002"));
  assert.ok(!set.has("donations/DN-2"), "another donor's history untouched");
  assert.ok(!set.has("requests/REQ-2"), "another user's request untouched");
});

test("Server donor-ID delete: orphan ID (account-only, no donors/{id} record) also permanently deleted", async () => {
  /* অরফান: users/{uid}/donorId ও accounts/…/donorId-তে লেখা, কিন্তু donors/{id} রেকর্ড নেই */
  const data = {
    "admins/ADMIN_0123456789abcdef": { uid: "ADMIN_0123456789abcdef", role: "admin", status: "active", name: "বস" },
    "users/USER_ORPHAN_012345678": { uid: "USER_ORPHAN_012345678", name: "অরফান", email: "orphan@example.com", username: "orphan", donorId: "ORPHAN-9" },
    "admins/USER_ORPHAN_012345678": { uid: "USER_ORPHAN_012345678", role: "moderator", status: "active", name: "অরফান" },
    "accounts/AC-ORPHAN": { id: "AC-ORPHAN", uid: "USER_ORPHAN_012345678", donorId: "ORPHAN-9" },
    "donations/DN-ORPHAN": { id: "DN-ORPHAN", donorId: "ORPHAN-9", ownerUid: "USER_ORPHAN_012345678", date: "2026-01-01" },
    "queue/Q-ORPHAN": { id: "Q-ORPHAN", kind: "donation", ownerUid: "USER_ORPHAN_012345678" },
    "requests/REQ-ORPHAN": { id: "REQ-ORPHAN", ownerUid: "USER_ORPHAN_012345678" },
    "reports/RP-ORPHAN": { id: "RP-ORPHAN", ownerUid: "USER_ORPHAN_012345678" },
    "donors/DONOR-002": { id: "DONOR-002", ownerUid: "USER_OTHER_0123456789", name: "করিম" },
  };
  const applied = [];
  const io = {
    async verifyToken() { return { uid: "ADMIN_0123456789abcdef" }; },
    async get(p) { return data[p] !== undefined ? data[p] : null; },
    async list(node) {
      const out = {};
      for (const [p, v] of Object.entries(data)) {
        if (p.startsWith(node + "/")) out[p.slice(node.length + 1)] = v;
      }
      return out;
    },
    async apply(paths) { for (const p of Object.keys(paths)) applied.push(p); return true; },
    async deleteAuthUser() { return "deleted"; },
  };
  const result = await handleAdminEntityDelete(
    { scope: "donor", donorId: "ORPHAN-9", uid: "USER_ORPHAN_012345678", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true);
  assert.equal(result.auth, "deleted");
  const set = new Set(applied);
  assert.ok(set.has("users/USER_ORPHAN_012345678"), "linked account removed");
  assert.ok(set.has("admins/USER_ORPHAN_012345678"), "linked staff record removed");
  assert.ok(set.has("accounts/AC-ORPHAN"), "linked account row removed");
  assert.ok(set.has("donations/DN-ORPHAN"), "orphan's donation history deleted");
  assert.ok(set.has("queue/Q-ORPHAN"), "orphan's pending queue row removed");
  assert.ok(set.has("requests/REQ-ORPHAN"), "orphan's requests removed");
  assert.ok(set.has("reports/RP-ORPHAN"), "orphan's reports removed");
  assert.ok(!set.has("donors/DONOR-002"), "other donors untouched");
});

test("Server donor-ID delete: orphan ID without matching account record is rejected (nothing deleted)", async () => {
  const { io, applied } = makeMemoryIo();
  const result = await handleAdminEntityDelete(
    { scope: "donor", donorId: "GHOST-1", uid: "USER_ORPHAN_012345678", idToken: "tok" },
    io,
  ).catch((e) => ({ ok: false, error: e && e.message, status: e && e.status }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(applied.length, 0, "nothing deleted");
});

test("Server account delete keeps donor ID untouched", async () => {
  const { io, applied } = makeMemoryIo();
  const result = await handleAdminEntityDelete(
    { scope: "account", uid: "USER_0123456789abcdef", idToken: "tok" },
    io,
  );
  assert.equal(result.ok, true);
  const set = new Set(applied);
  assert.ok(set.has("users/USER_0123456789abcdef"));
  assert.ok(set.has("admins/USER_0123456789abcdef"));
  assert.ok(set.has("accounts/AC-1"));
  assert.ok(!set.has("donors/DONOR-001"), "account delete keeps donor ID");
  assert.ok(!set.has("donations/DN-1"));
});

/* ══════════ 8. প্রোফাইল "আমিও একজন রক্তদাতা" — Donor Panel সিস্টেমে সংযুক্ত ══════════ */

test("Admin: join form blood group is editable (no disabled select) and save honors the picked group", () => {
  const form = admin.slice(admin.indexOf("function adminDonorForm"), admin.indexOf("async function removeAdminDonor"));
  /* রক্তের গ্রুপের select আর কখনো disabled হয় না — এখান থেকেই গ্রুপ বদলানো যায় */
  assert.match(form, /<select id="ad_group" name="ad_group">/);
  assert.doesNotMatch(form, /id="ad_group"[^>]*disabled/);
  /* save-এ select-এর মানই প্রথম পছন্দ; ফাঁকা/অবৈধ হলেই অ্যাকাউন্টের পুরোনো মান */
  assert.match(form, /const picked=s\.q\("#ad_group"\)\.value;/);
  assert.match(form, /const bloodGroup=GROUPS\.includes\(picked\)\?picked:\(savedGroups\.find\(x=>GROUPS\.includes\(x\)\)\|\|""\);/);
  /* গ্রুপ বদল users/{uid} + donors/{id} দুটোতেই লেখা হয় (একই updatePaths) */
  assert.match(form, /paths\[`users\/\$\{uid\}\/bloodGroup`\]=bloodGroup;/);
  assert.match(form, /id:donorId,donorId,uid,ownerUid:uid,name:identity\.name,bloodGroup,/);
});

test("Admin: profile toggle is a real switch wired to join/leave, not a preference", () => {
  const bind = admin.slice(admin.indexOf("function bindMe"), admin.indexOf("function applyPrefs"));
  assert.match(bind, /if\(k==="isDonor"\)\{/);
  assert.match(bind, /if\(ME\.isDonor\)await removeAdminDonor\(page\);else adminDonorForm\(page\);/);
  /* toggle ON/OFF state RTDB users/{uid} থেকে আসে (donorStatus + donorId) */
  assert.match(admin, /ME\.isDonor=ME\.donorStatus==="approved"&&!!ME\.donorId;/);
  /* OFF করলে অ্যাকাউন্ট/প্রোফাইল তথ্য মুছে যায় না — শুধু donor field মুছে, bloodGroup থাকে */
  const remove = admin.slice(admin.indexOf("async function removeAdminDonor"), admin.indexOf("async function setAdminDonorAvailability"));
  assert.match(remove, /\["donorStatus","donorId","lastDonation","health","whatsapp","available","appliedAt","cardTheme","groupChange"\]/);
  assert.doesNotMatch(remove, /\["bloodGroup"/);
});

test("Moderator: profile donor toggle is wired to the real donor system (not a preference)", () => {
  const bind = moderator.slice(moderator.indexOf("function bindMe"), moderator.indexOf("function applyPrefs"));
  assert.match(bind, /if\(k==="isDonor"\)\{/);
  assert.match(bind, /if\(ME\.isDonor\)await removeModeratorDonor\(page\);else moderatorDonorForm\(page\);/);
  assert.match(bind, /if\(k==="available"&&ME\.isDonor\)\{await setModeratorDonorAvailability/);
  /* local preference toggle আর নেই */
  assert.doesNotMatch(bind, /if\(k==="isDonor"\|\|k==="dense"\|\|k==="anim"\)renderSub\(page\);/);
});

test("Moderator: donor state comes from users/{uid} donorStatus+donorId, never from panel preference", () => {
  const app = moderator.slice(moderator.indexOf("function applyMeRow"), moderator.indexOf("let stopMeWatch"));
  assert.match(app, /ME\.donorId=String\(row\.donorId\|\|""\);/);
  assert.match(app, /ME\.donorStatus=String\(row\.donorStatus\|\|"none"\);/);
  assert.match(app, /ME\.isDonor=ME\.donorStatus==="approved"&&!!ME\.donorId;/);
  assert.doesNotMatch(app, /typeof p\.isDonor==="boolean"\)ME\.isDonor=p\.isDonor;/);
  /* default আর ভুয়া ON দেখায় না */
  assert.match(moderator, /donorId:"",donorStatus:"none",\n\s+health:"",whatsapp:"",available:true,cardTheme:"green",isDonor:false,/);
});

test("Moderator: join form writes users/{uid} + donors/{id} in one multi-location update", () => {
  const form = moderator.slice(moderator.indexOf("function moderatorDonorForm"), moderator.indexOf("async function removeModeratorDonor"));
  assert.match(form, /paths\[`users\/\$\{uid\}\/donorStatus`\]="approved";/);
  assert.match(form, /paths\[`users\/\$\{uid\}\/donorId`\]=donorId;/);
  assert.match(form, /paths\[`users\/\$\{uid\}\/data\/panel\/isDonor`\]=true;/);
  assert.match(form, /const base=`donors\/\$\{donorId\}`;/);
  assert.match(form, /id:donorId,donorId,uid,ownerUid:uid,name:identity\.name,bloodGroup,/);
  /* প্রোফাইলের আগের identity overwrite হয় না — শুধু ফাঁকা field পূরণ হয় */
  assert.match(form, /const existingValue=k=>String\(current\[k\]\|\|ME\[k\]\|\|""\)\.trim\(\)/);
  /* রক্তের গ্রুপ select সক্রিয় (এখান থেকেই গ্রুপ বদল) */
  assert.match(form, /<select id="ad_group" name="ad_group">/);
  assert.doesNotMatch(form, /id="ad_group"[^>]*disabled/);
});

test("Moderator: leave clears donor fields but keeps profile info (bloodGroup intact)", () => {
  const rem = moderator.slice(moderator.indexOf("async function removeModeratorDonor"), moderator.indexOf("/* ---------- every account action"));
  assert.match(rem, /\["donorStatus","donorId","lastDonation","health","whatsapp","available","appliedAt","cardTheme","groupChange"\]/);
  assert.doesNotMatch(rem, /\["bloodGroup"/);
  assert.match(rem, /paths\[`users\/\$\{uid\}\/data\/panel\/isDonor`\]=false;/);
  assert.match(rem, /Object\.assign\(ME,\{isDonor:false,donorStatus:"none",donorId:""/);
});

test("Moderator: profile edits sync to the public donor record (same source as Doner Panel)", () => {
  assert.match(moderator, /await syncModeratorDonorPublicRecord\(clean\);/);
  const sync = moderator.slice(moderator.indexOf("async function syncModeratorDonorPublicRecord"), moderator.indexOf("async function setModeratorDonorAvailability"));
  assert.match(sync, /ME\.donorStatus!=="approved"\|\|!ME\.donorId\)return;/);
  assert.match(sync, /await updateRow\(NODES\.donors,id,patch\);/);
  assert.match(sync, /bloodGroup:ME\.bloodGroup\|\|""/);
});

test("Moderator: account donor section shows status + editable donor info rows", () => {
  const acc = moderator.slice(moderator.indexOf("SUBP.account=el=>{"), moderator.indexOf("SUBP.security=el=>{"));
  assert.match(acc, /tgRow\("আমিও একজন রক্তদাতা"/);
  assert.match(acc, /ডোনার অবস্থা/);
  assert.match(acc, /sRow\("রক্তের গ্রুপ",ME\.bloodGroup,"editBlood"\)/);
  assert.match(acc, /sRow\("WhatsApp",ME\.whatsapp\|\|"দেওয়া হয়নি","editDonorWa"\)/);
  assert.match(acc, /sRow\("স্বাস্থ্য তথ্য",ME\.health\|\|"দেওয়া হয়নি","editDonorHealth"\)/);
  assert.match(acc, /tgRow\("আমি এখন রক্তদানে প্রস্তুত"/);
  assert.match(moderator, /if\(a==="editDonorWa"\)askText/);
  assert.match(moderator, /if\(a==="editDonorHealth"\)askText/);
});
