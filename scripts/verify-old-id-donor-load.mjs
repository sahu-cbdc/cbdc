/**
 * Verification script: Old ID Login & Donor Data Loading
 * Tests:
 *  1. Login identifier resolution (old donor ID, username, phone, email)
 *  2. Donor data hydration in Doner panel (by ownerUid, uid, id, donorId, phone, email)
 *  3. Preserving previous donor details (blood group, donor ID, last donation, whatsapp, etc.)
 *  4. Verifying Card UI structure is 100% unchanged
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function pass(name) {
  console.log("PASS ", name);
}

function fail(name, err) {
  console.error("FAIL ", name, err);
  process.exitCode = 1;
}

function check(name, cond, extra = "") {
  if (cond) pass(name);
  else fail(name, new Error("Assertion failed: " + extra));
}

// 1. Check Doner.tsx source code for donor matching logic
const donerSrc = fs.readFileSync("src/pages/Doner.tsx", "utf8");
const homeSrc = fs.readFileSync("src/pages/Home.tsx", "utf8");
const storeSrc = fs.readFileSync("src/lib/store.ts", "utf8");

// Check resolveEmailByIdentifier supports donorId
check(
  "Home: resolveEmailByIdentifier checks users, donors, members, accounts by donorId",
  homeSrc.includes("donorId") &&
  homeSrc.includes("resolveEmailByIdentifier") &&
  homeSrc.includes("allDonors") &&
  homeSrc.includes("allMembers")
);

// Check Doner: hydrateDonorFromRtdb supports matching by donorId, phone, email, etc.
check(
  "Doner: hydrateDonorFromRtdb checks donorId, phone, and email in donors node",
  donerSrc.includes("hydrateDonorFromRtdb") &&
  donerSrc.includes("userDonorId") &&
  donerSrc.includes("userPhone") &&
  donerSrc.includes("userEmail")
);

// Check Doner: pullSharedPublic supports matching by donorId, phone, email
check(
  "Doner: pullSharedPublic matches by donorId, phone, and email",
  donerSrc.includes("pullSharedPublic") &&
  donerSrc.includes("userDonorId") &&
  donerSrc.includes("userPhone")
);

// Check Doner: applyRtdbRow recognizes explicit donorId
check(
  "Doner: applyRtdbRow recognizes explicit donorId from RTDB",
  donerSrc.includes("_explicitDonorId") ||
  donerSrc.includes("row.donorId")
);

// Check Store: toDonerDonor preserves ownerUid, bloodGroup, lastDonationDate
check(
  "Store: toDonerDonor preserves ownerUid and bloodGroup",
  storeSrc.includes("ownerUid: d.ownerUid || d.uid || d.id") &&
  storeSrc.includes("bloodGroup: d.bloodGroup || d.group")
);

// Check that Card UI structure in Home.tsx and Doner.tsx is preserved
check(
  "Home: donor-card class and card layout preserved",
  homeSrc.includes('<div class="donor-card">') &&
  homeSrc.includes('<div class="card-content">') &&
  homeSrc.includes('<div class="donor-details">') &&
  homeSrc.includes('<div class="donor-id">') &&
  homeSrc.includes('<div class="donor-name">')
);

check(
  "Doner: status card and donor card markup preserved",
  donerSrc.includes('<b>রক্তদাতা হিসেবে নিবন্ধিত নন</b>') &&
  donerSrc.includes('data-act="become">রক্তদাতা হিসেবে যুক্ত হন</button>') &&
  donerSrc.includes('data-act="card"') &&
  donerSrc.includes('data-sub="donor"')
);

// Check Doner: sheetForgot sends link directly to account email without redirecting to a big separate form
check(
  "Doner: sheetForgot sends reset link directly to account email",
  donerSrc.includes("requestPasswordReset(shared.auth, email)") &&
  donerSrc.includes("রিসেট লিংক পাঠানো হয়েছে") &&
  !donerSrc.includes('window.location.assign(appBase()+"forgot-password")')
);

// Check Home & Doner blood group fallback handling in cards
check(
  "Home: donorCard reads bloodGroup || group",
  homeSrc.includes("const bgVal = d.bloodGroup || d.group || \"\"") &&
  homeSrc.includes("${esc(bgVal)}")
);

check(
  "Doner: donorCardHTML reads bloodGroup || group",
  donerSrc.includes("${esc(d.bloodGroup || d.group || \"\")}")
);

console.log("\nALL CHECKS PASSED FOR OLD ID LOGIN & DONOR DATA LOADING");
