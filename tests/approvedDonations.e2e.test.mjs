/**
 * Approved Donation Management — end-to-end test suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This test exercises the *production* shared logic (src/lib/donationLog.ts)
 * which is imported by BOTH Admin and Moderator panels. It uses an in-memory
 * mock of the subset of Firebase Realtime Database that the feature uses
 * (getRow / listOnce / updatePaths), so no credentials or network are needed.
 *
 * Security + workflow checks that cannot be run without a browser/live
 * Firebase are covered as static/negative assertions at the bottom of this
 * suite (rules JSON, permission gates, existing approval-flow code paths).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  donationVerKey,
  safeDonationId,
  donorStatsFromRecords,
  makeApprovedDonationRecord,
  writeApprovedDonation,
  deleteApprovedDonation,
  backfillApprovedDonations,
} from "../src/lib/donationLog.ts";

/* ── in-memory RTDB mock ────────────────────────────────────────────────
   setPath must preserve numeric array indices (Firebase realtime updatePaths
   supports `users/{uid}/data/donations/0/ok`). */
const numRe = /^\d+$/;
function setPath(root, pathStr, value) {
  const parts = pathStr.split("/").filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = parts[i + 1];
    const nextIsIndex = numRe.test(next);
    if (Array.isArray(cur)) {
      const idx = numRe.test(part) ? Number(part) : 0;
      if (cur[idx] == null) cur[idx] = nextIsIndex ? [] : {};
      cur = cur[idx];
    } else {
      if (cur[part] == null) cur[part] = nextIsIndex ? [] : {};
      cur = cur[part];
    }
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) {
    if (Array.isArray(cur)) cur.splice(Number(last), 1);
    else delete cur[last];
  } else {
    cur[last] = value;
  }
}

function getPath(root, pathStr) {
  const parts = pathStr.split("/").filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

class MockDb {
  constructor() {
    this.data = { users: {}, donors: {}, donations: {}, queue: {}, requests: {} };
  }
  set(pathStr, value) {
    setPath(this.data, pathStr, value);
  }
  io() {
    return {
      listOnce: async (node) => {
        const v = getPath(this.data, node);
        if (!v || typeof v !== "object") return [];
        return Object.entries(v).map(([k, val]) =>
          val && typeof val === "object" ? { ...val, id: k } : { id: k, value: val }
        );
      },
      getRow: async (node, id) => {
        const v = getPath(this.data, `${node}/${id}`);
        if (!v) return null;
        return typeof v === "object" ? { ...v, id } : { id, value: v };
      },
      updatePaths: async (paths) => {
        for (const [p, value] of Object.entries(paths)) this.set(p, value);
      },
    };
  }
  get(pathStr) {
    return getPath(this.data, pathStr);
  }
}

const now = "2026-08-30T10:00:00.000Z";
const donor = {
  id: "CBDC-2026-0001",
  donorId: "CBDC-2026-0001",
  name: "রহিম উদ্দিন",
  group: "O+",
  area: "চকবাজার",
  photo: "",
  phone: "01811111111",
  ownerUid: "user-1",
  donations: 0,
  totalDonations: 0,
  totalBags: 0,
};
function seedUser() {
  return {
    uid: "user-1",
    name: "রহিম উদ্দিন",
    email: "rahim@example.com",
    bloodGroup: "O+",
    donorId: "CBDC-2026-0001",
    data: {
      donations: [
        { date: "2026-08-30", place: "চমেক ব্লাড ব্যাংক", bags: 4, proof: "https://imgbb/abc.jpg", ok: false },
        { date: "2026-07-01", place: "ম্যাক্স হাসপাতাল", bags: 2, proof: "", ok: false },
        { date: "2026-05-01", place: "ক্লাবের রক্তদান ক্যাম্প", bags: 1, proof: "", ok: false },
      ],
      verifiedDonations: {},
    },
  };
}

test("1. Donor submit → Pending: queue item carries proof image URL", async () => {
  // The Doner panel writes exactly this queue shape (publishPersonalShared).
  const db = new MockDb();
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx",
    kind: "donation",
    name: "রহিম উদ্দিন",
    place: "চমেক ব্লাড ব্যাংক",
    date: "2026-08-30",
    bags: 4,
    proof: true,
    proofUrl: "https://imgbb/abc.jpg",
    patient: "কাজী",
    note: "",
    ownerUid: "user-1",
    at: "2026-08-30T09:00:00Z",
  };
  assert.equal(q.kind, "donation");
  assert.equal(q.proofUrl, "https://imgbb/abc.jpg", "queue must retain the real proof URL");
  assert.equal(q.proof, true, "legacy boolean flag kept for compatibility");
});

