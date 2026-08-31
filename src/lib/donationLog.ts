/**
 * CBDC — Approved Donation Management (pure, testable core)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  "1 approved donation event = 1 life" is the single rule for lives saved.
 *  Bag quantity is stored/displayed separately (`totalBags`) and never used
 *  to calculate lives saved.
 *
 *  This module is intentionally framework-agnostic: it does *not* import
 *  Firebase. It works on plain records and an injected `DonationIo` so the
 *  exact production logic can be unit/integration tested without real
 *  Firebase credentials.
 */

/* ── record shapes ─────────────────────────────────────────────────────── */
export type ApprovedDonation = {
  id: string;
  donorId: string;
  ownerUid: string;
  name: string;
  group: string;
  area: string;
  photo: string;
  phone: string;
  place: string;
  date: string;
  bags: number;
  proof: string;
  patient: string;
  note: string;
  livesSaved: 1;
  approvedAt: string;
  approvedBy: string;
  updatedAt: string;
  source?: string;
  submittedAt?: string;
};

export type DonorStats = {
  lives: number;
  bags: number;
  last: string;
};

/**
 * Minimal persistence adapter. Admin and Moderator inject their own RTDB
 * helpers here (getRow/listOnce/updatePaths); tests inject an in-memory mock.
 */
export type DonationIo = {
  listOnce(node: string): Promise<any[]>;
  getRow(node: string, id: string): Promise<any | null>;
  updatePaths(paths: Record<string, any>): Promise<void>;
};

/* ── small helpers ──────────────────────────────────────────────────────── */
export const donationNowIso = (): string => new Date().toISOString();

/** Stable key for a user-side verified donation mirror (date|place). */
export function donationVerKey(date: unknown, place: unknown): string {
  /* trim — Doner প্যানেলের নিজস্ব হিসাবের সাথে হুবহু এক হতে হয়, নইলে
     date/place-এ বাড়তি স্পেস থাকলে verified mirror key আলাদা হয়ে যায় */
  const s = String(date || "").trim() + "|" + String(place || "").trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return "v" + (h >>> 0).toString(36);
}

/** Safe RTDB key for a donation record. */
export function safeDonationId(
  owner: unknown,
  date: unknown,
  place: unknown,
  raw?: unknown
): string {
  const rawId = String(raw || "").trim();
  if (rawId && rawId.length >= 8 && !/[/\\\n]/.test(rawId)) return rawId;
  const base = String(owner || "unknown")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8) || "unknown";
  return (
    "DN-" +
    base +
    "-" +
    String(date || "nodate").replace(/[^0-9]/g, "") +
    "-" +
    donationVerKey(date, place).replace(/^v/, "")
  );
}

/**
 * Return a string only when the value is genuinely usable as an `<img src>`.
 * booleans (`true`), the literal strings "true"/"false", empty/whitespace,
 * bare words and `javascript:` / `data:text/*` payloads are all rejected.
 */
export function safeImageUrl(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s || s === "true" || s === "false" || s === "null" || s === "undefined") return "";
  if (/^(https?:\/\/|data:image\/)/i.test(s)) return s;
  return "";
}

/** proofUrl is preferred, then proof, then a safe empty string. */
export function proofUrlOf(record: any): string {
  return safeImageUrl(record?.proofUrl) || safeImageUrl(record?.proof);
}

/** Stats derived from the authoritative approved-donation records. */
export function donorStatsFromRecords(records: Array<any> | null | undefined): DonorStats {
  const recs = (records || []).filter(Boolean);
  return {
    lives: recs.length, // 1 approved donation event = 1 life
    bags: recs.reduce((s, r) => s + Math.max(0, Math.floor(Number(r?.bags) || 0)), 0),
    last:
      recs
        .map((r) => String(r?.date || ""))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) /* শুধু সঠিক YYYY-MM-DD — পুরোনো/ভুল timestamp `last`-এ ঢোকে না */
        .sort()
        .pop() || "",
  };
}

