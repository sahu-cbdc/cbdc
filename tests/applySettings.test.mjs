/**
 * Approval Settings → server-side direct processing (OFF paths)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Admin Panel-এর «অনুমোদন ও সেটিংস»-এর সুইচ OFF থাকলে কোন কাজ সরাসরি process
 *  হয় (approval queue-তে যায় না), আর ON থাকলে approval queue-তে যেতে হয়।
 *  non-staff ব্যবহারকারীর জন্য সরাসরি লেখা কেবল সার্ভারের privileged IO দিয়ে
 *  সম্ভব — তাই `server/applyApi.ts`-এর pure handler-কে injectable in-memory
 *  `ApplyIo` দিয়ে এখানে যাচাই করা হয়।
 *
 *  কভারেজ: donor / bloodGroup / donation — প্রতিটির ON (approvalRequired) ও
 *  OFF (সরাসরি + duplicate রোধ) পথ; unauthenticated/invalid 400/401।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../server/deleteApi.ts";
import { handleDonorApply } from "../server/applyApi.ts";
import { donationVerKey } from "../src/lib/donationLog.ts";

function setPath(root, pathStr, value) {
  const parts = pathStr.split("/").filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] == null) cur[part] = {};
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
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

function makeIo(seed) {
  const data = {
    users: {}, donors: {}, settings: {}, queue: {}, requests: {}, donations: {}, _meta: {},
  };
  function applySeed(s, prefix) {
    for (const [p, v] of Object.entries(s || {})) setPath(data, (prefix ? prefix + "/" : "") + p, v);
  }
  applySeed(seed, "");
  const io = {
    verifyToken: async () => ({ uid: "user-1", email: "a@b.c" }),
    getRow: async (node, id) => {
      const v = getPath(data, `${node}/${id}`);
      return v && typeof v === "object" ? { ...v, id } : v;
    },
    listOnce: async (node) => {
      const v = getPath(data, node);
      if (!v || typeof v !== "object") return [];
      return Object.entries(v).map(([id, row]) =>
        row && typeof row === "object" ? { ...row, id } : { id, value: row },
      );
    },
    updatePaths: async (paths) => {
      for (const [p, value] of Object.entries(paths)) setPath(data, p, value);
    },
    data,
  };
  return io;
}

const OFF = { donorApproval: false, donationApproval: false, bloodGroupApproval: false };
const ON = { donorApproval: true, donationApproval: true, bloodGroupApproval: true };
function seedUser() {
  return {
    uid: "user-1", name: "রহিম", email: "a@b.c", bloodGroup: "O+",
    area: "চকবাজার", phone: "01811111111",
  };
}

test("apply: donor OFF → donor created directly (no approval queue)", async () => {
  const io = makeIo({ "settings/app": { rules: { ...OFF } }, "users/user-1": seedUser() });
  const res = await handleDonorApply({ idToken: "t", action: "donor" }, io);
  assert.equal(res.ok, true);
  assert.equal(res.approvalRequired, false);
  assert.ok(res.donorId, "donor id issued");
  assert.equal(io.data.users["user-1"].donorStatus, "approved");
  assert.equal(io.data.users["user-1"].donorId, res.donorId);
  const donor = io.data.donors[res.donorId];
  assert.ok(donor, "donor record created");
  assert.equal(donor.name, "রহিম");
  assert.equal(donor.group, "O+");
  assert.equal(donor.verified, true);
  assert.equal(Object.keys(io.data.queue || {}).length, 0, "no queue item on OFF");
});

test("apply: donor OFF re-approve → reuses existing donor (no duplicate)", async () => {
  const io = makeIo({ "settings/app": { rules: { ...OFF } }, "users/user-1": seedUser() });
  const r1 = await handleDonorApply({ idToken: "t", action: "donor" }, io);
  const r2 = await handleDonorApply({ idToken: "t", action: "donor" }, io);
  assert.equal(r1.donorId, r2.donorId, "same donor reused");
  assert.equal(Object.keys(io.data.donors).length, 1, "no second donor record");
});

test("apply: donor ON → approvalRequired (must go to queue)", async () => {
  const io = makeIo({ "settings/app": { rules: { ...ON } }, "users/user-1": seedUser() });
  const res = await handleDonorApply({ idToken: "t", action: "donor" }, io);
  assert.equal(res.ok, false);
  assert.equal(res.approvalRequired, true);
  assert.equal(Object.keys(io.data.donors).length, 0, "no donor created when ON");
});

test("apply: bloodGroup OFF → direct change (user + donor mirror)", async () => {
  const io = makeIo({
    "settings/app": { rules: { ...OFF } },
    "users/user-1": seedUser(),
    "donors/CBDC-2026-0001": { id: "CBDC-2026-0001", ownerUid: "user-1", group: "O+", bloodGroup: "O+", name: "রহিম" },
  });
  const res = await handleDonorApply({ idToken: "t", action: "bloodGroup", to: "B+", reason: "ভুল দিয়েছি", proof: "https://imgbb/x.jpg" }, io);
  assert.equal(res.ok, true);
  assert.equal(res.approvalRequired, false);
  assert.equal(io.data.users["user-1"].bloodGroup, "B+");
  assert.equal(io.data.users["user-1"].groupChange.status, "approved");
  assert.equal(io.data.donors["CBDC-2026-0001"].bloodGroup, "B+");
  assert.equal(io.data.donors["CBDC-2026-0001"].group, "B+");
});

test("apply: bloodGroup ON → approvalRequired (never directly applied)", async () => {
  const io = makeIo({ "settings/app": { rules: { ...ON } }, "users/user-1": seedUser() });
  const res = await handleDonorApply({ idToken: "t", action: "bloodGroup", to: "B+", reason: "x" }, io);
  assert.equal(res.approvalRequired, true);
  assert.notEqual(io.data.users["user-1"].bloodGroup, "B+");
});

test("apply: donation OFF → direct verify (record + donor stats + user mirror)", async () => {
  const io = makeIo({
    "settings/app": { rules: { ...OFF } },
    "users/user-1": {
      ...seedUser(),
      data: { donations: [{ date: "2026-08-30", place: "চমেক ব্লাড ব্যাংক", bags: 4, proof: "https://imgbb/a.jpg", ok: false }], verifiedDonations: {} },
    },
    "donors/CBDC-2026-0001": { id: "CBDC-2026-0001", donorId: "CBDC-2026-0001", ownerUid: "user-1", name: "রহিম", group: "O+", area: "চকবাজার", donations: 0, totalDonations: 0, totalBags: 0 },
  });
  const res = await handleDonorApply({
    idToken: "t", action: "donation", date: "2026-08-30", place: "চমেক ব্লাড ব্যাংক",
    bags: 4, proof: "https://imgbb/a.jpg", patient: "কাজী", note: "",
  }, io);
  assert.equal(res.ok, true);
  assert.equal(res.approvalRequired, false);
  const stored = Object.values(io.data.donations).find((r) => r && r.place === "চমেক ব্লাড ব্যাংক");
  assert.ok(stored, "approved donation record created");
  assert.equal(stored.livesSaved, 1);
  assert.equal(stored.proof, "https://imgbb/a.jpg");
  const d = io.data.donors["CBDC-2026-0001"];
  assert.equal(d.donations, 1);
  assert.equal(d.totalBags, 4);
  const vk = donationVerKey("2026-08-30", "চমেক ব্লাড ব্যাংক");
  assert.ok(io.data.users["user-1"].data.verifiedDonations[vk], "verified mirror written");
  assert.equal(io.data.users["user-1"].data.donations[0].ok, true, "user record flagged ok");
});

test("apply: donation ON → approvalRequired (no record created)", async () => {
  const io = makeIo({
    "settings/app": { rules: { ...ON } },
    "users/user-1": { ...seedUser(), data: { donations: [], verifiedDonations: {} } },
    "donors/CBDC-2026-0001": { id: "CBDC-2026-0001", ownerUid: "user-1", donations: 0 },
  });
  const res = await handleDonorApply({ idToken: "t", action: "donation", date: "2026-08-30", place: "চমেক", bags: 1 }, io);
  assert.equal(res.approvalRequired, true);
  assert.equal(Object.keys(io.data.donations).length, 0, "no donation on ON");
});

test("apply: invalid action / unauthenticated / bad input rejected", async () => {
  const io = makeIo({ "settings/app": { rules: { ...OFF } }, "users/user-1": seedUser() });
  await assert.rejects(() => handleDonorApply({ idToken: "t", action: "nonsense" }, io),
    (e) => e instanceof ApiError && e.status === 400);
  const noAuth = makeIo({ "settings/app": { rules: { ...OFF } } });
  noAuth.verifyToken = async () => null;
  await assert.rejects(() => handleDonorApply({ action: "donor", idToken: "bad" }, noAuth),
    (e) => e instanceof ApiError && e.status === 401);
  await assert.rejects(() => handleDonorApply({ idToken: "t", action: "bloodGroup", to: "!!", reason: "x" }, io),
    (e) => e instanceof ApiError && e.status === 400);
  await assert.rejects(() => handleDonorApply({ idToken: "t", action: "donation", date: "bad", place: "x", bags: 1 }, io),
    (e) => e instanceof ApiError && e.status === 400);
});