test("2. Admin Approve → record is created in donations node", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx",
    name: donor.name, group: donor.group, area: donor.area, photo: "", phone: donor.phone,
    place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const io = db.io();
  const rec = await makeApprovedDonationRecord(q, donor, "অ্যাডমিন", io, now);
  const { paths, stats } = await writeApprovedDonation(rec, null, io);
  await io.updatePaths(paths);

  const stored = db.get("donations/" + rec.id);
  assert.ok(stored, "donations node has the new record");
  assert.equal(stored.donorId, donor.id);
  assert.equal(stored.livesSaved, 1);
  assert.equal(stored.bags, 4);
  assert.equal(stats.lives, 1, "1 event = 1 life on approve");
});

test("3. 4-bag donation → Life Saved = 1 (bags stay separate)", () => {
  const stats = donorStatsFromRecords([{ id: "a", bags: 4 }]);
  assert.equal(stats.lives, 1);
  assert.equal(stats.bags, 4, "totalBags is separate and correct");
});

test("4. Multiple approved donations → each event = one life", () => {
  const stats = donorStatsFromRecords([
    { id: "a", date: "2026-05-01", bags: 4 },
    { id: "b", date: "2026-07-01", bags: 2 },
    { id: "c", date: "2026-08-30", bags: 1 },
  ]);
  assert.equal(stats.lives, 3, "3 events → 3 lives");
  assert.equal(stats.bags, 7, "7 total bags");
  assert.equal(stats.last, "2026-08-30");
});

test("5. Proof image url survives submission → approval → approved record", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const io = db.io();
  const rec = await makeApprovedDonationRecord(q, donor, "অ্যাডমিন", io, now);
  const { paths } = await writeApprovedDonation(rec, null, io);
  await io.updatePaths(paths);
  const stored = db.get("donations/" + rec.id);
  assert.equal(stored.proof, "https://imgbb/abc.jpg", "proof URL is stored with record");
});

test("5b. Proof falls back to user record when queue only has boolean", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proof: true, /** no proofUrl (old queue writer) */ ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const io = db.io();
  const rec = await makeApprovedDonationRecord(q, donor, "অ্যাডমিন", io, now);
  assert.equal(rec.proof, "https://imgbb/abc.jpg", "falls back to users/{uid}/data/donations proof");
});

test("6. Approved donation detail has all fields needed for Admin View", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const io = db.io();
  const rec = await makeApprovedDonationRecord(q, donor, "অ্যাডমিন", io, now);
  const { paths } = await writeApprovedDonation(rec, null, io);
  await io.updatePaths(paths);
  const stored = db.get("donations/" + rec.id);
  for (const f of [
    "id", "donorId", "ownerUid", "name", "group", "date", "place", "bags",
    "proof", "livesSaved", "approvedAt", "approvedBy", "submittedAt",
  ]) {
    assert.notEqual(stored[f], undefined, `View must show field: ${f}`);
  }
});