/**
 * Event identity for one approved donation: the same donor donating on the
 * same date at the same place is ONE event (matches the existing user-side
 * verifiedDonations mirror, whose key is date|place).
 */
export function donationEventKey(record: any): string {
  return (
    String(record?.donorId || "") +
    "|" +
    String(record?.date || "").trim() +
    "|" +
    String(record?.place || "").trim()
  );
}

/** Quality score used when duplicate records of the same event are found —
 *  the best record (real approval timestamp + proof + last update) survives. */
function recordQuality(r: any): number {
  let q = 0;
  const at = String(r?.approvedAt || "");
  if (/^\d{4}-\d{2}-\d{2}T/.test(at)) q += 4;
  else if (at) q += 2;
  if (proofUrlOf(r)) q += 2;
  if (String(r?.updatedAt || "")) q += 1;
  return q;
}

function asDonor(d: any): ApprovedDonation | null {
  if (!d || !String(d.id || "").trim()) return null;
  return {
    id: String(d.id),
    donorId: String(d.donorId || ""),
    ownerUid: String(d.ownerUid || ""),
    name: String(d.name || ""),
    group: String(d.group || d.bloodGroup || ""),
    area: String(d.area || ""),
    photo: String(d.photo || ""),
    phone: String(d.phone || ""),
    place: String(d.place || ""),
    date: String(d.date || ""),
    bags: Math.max(1, Math.floor(Number(d.bags) || 1)),
    proof: String(d.proof || ""),
    patient: String(d.patient || ""),
    note: String(d.note || ""),
    livesSaved: 1,
    approvedAt: String(d.approvedAt || d.at || ""),
    approvedBy: String(d.approvedBy || "অ্যাডমিন"),
    updatedAt: String(d.updatedAt || ""),
    source: String(d.source || "queue"),
    submittedAt: String(d.submittedAt || ""),
  };
}

/**
 * Build the permanent approved-donation record from a queue item.
 * If the queue does not carry the proof URL, the owner's own user record is
 * read (same date+place) so the image survives the approval transition.
 */
export async function makeApprovedDonationRecord(
  q: any,
  d: any | null,
  actorName: string,
  io: DonationIo,
  at = donationNowIso()
): Promise<ApprovedDonation> {
  const owner = String(q?.ownerUid || q?.uid || "").trim();
  /* proofUrl is the real URL; legacy queue items only carry `proof:true`
     (boolean flag) and MUST fall back to the user's own record. Treating the
     boolean as a URL stores literal "true", just like any wrong/empty value.
     safeImageUrl rejects booleans, "true"/"false", empty and non-image URLs. */
  let proof = proofUrlOf(q);
  if (!proof && owner) {
    try {
      const u = await io.getRow("users", owner).catch(() => null);
      const arr = Array.isArray(u?.data?.donations) ? u.data.donations : [];
      const hit = arr.find(
        (x: any) =>
          String(x?.date || "") === String(q?.date || "") &&
          String(x?.place || "") === String(q?.place || "")
      );
      proof = proofUrlOf(hit);
    } catch {
      /* fall back to empty proof */
    }
  }
  const donorId = (d && d.id) || String(q?.donorId || "");
  const id = safeDonationId(owner, q?.date, q?.place, q?.id);
  return {
    id,
    donorId: String(donorId || ""),
    ownerUid: owner,
    name: String((d && d.name) || q?.name || ""),
    group: String((d && d.group) || q?.group || ""),
    area: String((d && d.area) || q?.area || ""),
    photo: String((d && d.photo) || q?.photo || ""),
    phone: String((d && d.phone) || q?.phone || ""),
    place: String(q?.place || ""),
    date: String(q?.date || ""),
    bags: Math.max(1, Math.floor(Number(q?.bags) || 1)),
    proof,
    patient: String(q?.patient || "").trim(),
    note: String(q?.note || "").trim(),
    livesSaved: 1,
    approvedAt: at,
    approvedBy: actorName || "অ্যাডমিন",
    updatedAt: at,
    source: "queue",
    submittedAt: String(q?.at || ""),
  };
}

