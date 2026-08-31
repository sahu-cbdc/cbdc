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
  const sheet = admin.slice(i, admin.indexOf("/* সম্পূর্ণ অ্যাকাউন্ট ডিলিট", i));
  assert.match(sheet, /liveUser=accountUsers\.find/);
  assert.match(sheet, /liveAdmin=accountAdmins\.find/);
  assert.match(sheet, /firstFilled\(/);
  assert.match(sheet, /Existing account information কখনো overwrite করা হয় না/);
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
  assert.match(ra, /donors\/\{id\} fallback/);
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
