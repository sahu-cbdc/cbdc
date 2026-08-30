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
  const s = String(date || "") + "|" + String(place || "");
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

/** Stats derived from the authoritative approved-donation records. */
export function donorStatsFromRecords(records: Array<any> | null | undefined): DonorStats {
  const recs = (records || []).filter(Boolean);
  return {
    lives: recs.length, // 1 approved donation event = 1 life
    bags: recs.reduce((s, r) => s + Math.max(0, Math.floor(Number(r?.bags) || 0)), 0),
    last:
      recs
        .map((r) => String(r?.date || ""))
        .filter(Boolean)
        .sort()
        .pop() || "",
  };
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
     boolean as a URL stores literal "true" and loses the image. */
  const queuedProof =
    typeof q?.proofUrl === "string"
      ? q.proofUrl
      : typeof q?.proof === "string"
        ? q.proof
        : "";
  let proof = String(queuedProof || "").trim();
  if (!proof && owner) {
    try {
      const u = await io.getRow("users", owner).catch(() => null);
      const arr = Array.isArray(u?.data?.donations) ? u.data.donations : [];
      const hit = arr.find(
        (x: any) =>
          String(x?.date || "") === String(q?.date || "") &&
          String(x?.place || "") === String(q?.place || "")
      );
      proof = String(hit?.proof || "").trim();
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
  all.push(record);
  if (oid && oid !== record.id) paths[`donations/${oid}`] = null;

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

  let all: any[] = [];
  if (io.listOnce) all = ((await io.listOnce("donations")) || []).filter(
    (r) => r && String(r.donorId || "") === donorId
  );
  all = all.filter((r) => String(r.id) !== String(record.id));
  const stats = donorStatsFromRecords(all);
  if (donorId) {
    paths[`donors/${donorId}/donations`] = stats.lives;
    paths[`donors/${donorId}/totalDonations`] = stats.lives;
    paths[`donors/${donorId}/totalBags`] = stats.bags;
    paths[`donors/${donorId}/lastDonationDate`] = stats.last || "";
  }
  if (owner) {
    const u = await io.getRow("users", owner).catch(() => null);
    const arr = Array.isArray(u?.data?.donations) ? u.data.donations : [];
    arr.forEach((x: any, i: number) => {
      if (donationVerKey(x?.date, x?.place) === oldKey) {
        paths[`users/${owner}/data/donations/${i}/ok`] = false;
      }
    });
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

/* keep a usable default export for existing call sites */
export default {
  donationVerKey,
  safeDonationId,
  donorStatsFromRecords,
  makeApprovedDonationRecord,
  writeApprovedDonation,
  deleteApprovedDonation,
  backfillApprovedDonations,
};