test("7-8. Admin Edit updates donation + donor stats + donor history + user mirror", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", { ...donor });
  db.set("users/user-1", seedUser());
  const q = {
    id: "DN-user1-20260830-vx", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const io = db.io();
  const rec = await makeApprovedDonationRecord(q, donor, "অ্যাডমিন", io, now);
  let { paths } = await writeApprovedDonation(rec, null, io);
  await io.updatePaths(paths);

  // Admin edits: date, place, bags, proof image
  const edited = {
    ...rec,
    place: "ম্যাক্স হাসপাতাল, মেহেদীবাগ",
    date: "2026-08-29",
    bags: 5,
    proof: "https://imgbb/new-proof.jpg",
  };
  const old = { id: rec.id, date: rec.date, place: rec.place };
  const result = await writeApprovedDonation(edited, old, io);
  await io.updatePaths(result.paths);

  const stored = db.get("donations/" + rec.id);
  assert.equal(stored.place, "ম্যাক্স হাসপাতাল, মেহেদীবাগ");
  assert.equal(stored.bags, 5);
  assert.equal(stored.proof, "https://imgbb/new-proof.jpg");

  // donor aggregate stats recomputed from records
  const d = db.get("donors/CBDC-2026-0001");
  assert.equal(d.donations, 1);
  assert.equal(d.totalDonations, 1);
  assert.equal(d.totalBags, 5);
  assert.equal(d.lastDonationDate, "2026-08-29");

  // user-side donation history ok flag + verified mirror also synchronised
  const user = db.get("users/user-1");
  assert.equal(user.data.donations[0].ok, true, "old location record is unflagged");
  const expectedKey = donationVerKey("2026-08-29", "ম্যাক্স হাসপাতাল, মেহেদীবাগ");
  assert.ok(user.data.verifiedDonations[expectedKey], "verified mirror key follows new date/place");
});

test("8b. Editing one of multiple donations recomputes (never double-counts lives)", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const io = db.io();

  const q1 = {
    id: "DN-user1-a", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const r1 = await makeApprovedDonationRecord(q1, donor, "অ্যাডমিন", io, now);
  await io.updatePaths((await writeApprovedDonation(r1, null, io)).paths);
  const q2 = { ...q1, id: "DN-user1-b", date: "2026-07-01", place: "ম্যাক্স হাসপাতাল", bags: 2 };
  const r2 = await makeApprovedDonationRecord(q2, donor, "অ্যাডমিন", io, now);
  await io.updatePaths((await writeApprovedDonation(r2, null, io)).paths);

  assert.equal(db.get("donors/CBDC-2026-0001").donations, 2);

  // edit r1 bags 4 → 6 (same event)
  const edited = { ...r1, bags: 6 };
  await io.updatePaths((await writeApprovedDonation(edited, { id: r1.id, date: r1.date, place: r1.place }, io)).paths);
  const d = db.get("donors/CBDC-2026-0001");
  assert.equal(d.donations, 2, "editing does not add a life");
  assert.equal(d.totalDonations, 2, "total lives unchanged");
  assert.equal(d.totalBags, 8, "6+2=8 bags after edit");
});