/**
 * Build the atomic multi-path write for creating/editing a donation and for
 * synchronising the donor aggregate stats and the user-side verified mirror.
 *
 * Important: it *recomputes* donor stats from the authoritative records after
 * the change, rather than blindly incrementing, so edit/delete stay correct.
 */
export async function writeApprovedDonation(
  record: ApprovedDonation,
  oldRecord: { id?: string; date?: string; place?: string } | null,
  io: DonationIo
): Promise<{ paths: Record<string, any>; stats: DonorStats; all: any[] }> {
  const donorId = String(record.donorId || "");
  const owner = String(record.ownerUid || "");
  const paths: Record<string, any> = {};
  const oldKey = donationVerKey(oldRecord?.date, oldRecord?.place);
  const curKey = donationVerKey(record.date, record.place);
  const oid = String((oldRecord && oldRecord.id) || record.id || "");
  paths[`donations/${record.id}`] = record;

  /* latest full list for this donor (RTDB + this record) */
  let all: any[] = [];
  if (io.listOnce) all = ((await io.listOnce("donations")) || []).filter(
    (r) => r && String(r.donorId || "") === donorId
  );
  all = all.filter((r) => String(r.id) !== String(record.id || oid));
  if (oid && oid !== record.id) paths[`donations/${oid}`] = null;

  /* Duplicate cleanup: the same event (date|place) stored under another id
     (পুরোনো random id / double approval) is the SAME donation — remove the
     twin so the list, donor history and stats never count it twice. */
  const deduped: any[] = [];
  for (const r of all) {
    const k = donationVerKey(r?.date, r?.place);
    if ((oldRecord && oldKey && k === oldKey) || k === curKey) {
      const rid = String(r?.id || "");
      if (rid && rid !== String(record.id) && rid !== oid) paths[`donations/${rid}`] = null;
      continue;
    }
    deduped.push(r);
  }
  all = deduped;
  all.push(record);

  const stats = donorStatsFromRecords(all);
  if (donorId) {
    paths[`donors/${donorId}/donations`] = stats.lives;
    paths[`donors/${donorId}/totalDonations`] = stats.lives;
    paths[`donors/${donorId}/totalBags`] = stats.bags;
    paths[`donors/${donorId}/lastDonationDate`] = stats.last || "";
  }

  /* user-side mirror: verifiedDonations + ok flags */
  if (owner) {
    const u = await io.getRow("users", owner).catch(() => null);
    const arr = Array.isArray(u?.data?.donations) ? u.data.donations : [];
    let matchedIdx = -1;
    arr.forEach((x: any, i: number) => {
      const k = donationVerKey(x?.date, x?.place);
      if (k === curKey) {
        paths[`users/${owner}/data/donations/${i}/ok`] = true;
        paths[`users/${owner}/data/donations/${i}/bags`] = Number(record.bags) || 1;
        paths[`users/${owner}/data/donations/${i}/proof`] = record.proof || "";
        matchedIdx = i;
      } else if (oldKey && k === oldKey) {
        paths[`users/${owner}/data/donations/${i}/ok`] = false;
        matchedIdx = i;
      }
    });
    /* admin date/place edit must also update the donor's own record so both
       sides stay synchronised, not just visually hidden */
    if (matchedIdx >= 0 && oldKey && oldKey !== curKey) {
      paths[`users/${owner}/data/donations/${matchedIdx}/date`] = record.date;
      paths[`users/${owner}/data/donations/${matchedIdx}/place`] = record.place;
      paths[`users/${owner}/data/donations/${matchedIdx}/ok`] = true;
      paths[`users/${owner}/data/donations/${matchedIdx}/bags`] = Number(record.bags) || 1;
      paths[`users/${owner}/data/donations/${matchedIdx}/proof`] = record.proof || "";
    }
    const old =
      u?.data?.verifiedDonations && typeof u.data.verifiedDonations === "object"
        ? { ...u.data.verifiedDonations }
        : {};
    if (oldKey && oldKey !== curKey) delete old[oldKey];
    old[curKey] = {
      date: record.date,
      place: record.place,
      bags: Number(record.bags) || 1,
      livesSaved: 1,
      at: record.approvedAt || record.updatedAt || donationNowIso(),
      proof: record.proof || "",
    };
    paths[`users/${owner}/data/verifiedDonations`] = old;
  }

  return { paths, stats, all };
}

