/**
 * Donor application cancel workflow — Doner + Admin + Moderator
 * ═══════════════════════════════════════════════════════════════════════════
 * Final workflow under test:
 *   Donor আবেদন → Admin/Moderator যাচাই → Approve অথবা বাতিল
 *
 * বাতিল:
 *   → কারণ optional (কোনো "কারণ লিখতে হবে" validation নয়)
 *   → Pending state সম্পূর্ণ clear (users/{uid}, queue, members)
 *   → Donor panel আর "অ্যাডমিন অনুমোদনের অপেক্ষায়" দেখায় না; refresh/sync-এও ফেরে না
 *   → আগের approved/verified status ও donation history অক্ষত থাকে
 *
 * The pages are single-file panels (no exports), so the workflow is asserted
 * against the production source — same approach as tests/donorHomeFeed.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = p => readFileSync(path.join(process.cwd(), p), "utf8");
const doner = read("src/pages/Doner.tsx");
const admin = read("src/pages/Admin.tsx");
const moderator = read("src/pages/Moderator.tsx");

/** First-match slice of a function body from a panel source file. */
function fnSource(src, signature) {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, `function not found: ${signature}`);
  const end = src.indexOf("\n  }\n", i);
  return src.slice(i, end > i ? end : undefined);
}

/* ════════════════ Donor panel — বাতিল/প্রত্যাহার ════════════════ */

test("Donor home never shows approval-awaiting for a cancelled application", () => {
  /* "অ্যাডমিন অনুমোদনের অপেক্ষায়" is tied to pending only — rejected/cancelled
     donor applications must not show it. */
  assert.match(doner, /dStatus\(\)==="pending"\?" · অ্যাডমিন অনুমোদনের অপেক্ষায়"/);
  assert.doesNotMatch(doner, /dStatus\(\)!=="none"\?" · অ্যাডমিন অনুমোদনের অপেক্ষায়"/);
});

test("Donor pill and become view show the cancelled state, not approved/pending", () => {
  assert.match(doner, /dStatus\(\)==="rejected"\)return `<span class="pill r">আবেদন বাতিল হয়েছে<\/span>`/);
  const becomeView = fnSource(doner, "function becomeView()");
  assert.match(becomeView, /dStatus\(\)==="rejected"/);
  assert.match(becomeView, /আপনার রক্তদাতা আবেদনটি বাতিল করা হয়েছে/);
  assert.match(becomeView, /donorRejectNote/);
  assert.match(becomeView, /data-act="become">আবার আবেদন করুন/);
  /* the approved branch stays below the rejected branch */
  assert.ok(becomeView.indexOf("dStatus()===\"rejected\"") < becomeView.indexOf("অনুমোদিত রক্তদাতা"));
});

test("Withdraw reason is optional and saved when given", () => {
  const wd = fnSource(doner, 'case "withdraw"');
  assert.match(wd, /প্রত্যাহারের কারণ <span[^>]*>\(ঐচ্ছিক\)/);
  assert.match(wd, /কারণ না লিখেও প্রত্যাহার করা যাবে/);
  /* no required-reason validation on the withdraw sheet */
  assert.doesNotMatch(wd, /কারণ লিখতে হবে/);
  /* reason is persisted in the user's activity when provided */
  assert.match(wd, /logAct\("আবেদন প্রত্যাহার",reason\?\("কারণ: "\+reason\)/);
});

test("Withdraw clears pending state from every source (users/queue/members)", () => {
  const wd = fnSource(doner, 'case "withdraw"');
  /* users/{uid} pending metadata + old reject note cleared */
  assert.match(wd, /\[`users\/\$\{uid\}\/donorStatus`\]:null/);
  assert.match(wd, /\[`users\/\$\{uid\}\/donorRejectNote`\]:null/);
  /* deterministic pending queue record removed */
  assert.match(wd, /`queue\/PD-\$\{uid\.replace\(\/\[\^A-Za-z0-9\]\/g,""\)\.slice\(-40\)\}`\]:null/);
  /* linked member record is deleted, not just its status */
  assert.match(wd, /paths\[`members\/\$\{memberId\}`\]=null/);
  /* remaining same-owner donor queue/member records swept too */
  assert.match(wd, /queues\.filter\(q=>q&&q\.kind==="donor"&&ownRecord\(q\)\)/);
  assert.match(wd, /members\.filter\(m=>ownRecord\(m\)\)/);
  /* donor's approved/verified status + donation history are not touched:
     no donors/{id} or donation-history writes in the withdraw path */
  assert.doesNotMatch(wd, /NODES\.donors/);
  assert.doesNotMatch(wd, /verifiedDonations/);
  assert.doesNotMatch(wd, /applicationCount/);
});

test("Hydrate cannot resurrect a cleared pending state", () => {
  const hydrate = fnSource(doner, "async function hydrateDonorFromRtdb");
  /* withdrawal guard */
  assert.match(hydrate, /if\(DONOR_WITHDRAW_UID\)return false/);
  /* a member record without an explicit status is no longer treated as pending */
  assert.match(hydrate, /String\(member\.status\|\|member\.donorStatus\|\|""\)/);
  assert.doesNotMatch(hydrate, /member\.donorStatus\|\|"pending"/);
  /* explicit pending/approved/rejected only */
  assert.match(hydrate, /if\(st==="pending"\|\|st==="approved"\|\|st==="rejected"\)/);
});

