/**
 * CBDC — Notification System (আলাদা Website Notification Data/Storage)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Notification **মূল Firebase Realtime Database-এ সংরক্ষিত হয় না।** এগুলো এই
 *  ওয়েবসাইটের আলাদা Notification Data/Storage-এ থাকে — ব্রাউজারের localStorage
 *  (key: `cbdc.notifications.v1`) + in-memory। ফলে:
 *
 *    • Notification auto-clear (২৪ ঘণ্টা) করলে main RTDB-র Donor / আবেদন /
 *      অন্যান্য ডাটার কোনো প্রভাব পড়ে না — RTDB-তে কোনো notifications নোডই নেই,
 *    • RTDB শুধু source data দেয়: ডোনার প্যানেল RTDB-র live পরিবর্তন দেখে
 *      (status approved/rejected, নতুন matching জরুরি আবেদন) এখানে notification
 *      তৈরি করে — তাই notification real-time দেখা যায়,
 *    • তৈরি হওয়ার ২৪ ঘণ্টা পরে notification **এই storage থেকেও** স্বয়ংক্রিয়ভাবে
 *      মুছে যায় (read/prune + periodic prune)।
 *
 *  Cross-tab real-time: BroadcastChannel + storage event — এক ট্যাবে notification
 *  তৈরি/পড়া হলে অন্য খোলা ট্যাবের UI-ও সাথে সাথে update হয়।
 *
 *  ⚠️ এই মডিউলে কোনো Firebase import নেই — notification কখনোই RTDB-তে যায় না।
 */
export const NOTIF_EXPIRE_MS = 24 * 60 * 60 * 1000; // ২৪ ঘণ্টা
const STORE_KEY = "cbdc.notifications.v1"; // আলাদা website notification storage
const SEEN_KEY = "cbdc.notifseen.v1"; // কোন কোন RTDB পরিবর্তন ইতিমধ্যে notify করা হয়েছে
const MAX_NOTIFS = 100;
const CHANNEL = "cbdc-notifs";

export type NotifType = "approval" | "rejected" | "emergency" | "info";

export type Notif = {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  ref?: string;
  go?: string;
  read: boolean;
  createdAt: string;
  expiresAt: string;
};

export type NotifInput = {
  id?: string;
  title: string;
  body: string;
  type?: NotifType;
  ref?: string;
  go?: string;
};

/** localStorage key-তে/notification id-তে ব্যবহারযোগ্য নিরাপদ string। */
export function sanitizeKey(s: string): string {
  return String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "n";
}

/** ২৪ ঘণ্টা পরে মেয়াদোত্তীর্ণ হওয়ার ISO timestamp। */
export function notifExpiry(): string {
  return new Date(Date.now() + NOTIF_EXPIRE_MS).toISOString();
}

/* ── storage layer ── */
let memory: Notif[] | null = null;
const subs = new Set<(list: Notif[]) => void>();
let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch (e) {
  /* BroadcastChannel unavailable */
}

function readRaw(): Notif[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeRaw(list: Notif[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch (e) {
    /* quota/private-mode */
  }
}

function emit() {
  const list = loadNotifs();
  subs.forEach((fn) => {
    try {
      fn(list);
    } catch (e) {
      /* ignore subscriber error */
    }
  });
}

function broadcast() {
  try {
    bc && bc.postMessage({ t: 1 });
  } catch (e) {
    /* ignore */
  }
}

function persist(list: Notif[]) {
  memory = list;
  writeRaw(list);
  emit();
  broadcast();
}

/* cross-tab real-time sync */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORE_KEY) {
      memory = null;
      emit();
    }
  });
}
if (bc) {
  bc.onmessage = () => {
    memory = null;
    emit();
  };
}

/** সব notification (expired বাদে) — পড়ার সময়ই ২৪ ঘণ্টা পুরোনো entries মুছে যায়। */
export function loadNotifs(): Notif[] {
  if (!memory) memory = readRaw();
  const now = Date.now();
  const kept = memory.filter((n) => !(n.expiresAt && Date.parse(n.expiresAt) <= now));
  if (kept.length !== memory.length) {
    memory = kept;
    writeRaw(kept);
  }
  return memory;
}