/** Delete + recompute donor stats + remove user-side verified mirror. */
export async function deleteApprovedDonation(
  record: ApprovedDonation,
  io: DonationIo
): Promise<{ paths: Record<string, any>; stats: DonorStats }> {
  const donorId = String(record.donorId || "");
  const owner = String(record.ownerUid || "");
  const paths: Record<string, any> = {};
  const oldKey = donationVerKey(record.date, record.place);
  paths[`donations/${record.id}`] = null;

  /* Remove the (already approved) verification queue source so a page refresh
     / next Doner sync cannot resurrect this record in রক্তদান যাচাই. */
  paths[`queue/${record.id}`] = null;
  if (io.listOnce && owner) {
    try {
      const queue = (await io.listOnce("queue")) || [];
      for (const q of queue) {
        const sameQueueItem =
          String(q?.kind || "") === "donation" &&
          String(q?.ownerUid || q?.uid || "") === owner &&
          String(q?.date || "") === String(record.date) &&
          String(q?.place || "") === String(record.place) &&
          String(q?.id || "") !== String(record.id);
        if (sameQueueItem) paths[`queue/${q.id}`] = null;
      }
    } catch {
      /* queue is optional; a missing queue node is not an error */
    }
  }

  let all: any[] = [];
  if (io.listOnce) all = ((await io.listOnce("donations")) || []).filter(
    (r) => r && String(r.donorId || "") === donorId
  );
  all = all.filter((r) => String(r.id) !== String(record.id));
  /* একই event-এর duplicate twin (ভিন্ন id) থাকলে সেটিও মুছে যায় — নইলে
     Delete-এর পরেও তালিকায়/পরিসংখ্যানে event-টি থেকে যেত। */
  const deduped: any[] = [];
  for (const r of all) {
    if (donationVerKey(r?.date, r?.place) === oldKey) {
      const rid = String(r?.id || "");
      if (rid && rid !== String(record.id)) paths[`donations/${rid}`] = null;
      continue;
    }
    deduped.push(r);
  }
  all = deduped;
  const stats = donorStatsFromRecords(all);
  if (donorId) {
    paths[`donors/${donorId}/donations`] = stats.lives;
    paths[`donors/${donorId}/totalDonations`] = stats.lives;
    paths[`donors/${donorId}/totalBags`] = stats.bags;
    paths[`donors/${donorId}/lastDonationDate`] = stats.last || "";
  }
  if (owner) {
    const u = await io.getRow("users", owner).catch(() => null);
    /* Remove the donor's own old history entry completely (not just flip ok).
       If only `ok:false` were kept, the next `publishPersonalShared` would
       re-queue it into রক্তদান যাচাই. */
    if (Array.isArray(u?.data?.donations)) {
      const kept = u.data.donations.filter(
        (x: any) => donationVerKey(x?.date, x?.place) !== oldKey
      );
      paths[`users/${owner}/data/donations`] = kept;
    }
    const old =
      u?.data?.verifiedDonations && typeof u.data.verifiedDonations === "object"
        ? { ...u.data.verifiedDonations }
        : {};
    delete old[oldKey];
    paths[`users/${owner}/data/verifiedDonations`] = old;
  }
  return { paths, stats };
}

