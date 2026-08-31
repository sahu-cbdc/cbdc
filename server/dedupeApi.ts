

import { ApiError, isAuthUid, type DeleteIo } from "./deleteApi.ts";
import { emailIndexPath } from "./identityKey.ts";

export type DedupeIo = {
  verifyToken(idToken: string): Promise<{ uid: string } | null>;
  get(path: string): Promise<unknown>;
  list(node: string): Promise<Record<string, any> | null>;
  apply(paths: Record<string, unknown>): Promise<boolean>;
};

export type DedupeGroup = {
  
  kind: "user-email" | "donor-owner" | "donor-phone";
  
  key: string;
  
  keep: { id: string; name: string; email?: string; donorId?: string; uid?: string };
  
  remove: Array<{ id: string; name: string; email?: string; uid?: string }>;
  
  filledFields: string[];
};

export type DedupeReport = {
  ok: boolean;
  applied: boolean;
  scanned: { users: number; donors: number; emailsIndexed: number };
  groups: DedupeGroup[];
  
  notes: string[];
  
  changedPaths: number;
  error?: string;
};


function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}
function normPhone(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  
  if (d.startsWith("880") && d.length > 11) d = "0" + d.slice(3);
  return d;
}
function nameOf(row: any): string {
  return String(row?.name ?? row?.email ?? "").trim();
}
function tsOf(row: any): number {
  const raw = row?.updatedAt || row?.createdAt || row?.joined || "";
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}


const USER_FILL_FIELDS = [
  "name", "username", "phone", "dob", "gender", "area", "district", "address",
  "photoURL", "provider", "bloodGroup", "donorId", "donorStatus", "whatsapp",
  "lastDonation", "health", "cardTheme",
] as const;
const DONOR_FILL_FIELDS = [
  "name", "bloodGroup", "group", "gender", "dob", "phone", "whatsapp", "area",
  "district", "photo", "lastDonationDate", "address", "occupation",
] as const;


function uidKeyed(id: string): boolean {
  return isAuthUid(id);
}