/** নতুন notification — duplicate id হলে overwrite হয় না (dedupe)। */
export function addNotif(input: NotifInput): Notif | null {
  if (!input || !input.title) return null;
  const id = input.id || sanitizeKey(input.title);
  const list = loadNotifs();
  const existing = list.find((x) => x.id === id);
  if (existing) return existing;
  const notif: Notif = {
    id,
    title: String(input.title).slice(0, 140),
    body: String(input.body || "").slice(0, 320),
    type: input.type || "info",
    ref: String(input.ref || "").slice(0, 80),
    go: String(input.go || "").slice(0, 40),
    read: false,
    createdAt: new Date().toISOString(),
    expiresAt: notifExpiry(),
  };
  list.unshift(notif);
  if (list.length > MAX_NOTIFS) list.length = MAX_NOTIFS;
  persist(list);
  return notif;
}

export function markNotifRead(id: string) {
  const list = loadNotifs();
  const n = list.find((x) => x.id === id);
  if (n && !n.read) {
    n.read = true;
    persist(list);
  }
}

export function markAllNotifsRead() {
  const list = loadNotifs();
  let changed = false;
  list.forEach((n) => {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  });
  if (changed) persist(list);
}

export function unreadNotifs(): Notif[] {
  return loadNotifs().filter((n) => !n.read);
}

/**
 * ২৪ ঘণ্টা পার হয়ে যাওয়া notification এই storage থেকেও মুছে ফেলে।
 * রিটার্ন: মুছে ফেলা notification-এর সংখ্যা।
 */
export function pruneExpired(): number {
  if (!memory) memory = readRaw();
  const now = Date.now();
  const kept: Notif[] = [];
  let removed = 0;
  memory.forEach((n) => {
    if (n.expiresAt && Date.parse(n.expiresAt) <= now) removed++;
    else kept.push(n);
  });
  if (removed) persist(kept);
  return removed;
}

/** real-time subscriber — notification list বদলালে কল হবে। */
export function subscribe(fn: (list: Notif[]) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/* ── seen-state (কোন RTDB পরিবর্তন ইতিমধ্যে notify করা হয়েছে) ── */
export type SeenState = {
  booted?: boolean;
  reqStatus: Record<string, string>;
  incoming: Record<string, number>;
  donorStatus?: string;
  bloodGroup?: string;
  lastDonation?: string;
  /** রক্তের গ্রুপ পরিবর্তনের অনুরোধের সর্বশেষ দেখা status (pending/approved/rejected) */
  groupChangeStatus?: string;
};

export function loadSeen(): SeenState {
  let s: SeenState = { reqStatus: {}, incoming: {} };
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") s = { ...s, ...p };
    }
  } catch (e) {
    /* ignore */
  }
  if (!s.reqStatus || typeof s.reqStatus !== "object") s.reqStatus = {};
  if (!s.incoming || typeof s.incoming !== "object") s.incoming = {};
  return s;
}

export function saveSeen(s: SeenState) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch (e) {
    /* ignore */
  }
}

/* ── matching predicate (pure — টেস্টযোগ্য) ─────────────────────────
   জরুরি আবেদনের notification শুধু সেই ডোনারদের জন্য যাদের blood group
   মেলে, Availability ON, non-suspended, approved এবং ownerUid আছে। */
export function donorMatchesRequest(
  d: Record<string, any>,
  group: string,
  opts: { exceptUid?: string } = {}
): boolean {
  const uid = String(d && d.ownerUid || "").trim();
  if (!uid) return false;
  if (opts.exceptUid && String(opts.exceptUid) === uid) return false;
  if (String(d.bloodGroup || d.group || "") !== String(group || "").trim()) return false;
  if (d.available === false || d.suspended) return false;
  if ((d.status || "approved") === "pending") return false;
  return true;
}

export default {
  addNotif,
  loadNotifs,
  markNotifRead,
  markAllNotifsRead,
  unreadNotifs,
  pruneExpired,
  subscribe,
  loadSeen,
  saveSeen,
  donorMatchesRequest,
  sanitizeKey,
  notifExpiry,
  NOTIF_EXPIRE_MS,
};