/**
 * Backfill legacy `users/{uid}/data/verifiedDonations` entries into the
 * authoritative donations node. Idempotent by (donorId|date|place).
 */
export async function backfillApprovedDonations(
  io: DonationIo,
  existingRecords: any[],
  donors: any[],
  at = donationNowIso()
): Promise<{
  paths: Record<string, any>;
  newRecords: ApprovedDonation[];
  touched: string[];
}> {
  const paths: Record<string, any> = {};
  const newRecords: ApprovedDonation[] = [];
  const touched: string[] = [];
  const users = ((await io.listOnce("users")) || []).map((u) => ({
    ...u,
    uid: String(u?.uid || u?.id || ""),
  }));
  if (!users.length) return { paths, newRecords, touched };
  const existing = new Set(
    (existingRecords || []).map((r) => `${r.donorId}|${r.date}|${r.place}`)
  );
  for (const u of users) {
    const owner = String(u.uid || "").trim();
    const vd = u?.data?.verifiedDonations;
    if (!owner || !vd || typeof vd !== "object") continue;
    const donor = (donors || []).find((x) => String(x.ownerUid || "") === owner);
    if (!donor) continue;
    const ownDon = Array.isArray(u?.data?.donations) ? u.data.donations : [];
    for (const v of Object.values(vd)) {
      if (!v || !(v as any).date || !(v as any).place) continue;
      const key = `${donor.id}|${(v as any).date}|${(v as any).place}`;
      if (existing.has(key)) continue;
      const proof =
        String((v as any).proof || "") ||
        (ownDon.find(
          (x: any) =>
            String(x?.date || "") === String((v as any).date || "") &&
            String(x?.place || "") === String((v as any).place || "")
        ) || {}).proof ||
        "";
      const rec: ApprovedDonation = {
        id: safeDonationId(owner, (v as any).date, (v as any).place),
        donorId: String(donor.id || ""),
        ownerUid: owner,
        name: String(donor.name || ""),
        group: String(donor.group || donor.bloodGroup || ""),
        area: String(donor.area || ""),
        photo: String(donor.photo || ""),
        phone: String(donor.phone || ""),
        place: String((v as any).place || ""),
        date: String((v as any).date || ""),
        bags: Math.max(1, Math.floor(Number((v as any).bags) || 1)),
        proof,
        patient: "",
        note: "",
        livesSaved: 1,
        approvedAt: String((v as any).at || (v as any).approvedAt || ""),
        approvedBy: "আগের যাচাই",
        updatedAt: at,
        source: "legacy",
        submittedAt: "",
      };
      paths[`donations/${rec.id}`] = rec;
      newRecords.push(rec);
      existing.add(key);
      touched.push(String(donor.id || ""));
    }
  }
  if (!newRecords.length) return { paths, newRecords, touched };
  for (const donorId of [...new Set(touched)]) {
    const all = (((await io.listOnce("donations")) || []).filter(
      (r) => r && String(r.donorId || "") === donorId
    ) || []).concat(newRecords.filter((r) => String(r.donorId) === donorId));
    const stats = donorStatsFromRecords(all);
    paths[`donors/${donorId}/donations`] = stats.lives;
    paths[`donors/${donorId}/totalDonations`] = stats.lives;
    paths[`donors/${donorId}/totalBags`] = stats.bags;
    paths[`donors/${donorId}/lastDonationDate`] = stats.last || "";
  }
  return { paths, newRecords, touched: [...new Set(touched)] };
}

/**
 * One-pass reconciliation of the approved-donation data:
 *  - duplicate records of the same event (donorId|date|place) are reduced to
 *    the single best record (the rest are removed from the donations node);
 *  - every donor's stored aggregate (donations/totalDonations/totalBags/
 *    lastDonationDate) is recomputed from the surviving records, so Donor
 *    history and the approved list can never drift apart.
 *
 * Only changed paths are returned — fully consistent data causes zero writes.
 */