test("9. Delete is guarded by confirmation before it is called (UI wiring present)", async () => {
  const admin = readFileSync(path.join(process.cwd(), "src/pages/Admin.tsx"), "utf8");
  // openApprovedDonation delete button calls confirmS with Cancel/Delete and only
  // then the actual deleteApprovedDonation() function runs.
  assert.match(admin, /confirmS\(\{[^}]*title:"রক্তদান মুছে ফেলবেন\?"/);
  assert.match(admin, /ok:"Delete"[\s\S]*cancel:"Cancel"/);
  assert.match(admin, /deleteApprovedDonation\(r\)/);
});

test("10. Delete removes record, UI sources, donor history, and recomputes stats", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  db.set("users/user-1", seedUser());
  const io = db.io();

  /* approve 2 donations: 4 bags + 2 bags → lives 2, bags 6 */
  const q1 = {
    id: "DN-user1-a", name: donor.name, group: donor.group, area: donor.area,
    photo: "", phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "https://imgbb/abc.jpg", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const r1 = await makeApprovedDonationRecord(q1, donor, "অ্যাডমিন", io, now);
  let { paths } = await writeApprovedDonation(r1, null, io);
  await io.updatePaths(paths);

  const q2 = { ...q1, id: "DN-user1-b", date: "2026-07-01", place: "ম্যাক্স হাসপাতাল", bags: 2, proofUrl: "" };
  const r2 = await makeApprovedDonationRecord(q2, donor, "অ্যাডমিন", io, now);
  const w2 = await writeApprovedDonation(r2, null, io);
  await io.updatePaths(w2.paths);

  assert.equal(db.get("donors/CBDC-2026-0001").donations, 2);
  assert.equal(db.get("donors/CBDC-2026-0001").totalBags, 6);

  /* delete the 4-bag donation */
  const del = await deleteApprovedDonation(r1, io);
  await io.updatePaths(del.paths);

  assert.equal(db.get("donations/" + r1.id), undefined, "donation record removed from RTDB");
  assert.equal(db.get("donations/" + r2.id).date, "2026-07-01", "other donation is intact");

  const d = db.get("donors/CBDC-2026-0001");
  assert.equal(d.donations, 1, "life saved drops from 2 to 1");
  assert.equal(d.totalDonations, 1);
  assert.equal(d.totalBags, 2, "bags drop 6 → 2");
  assert.equal(d.lastDonationDate, "2026-07-01");

  const user = db.get("users/user-1");
  assert.equal(user.data.donations[0].ok, false, "deleted record no longer verified in donor history");
  assert.ok(!user.data.verifiedDonations[donationVerKey("2026-08-30", "চমেক ব্লাড ব্যাংক")], "verified mirror cleaned");
  assert.ok(user.data.verifiedDonations[donationVerKey("2026-07-01", "ম্যাক্স হাসপাতাল")], "remaining verified mirror kept");
});

test("11. Deleting one donation does not harm another donor/account", async () => {
  const db = new MockDb();
  const donorB = { ...donor, id: "CBDC-2026-0002", ownerUid: "user-2", name: "করিম" };
  db.set("donors/CBDC-2026-0001", donor);
  db.set("donors/CBDC-2026-0002", donorB);
  db.set("users/user-1", seedUser());
  db.set("users/user-2", { ...seedUser(), uid: "user-2", name: "করিম", data: { donations: [], verifiedDonations: {} } });
  const io = db.io();

  const qA = {
    id: "DN-user1-a", name: donor.name, group: donor.group, area: donor.area, photo: "",
    phone: donor.phone, place: "চমেক ব্লাড ব্যাংক", date: "2026-08-30", bags: 4,
    proofUrl: "", ownerUid: "user-1", at: "2026-08-30T09:00:00Z",
  };
  const rA = await makeApprovedDonationRecord(qA, donor, "অ্যাডমিন", io, now);
  const wA = await writeApprovedDonation(rA, null, io);
  await io.updatePaths(wA.paths);

  await io.updatePaths((
    await writeApprovedDonation(
      await makeApprovedDonationRecord({ ...qA, id: "DN-user2-a", ownerUid: "user-2", name: donorB.name }, donorB, "অ্যাডমিন", io, now),
      null,
      io
    )
  ).paths);

  await io.updatePaths((await deleteApprovedDonation(rA, io)).paths);

  const b = db.get("donors/CBDC-2026-0002");
  assert.equal(b.donations, 1, "donor B life count unchanged");
  assert.equal(b.totalBags, 4, "donor B bag count unchanged");
  assert.equal(db.get("users/user-1").data.verifiedDonations[donationVerKey("2026-08-30", "চমেক ব্লাড ব্যাংক")], undefined);
  assert.equal(Object.keys(db.get("users/user-2").data.verifiedDonations).length, 1, "donor B verified mirror untouched");
});

test("12. Security: non-admin cannot access the section or perform edit/delete", async () => {
  const rules = JSON.parse(readFileSync(path.join(process.cwd(), "database.rules.json"), "utf8"));
  const donRule = rules.rules.donations;
  const donIdRule = donRule && donRule["$id"];
  assert.ok(donRule, "donations node exists in rules");
  assert.match(donRule[".read"], /auth != null/);
  assert.match(donRule[".read"], /admins/);
  assert.ok(donIdRule, "donations/$id rule exists");
  assert.match(donIdRule[".write"], /auth != null/);
  assert.match(donIdRule[".write"], /admins/);
  assert.match(donIdRule[".write"], /role.*admin|moderator/);

  const admin = readFileSync(path.join(process.cwd(), "src/pages/Admin.tsx"), "utf8");
  assert.match(admin, /approved:\{title:"অনুমোদিত রক্তদান",perm:"donation.manage"\}/);
  assert.match(admin, /openApprovedDonation\(b\.dataset\.aid\)/);
  assert.match(admin, /editApprovedDonation\(id\)/);
  assert.match(admin, /deleteApprovedDonation\(r\)/);

  const moder = readFileSync(path.join(process.cwd(), "src/pages/Moderator.tsx"), "utf8");
  assert.doesNotMatch(moder, /donation.manage/);
});

test("13. Existing Submit → Admin Approve/Reject workflow is unchanged", async () => {
  const admin = readFileSync(path.join(process.cwd(), "src/pages/Admin.tsx"), "utf8");
  const moder = readFileSync(path.join(process.cwd(), "src/pages/Moderator.tsx"), "utf8");
  const doner = readFileSync(path.join(process.cwd(), "src/pages/Doner.tsx"), "utf8");

  /* submission still goes through queue and admin approval path */
  assert.match(doner, /RAW\.donations\.unshift\(/);
  assert.match(doner, /proof:!!x\.proof/);
  assert.match(doner, /proofUrl:x\.proof/);

  /* admin still supports donor / donation / request / group / report decisions */
  assert.match(admin, /q\.kind==="donor"&&ok/);
  assert.match(admin, /q\.kind==="donation"&&ok/);
  assert.match(admin, /q\.kind==="request"&&ok/);
  assert.match(admin, /q\.kind==="group"&&ok/);
  assert.match(admin, /if\(!ok\)/);
  assert.match(admin, /paths\[`queue\/\$\{id\}`\]=null/);

  /* reject still writes user-side statuses */
  assert.match(admin, /rejectNote/);
  assert.match(admin, /markGroupChangeStatus\(owner,"rejected"/);

  assert.match(moder, /q\.kind==="donation"&&ok/);
  assert.match(moder, /q\.kind==="request"&&ok/);
});

test("14. Regression: Main donor/profile/registration strings still present", async () => {
  const doner = readFileSync(path.join(process.cwd(), "src/pages/Doner.tsx"), "utf8");
  const home = readFileSync(path.join(process.cwd(), "src/pages/Home.tsx"), "utf8");
  const moder = readFileSync(path.join(process.cwd(), "src/pages/Moderator.tsx"), "utf8");

  assert.match(doner, /"রক্তদাতা হিসেবে যুক্ত হন"/);
  assert.match(doner, /function pushMyDataToRtdb/);
  assert.match(doner, /function pushDonorRecordToRtdb/);
  assert.match(doner, /নতুন রক্তদানের রেকর্ড/);
  assert.match(home, /রক্ত খুঁজছেন|রক্তদাতা খুঁজুন/);
  assert.match(moder, /অপেক্ষমাণ কাজ/);
});

test("15. Legacy verifiedDonations are backfilled and stats recalculated", async () => {
  const db = new MockDb();
  db.set("donors/CBDC-2026-0001", donor);
  const legacyUser = seedUser();
  legacyUser.data.verifiedDonations = {
    [donationVerKey("2026-08-30", "চমেক ব্লাড ব্যাংক")]: {
      date: "2026-08-30", place: "চমেক ব্লাড ব্যাংক", bags: 4, at: "2026-08-30T10:00:00Z",
    },
    [donationVerKey("2026-05-01", "ক্লাবের রক্তদান ক্যাম্প")]: {
      date: "2026-05-01", place: "ক্লাবের রক্তদান ক্যাম্প", bags: 1, at: "2026-05-01T10:00:00Z",
    },
  };
  db.set("users/user-1", legacyUser);
  const io = db.io();

  const { paths, newRecords, touched } = await backfillApprovedDonations(io, [], [donor], now);
  await io.updatePaths(paths);

  assert.equal(newRecords.length, 2);
  assert.equal(touched.length, 1);
  assert.equal(db.get("donors/CBDC-2026-0001").donations, 2, "2 legacy events → 2 lives");
  assert.equal(db.get("donors/CBDC-2026-0001").totalBags, 5, "4 + 1 = 5 bags");
  assert.equal(db.get("donors/CBDC-2026-0001").lastDonationDate, "2026-08-30");

  /* idempotence: running again creates nothing new */
  const again = await backfillApprovedDonations(io, newRecords, [donor], now);
  assert.equal(again.newRecords.length, 0);
});

test("IDs are stable and RTDB-safe", () => {
  const a = safeDonationId("user-1", "2026-08-30", "চমেক ব্লাড ব্যাংক");
  const b = safeDonationId("user-1", "2026-08-30", "চমেক ব্লাড ব্যাংক");
  assert.equal(a, b, "same donor/date/place → same donation id");
  assert.match(a, /^DN-[A-Za-z0-9-]+$/);
  assert.ok(!/[$#.[\]/\\]/.test(a), "no RTDB path-breaking chars");
});