function emailIndexKey(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

export async function handleAdminDedupe(
  input: { apply?: boolean; idToken?: string } | null | undefined,
  io: DedupeIo,
): Promise<DedupeReport> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  const me = (await io.get(`admins/${caller.uid}`).catch(() => null)) as any;
  const role = String((me && me.role) || "").toLowerCase();
  const status = String((me && me.status) || "active").toLowerCase();
  if (role !== "admin" || status === "disabled") {
    throw new ApiError(403, "শুধু অ্যাডমিন এই কাজ করতে পারেন।");
  }
  const apply = input?.apply === true;

  const userRows = (await io.list("users").catch(() => null)) || {};
  const donorRows = (await io.list("donors").catch(() => null)) || {};
  const indexRows = (await io.list("identityIndex/email").catch(() => null)) || {};

  const paths: Record<string, unknown> = {};
  const groups: DedupeGroup[] = [];
  const notes: string[] = [];
  
  const claimedBy = new Map<string, string>();
  for (const [key, val] of Object.entries(indexRows)) {
    if (typeof val === "string" && val) claimedBy.set(key, val);
  }

  
  const byEmail = new Map<string, Array<[string, any]>>();
  for (const [id, row] of Object.entries(userRows as Record<string, any>)) {
    const email = normEmail(row?.email);
    if (!email) continue;
    const list = byEmail.get(email) || [];
    list.push([id, row]);
    byEmail.set(email, list);
  }
  for (const [email, entries] of byEmail) {
    if (entries.length < 2) continue;
    
    const sorted = [...entries].sort((a, b) => {
      const ua = uidKeyed(a[0]) ? 1 : 0;
      const ub = uidKeyed(b[0]) ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return tsOf(b[1]) - tsOf(a[1]);
    });
    const [keepId, keepRow] = sorted[0];
    const twins = sorted.slice(1);
    const filled: string[] = [];
    for (const [tid, trow] of twins) {
      for (const f of USER_FILL_FIELDS) {
        const cur = String((keepRow as any)?.[f] ?? "").trim();
        const alt = String(trow?.[f] ?? "").trim();
        if (!cur && alt) {
          paths[`users/${keepId}/${f}`] = alt;
          filled.push(f);
        }
      }
      paths[`users/${tid}`] = null;
      
      const twinEmail = normEmail(trow?.email);
      if (twinEmail && claimedBy.get(emailIndexKey(twinEmail)) === tid) {
        paths[emailIndexPath(twinEmail)] = keepId;
      }
    }
    paths[emailIndexPath(email)] = keepId;
    groups.push({
      kind: "user-email",
      key: email,
      keep: { id: keepId, name: nameOf(keepRow), email: normEmail(keepRow?.email), uid: keepId },
      remove: twins.map(([id, r]) => ({ id, name: nameOf(r), email: normEmail(r?.email), uid: id })),
      filledFields: [...new Set(filled)],
    });
  }

  
  const byOwner = new Map<string, Array<[string, any]>>();
  const ownerlessByPhone = new Map<string, Array<[string, any]>>();
  for (const [id, row] of Object.entries(donorRows as Record<string, any>)) {
    const owner = String(row?.ownerUid || row?.uid || "").trim();
    if (owner && isAuthUid(owner)) {
      const list = byOwner.get(owner) || [];
      list.push([id, row]);
      byOwner.set(owner, list);
    } else {
      const ph = normPhone(row?.phone);
      if (ph.length >= 11) {
        const list = ownerlessByPhone.get(ph) || [];
        list.push([id, row]);
        ownerlessByPhone.set(ph, list);
      }
    }
  }
  for (const [owner, entries] of byOwner) {
    if (entries.length < 2) continue;
    
    let linkedId = "";
    try {
      const u = (await io.get(`users/${owner}`).catch(() => null)) as any;
      linkedId = String(u?.donorId || "").trim();
    } catch {  }
    const sorted = [...entries].sort((a, b) => {
      const la = a[0] === linkedId ? 1 : 0;
      const lb = b[0] === linkedId ? 1 : 0;
      if (la !== lb) return lb - la;
      return tsOf(a[1]) - tsOf(b[1]);
    });
    const [keepId, keepRow] = sorted[0];
    const extras = sorted.slice(1);
    const filled: string[] = [];
    for (const [eid, erow] of extras) {
      for (const f of DONOR_FILL_FIELDS) {
        const cur = String((keepRow as any)?.[f] ?? "").trim();
        const alt = String(erow?.[f] ?? "").trim();
        if (!cur && alt) {
          paths[`donors/${keepId}/${f}`] = alt;
          filled.push(f);
        }
      }
      
      const sumDon = (Number(keepRow?.donations) || 0) + (Number(erow?.donations) || 0);
      const sumBags = (Number(keepRow?.totalBags) || 0) + (Number(erow?.totalBags) || 0);
      if (sumDon > 0 || sumBags > 0) {
        paths[`donors/${keepId}/donations`] = sumDon;
        paths[`donors/${keepId}/totalDonations`] = sumDon;
        if (sumBags > 0) paths[`donors/${keepId}/totalBags`] = sumBags;
      }
      paths[`donors/${eid}`] = null;
    }
    
    if (linkedId && linkedId !== keepId) paths[`users/${owner}/donorId`] = keepId;
    groups.push({
      kind: "donor-owner",
      key: owner,
      keep: { id: keepId, name: nameOf(keepRow), donorId: keepId, uid: owner },
      remove: extras.map(([id, r]) => ({ id, name: nameOf(r), uid: owner })),
      filledFields: [...new Set(filled)],
    });
  }

  
  for (const [ph, entries] of ownerlessByPhone) {
    if (entries.length < 2) continue;
    groups.push({
      kind: "donor-phone",
      key: ph,
      keep: { id: entries[0][0], name: nameOf(entries[0][1]) },
      remove: entries.slice(1).map(([id, r]) => ({ id, name: nameOf(r) })),
      filledFields: [],
    });
    notes.push(
      `একই মোবাইল নম্বরে (${ph}) ownerUid-বিহীন ${entries.length}টি ডোনার রেকর্ড — নিশ্চিত হয়ে ম্যানুয়ালি মেলান (স্বয়ংক্রিয়ভাবে বদলায়নি)।`,
    );
  }

  
  let emailsIndexed = 0;
  for (const [id, row] of Object.entries(userRows as Record<string, any>)) {
    const email = normEmail(row?.email);
    if (!email) continue;
    const key = emailIndexKey(email);
    const existing = claimedBy.get(key);
    if (existing && existing !== id) {
      
      continue;
    }
    if (!existing) {
      paths[emailIndexPath(email)] = id;
      emailsIndexed++;
    }
  }

  const scanned = { users: Object.keys(userRows).length, donors: Object.keys(donorRows).length, emailsIndexed };
  if (!apply) {
    return { ok: true, applied: false, scanned, groups, notes, changedPaths: 0 };
  }
  if (!Object.keys(paths).length) {
    return { ok: true, applied: true, scanned, groups, notes, changedPaths: 0 };
  }
  const okApply = await io.apply(paths).catch(() => false);
  if (!okApply) throw new ApiError(500, "পরিষ্কার করা যায়নি (Realtime Database লেখা ব্যর্থ) — কিছু বদলায়নি।");
  return { ok: true, applied: true, scanned, groups, notes, changedPaths: Object.keys(paths).length };
}