export async function reconcileApprovedDonations(
  io: DonationIo
): Promise<{ paths: Record<string, any>; statsByDonor: Record<string, DonorStats> }> {
  const paths: Record<string, any> = {};
  const statsByDonor: Record<string, DonorStats> = {};
  const all = ((await io.listOnce("donations")) || []).filter(Boolean);

  /* group by event and keep the single best record per event */
  const byEvent: Record<string, any[]> = {};
  for (const r of all) {
    const k = donationEventKey(r);
    if (!k) continue;
    (byEvent[k] ||= []).push(r);
  }
  const keepIds = new Set<string>();
  for (const group of Object.values(byEvent)) {
    if (group.length < 2) {
      if (String(group[0]?.id || "")) keepIds.add(String(group[0].id));
      continue;
    }
    group.sort(
      (a, b) =>
        recordQuality(b) - recordQuality(a) ||
        String(b.id).localeCompare(String(a.id))
    );
    const keep = group[0];
    if (!keep || !String(keep.id || "")) continue;
    keepIds.add(String(keep.id));
    for (const dup of group.slice(1)) {
      const rid = String(dup?.id || "");
      if (rid && rid !== String(keep.id)) paths[`donations/${rid}`] = null;
    }
  }

  /* donor aggregates — recompute for every donor that has records OR stored
     aggregates, so stale/missing counts are healed and consistent data is untouched */
  const donors = ((await io.listOnce("donors")) || []).filter(Boolean);
  const donorsWithRecords = new Set<string>();
  for (const r of all) {
    if (keepIds.has(String(r.id || "")) && String(r.donorId || ""))
      donorsWithRecords.add(String(r.donorId));
  }
  const touchedDonors = new Set<string>(donorsWithRecords);
  for (const d of donors) {
    const id = String(d?.id || d?.donorId || "");
    if (!id) continue;
    const hasStored =
      Number(d?.donations) || Number(d?.totalDonations) || Number(d?.totalBags) ||
      String(d?.lastDonationDate || d?.last || "");
    if (!donorsWithRecords.has(id) && !hasStored) continue;
    touchedDonors.add(id);
  }
  for (const id of touchedDonors) {
    const recs = all.filter(
      (r) => keepIds.has(String(r.id || "")) && String(r.donorId || "") === id
    );
    const stats = donorStatsFromRecords(recs);
    statsByDonor[id] = stats;
    const d = donors.find((x) => String(x?.id || x?.donorId || "") === id);
    if (!d) {
      if (stats.lives || stats.bags || stats.last) {
        paths[`donors/${id}/donations`] = stats.lives;
        paths[`donors/${id}/totalDonations`] = stats.lives;
        paths[`donors/${id}/totalBags`] = stats.bags;
        paths[`donors/${id}/lastDonationDate`] = stats.last || "";
      }
      continue;
    }
    if (Number(d.donations) !== stats.lives) paths[`donors/${id}/donations`] = stats.lives;
    if (Number(d.totalDonations) !== stats.lives) paths[`donors/${id}/totalDonations`] = stats.lives;
    if (Number(d.totalBags) !== stats.bags) paths[`donors/${id}/totalBags`] = stats.bags;
    const last = stats.last || "";
    if (String(d.lastDonationDate ?? d.last ?? "") !== last)
      paths[`donors/${id}/lastDonationDate`] = last;
  }

  return { paths, statsByDonor };
}

/* keep a usable default export for existing call sites */
export default {
  donationVerKey,
  safeDonationId,
  donorStatsFromRecords,
  donationEventKey,
  makeApprovedDonationRecord,
  writeApprovedDonation,
  deleteApprovedDonation,
  backfillApprovedDonations,
  reconcileApprovedDonations,
};
