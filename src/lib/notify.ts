
export const NOTIF_EXPIRE_MS = 24 * 60 * 60 * 1000; 
const STORE_KEY = "cbdc.notifications.v1"; 
const SEEN_KEY = "cbdc.notifseen.v1"; 
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


export function sanitizeKey(s: string): string {
  return String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "n";
}


export function notifExpiry(): string {
  return new Date(Date.now() + NOTIF_EXPIRE_MS).toISOString();
}


let memory: Notif[] | null = null;
const subs = new Set<(list: Notif[]) => void>();
let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch (e) {
  
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
    
  }
}

function emit() {
  const list = loadNotifs();
  subs.forEach((fn) => {
    try {
      fn(list);
    } catch (e) {
      
    }
  });
}

function broadcast() {
  try {
    bc && bc.postMessage({ t: 1 });
  } catch (e) {
    
  }
}

function persist(list: Notif[]) {
  memory = list;
  writeRaw(list);
  emit();
  broadcast();
}


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


export function subscribe(fn: (list: Notif[]) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}


export type SeenState = {
  
  uid?: string;
  booted?: boolean;
  reqStatus: Record<string, string>;
  incoming: Record<string, number>;
  donorStatus?: string;
  bloodGroup?: string;
  lastDonation?: string;
  
  groupChangeStatus?: string;
  
  donRej?: Record<string, number>;
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
    
  }
  if (!s.reqStatus || typeof s.reqStatus !== "object") s.reqStatus = {};
  if (!s.incoming || typeof s.incoming !== "object") s.incoming = {};
  if (!s.donRej || typeof s.donRej !== "object") s.donRej = {};
  return s;
}

export function saveSeen(s: SeenState) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch (e) {
    
  }
}


export function resetNotificationContext(uid: string): void {
  const key = String(uid || "").trim();
  if (!key) return;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch (e) {
    
  }
  memory = null;
  writeRaw([]);
  emit();
  broadcast();
  saveSeen({ reqStatus: {}, incoming: {}, uid: key });
}


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
  resetNotificationContext,
  donorMatchesRequest,
  sanitizeKey,
  notifExpiry,
  NOTIF_EXPIRE_MS,
};