test("Re-applying clears the previous rejection note", () => {
  const becomeSubmit = doner.slice(doner.indexOf('$("#becomeForm").addEventListener("submit"'));
  assert.match(becomeSubmit, /d\.donorRejectNote=""/);
  assert.match(becomeSubmit, /paths\[`users\/\$\{uid\}\/donorRejectNote`\]=null/);
});

test("Rejection note from staff syncs into the donor panel", () => {
  assert.match(doner, /STORE\.donor\.donorRejectNote = String\(row\.donorRejectNote\|\|""\)\.trim\(\)/);
  /* rejection notification carries the saved reason when present */
  assert.match(doner, /donorRejectNote\?`কারণ: \$\{STORE\.donor\.donorRejectNote\}`/);
});

/* ════════════════ Admin + Moderator — বাতিল workflow ════════════════ */

for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
  test(`${name}: rejection reason is optional (no "কারণ লিখতে হবে" validation)`, () => {
    const sheet = fnSource(src, "function rejectSheet(");
    assert.match(sheet, /বাতিলের কারণ <b>ঐচ্ছিক<\/b>/);
    assert.match(sheet, /কারণ না দিয়েও বাতিল করা যাবে/);
    /* no required-reason validation — the sheet proceeds with an empty note */
    assert.doesNotMatch(sheet, /return toast\("কারণ লিখতে হবে","er"\)/);
    assert.doesNotMatch(sheet, /কারণ ছাড়া বাতিল করা যাবে না/);
  });

  test(`${name}: rejecting a donor application clears pending queue/member state`, () => {
    const decide = fnSource(src, "async function decide(");
    const rejectBlock = decide.slice(decide.indexOf("if(q.kind===\"donor\"&&owner){", decide.indexOf("if(!ok){")));
    assert.ok(rejectBlock, "donor reject block missing");
    assert.match(rejectBlock, /paths\[`users\/\$\{owner\}\/donorStatus`\]="rejected"/);
    assert.match(rejectBlock, /donorRejectNote`\]=String\(note\)\.slice\(0,200\)/);
    assert.match(rejectBlock, /paths\[`members\/\$\{q\.memberId\}`\]=null/);
    assert.match(rejectBlock, /members\.filter\(sameOwner\)\.forEach\(m=>\{if\(m\.id\)paths\[`members\/\$\{m\.id\}`\]=null;\}\)/);
    assert.match(rejectBlock, /DB\.queue\.filter\(x=>x&&x\.kind==="donor"&&String\(x\.ownerUid\|\|x\.uid\|\|""\)\.trim\(\)===owner&&x\.id!==id\)/);
  });

  test(`${name}: approving a donor application completes it (no stale pending left)`, () => {
    const decide = fnSource(src, "async function decide(");
    const approveBlock = decide.slice(
      decide.indexOf('if(q.kind==="donor"&&ok){'),
      decide.indexOf('} else if(q.kind==="donation"&&ok){')
    );
    assert.match(approveBlock, /paths\[`users\/\$\{q\.ownerUid\}\/donorStatus`\]="approved"/);
    assert.match(approveBlock, /donorRejectNote`\]=null/);
    assert.match(approveBlock, /DB\.queue\.filter\(x=>x&&x\.kind==="donor"&&String\(x\.ownerUid\|\|x\.uid\|\|""\)\.trim\(\)===String\(q\.ownerUid\)&&x\.id!==id\)/);
  });

  test(`${name}: pending queue row is removed and queue entry always cleared`, () => {
    const decide = fnSource(src, "async function decide(");
    assert.match(decide, /paths\[`queue\/\$\{id\}`\]=null/);
    assert.match(decide, /DB\.queue\.splice\(i,1\)/);
    /* same-owner duplicate donor applications also leave the local list */
    assert.match(decide, /DB\.queue=DB\.queue\.filter\(x=>!\(x&&x\.kind==="donor"&&String\(x\.ownerUid\|\|x\.uid\|\|""\)\.trim\(\)===dupOwner&&x\.id!==q\.id\)\)/);
  });
}

/* ════════════════ Approved-donation workflow stays untouched ════════════════ */

test("Approved donation verify/delete workflow is unchanged", () => {
  for (const [name, src] of [["Admin", admin], ["Moderator", moderator]]) {
    const decide = fnSource(src, "async function decide(");
    /* donation approvals still write the approved record + donor stats */
    assert.match(decide, /paths\[`donations\/\$\{record\.id\}`\]=record/);
    assert.match(decide, /paths\[`donors\/\$\{d\.id\}\/totalDonations`\]=count/);
    assert.match(decide, /verifiedDonations\//);
    /* proof validation for donation verifications remains */
    assert.match(fnSource(src, "function reviewWarning("), /q\.kind==="donation"&&!\q\.proof/);
    /* both panels share the same pure donation log implementation */
    assert.match(src, /makeApprovedDonationRecord/);
  }
  const donationLog = read("src/lib/donationLog.ts");
  assert.match(donationLog, /export async function makeApprovedDonationRecord/);
  assert.match(donationLog, /export async function deleteApprovedDonation/);
});
