

import { getAuthUser, subscribeAuthUser } from "./authState";
import { NODES, getAuthInstance } from "./firebase";
import { watchList, setRow, removeRow } from "./rtdb";
import { resolveAge } from "./age";

const KEY = "cbdc.shared.v1"; 
const CHANNEL = "cbdc-sync";
const CACHE_KEY = "cbdc.shared.rtdb.public-cache.v2";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; 



const CACHE_ENABLED = (() => {
  try {
    const meta = (import.meta as any).env || {};
    return meta.DEV === true || meta.MODE === "development";
  } catch {
    return false;
  }
})();


const COLLECTION_NAMES = ["donors", "requests", "queue", "gallery", "notices", "accounts", "donations"] as const;
type CollectionName = (typeof COLLECTION_NAMES)[number];


const PUBLIC_COLLECTIONS = new Set<CollectionName>(["donors", "requests", "gallery", "notices"]);

const clone = (v: any): any => {
  try {
    return structuredClone(v);
  } catch (e) {
    return JSON.parse(JSON.stringify(v));
  }
};


function fresh(): any {
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date().toISOString(),
    source: "rtdb",
    donors: [],
    requests: [],
    queue: [],
    gallery: [],
    notices: [],
    accounts: [],
    donations: [],
  };
}

function clean(s: any): any {
  if (!s || typeof s !== "object") s = fresh();
  for (const k of COLLECTION_NAMES) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  s.version = 1;
  return s;
}

function restorePublicCache(): any {
  const s = fresh();
  if (!CACHE_ENABLED) return s;
  try {
    
    
    
    const path = window.location.pathname || "/";
    if (/\/(admin|moderator|doner)(?:\.|\/|$)/i.test(path)) return s;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return s;
    const parsed = JSON.parse(raw);
    const savedAt = Date.parse(parsed?.savedAt || parsed?.updatedAt || "");
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > CACHE_MAX_AGE_MS) return s;
    for (const k of PUBLIC_COLLECTIONS) {
      if (Array.isArray(parsed[k])) s[k] = parsed[k];
    }
    s.updatedAt = parsed.updatedAt || s.updatedAt;
    s.source = "rtdb-cache";
  } catch {
    
  }
  return clean(s);
}

function persistPublicCache() {
  if (!CACHE_ENABLED) return;
  try {
    const payload: Record<string, any> = {
      version: 1,
      updatedAt: cache.updatedAt || new Date().toISOString(),
      savedAt: new Date().toISOString(),
    };
    for (const k of PUBLIC_COLLECTIONS) payload[k] = cache[k] || [];
    const stamp = payload.updatedAt;
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload, (_k, v) =>
      v && typeof v === "object" && (v as any).__sv__ === "timestamp" ? stamp : v));
  } catch {
    
  }
}


function normalizeDoc(data: any): any {
  const fix = (v: any): any => {
    if (v && typeof v === "object") {
      const out: any = Array.isArray(v) ? [] : {};
      for (const k of Object.keys(v)) out[k] = fix(v[k]);
      return out;
    }
    return v;
  };
  return fix(data);
}





let cache: any = restorePublicCache();


const subscribers = new Set<(state: any, meta?: any) => void>();

function notify(meta?: any) {
  const snapshot = clean(clone(cache));
  subscribers.forEach((fn) => {
    try {
      fn(snapshot, meta);
    } catch (e) {
      console.warn("store subscriber error:", (e as Error)?.message);
    }
  });
}


function load(): any {
  return clean(clone(cache));
}


const rtdbUnsubs: Array<() => void> = [];
let rtdbStarted = false;
let authUnsub: (() => void) | null = null;
let currentAuthUid: string | null = null;


const loadedNodes = new Set<CollectionName>();
const nodeLoadedSubs = new Set<(name: string) => void>();


export function onNodeLoaded(cb: (name: string) => void): () => void {
  nodeLoadedSubs.add(cb);
  return () => {
    nodeLoadedSubs.delete(cb);
  };
}


export function isNodeLoaded(name: string): boolean {
  return loadedNodes.has(name as CollectionName);
}

function notifyNodeLoaded(name: CollectionName): void {
  nodeLoadedSubs.forEach((fn) => {
    try {
      fn(name);
    } catch (e) {
      console.warn("store node-loaded subscriber:", (e as Error)?.message);
    }
  });
}


const filters: Record<CollectionName, (rows: any[]) => any[]> = {
  donors: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  requests: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  queue: (rows) => rows,
  gallery: (rows) => rows.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  notices: (rows) => rows,
  accounts: (rows) => rows,
  donations: (rows) => rows.slice().sort((a, b) => String(b.date || b.approvedAt).localeCompare(String(a.date || a.approvedAt))),
};

function canAttachCollection(name: CollectionName): boolean {
  return PUBLIC_COLLECTIONS.has(name) || !!currentAuthUid;
}

function clearPrivateCacheOnLogout(): boolean {
  let changed = false;
  for (const name of COLLECTION_NAMES) {
    if (PUBLIC_COLLECTIONS.has(name)) continue;
    if (cache[name]?.length) {
      cache[name] = [];
      changed = true;
    }
  }
  return changed;
}


function startRealtimeSync() {
  if (rtdbStarted) return;
  rtdbStarted = true;

  for (const name of COLLECTION_NAMES) {
    if (!canAttachCollection(name)) continue;
    try {
      const un = watchList((NODES as any)[name] || name, (rows) => {
        const items = (filters[name] || ((x: any[]) => x))(rows.map((r) => normalizeDoc(r)));
        
        if (!loadedNodes.has(name)) {
          loadedNodes.add(name);
          notifyNodeLoaded(name);
        }
        
        if (JSON.stringify(items) === JSON.stringify(cache[name])) return;
        cache[name] = clone(items);
        cache.version = 1;
        cache.updatedAt = new Date().toISOString();
        if (PUBLIC_COLLECTIONS.has(name)) persistPublicCache();
        notify({ source: "rtdb", node: name });
      });
      rtdbUnsubs.push(un);
    } catch (e) {
      console.warn("store listener setup failed:", name, (e as Error)?.message);
    }
  }
}

function restartRealtimeSync(meta?: any) {
  stopRealtimeSync();
  startRealtimeSync();
  if (meta) notify(meta);
}

function watchAuthForPrivateNodes() {
  if (authUnsub) return;
  try {
    
    currentAuthUid = getAuthUser()?.uid || null;
    authUnsub = subscribeAuthUser((user) => {
      const au = getAuthInstance();
      const authCurrent = au ? au.currentUser : null;
      
      if (!user && authCurrent && authCurrent.uid && currentAuthUid === authCurrent.uid) return;
      const nextUid = (user && user.uid) ? user.uid : (authCurrent ? authCurrent.uid : null);
      if (nextUid === currentAuthUid && rtdbStarted) return;
      currentAuthUid = nextUid;
      const cleared = !nextUid && clearPrivateCacheOnLogout();
      restartRealtimeSync({ source: nextUid ? "auth:login" : "auth:logout", privateCleared: cleared });
    });
  } catch (e) {
    console.warn("store auth watcher:", (e as Error)?.message);
  }
}


export function stopRealtimeSync(): void {
  while (rtdbUnsubs.length) {
    try {
      (rtdbUnsubs.pop() as () => void)();
    } catch {
      
    }
  }
  rtdbStarted = false;
}


async function writeDiffStrict(name: string, oldList: any[], newList: any[]) {
  const node = (NODES as any)[name] || name;
  const oldById = new Map<string, any>(oldList.map((x) => [String(x.id), x]));
  const newById = new Map<string, any>(newList.map((x) => [String(x.id), x]));
  const tasks: Array<Promise<void>> = [];
  for (const [id, item] of newById) {
    const prev = oldById.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) tasks.push(setRow(node, id, clone(item)));
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) tasks.push(removeRow(node, id));
  }
  if (tasks.length) await Promise.all(tasks);
}


function makeNextState(state: any, source = "unknown"): { previous: any; next: any } {
  const previous = load();
  const next = clean(clone(state));
  next.revision = (Number(previous.revision) || 0) + 1;
  next.updatedAt = new Date().toISOString();
  next.source = source;
  return { previous, next };
}

function publishOptimistic(next: any, source: string): void {
  cache = clean(clone(next));
  persistPublicCache();
  notify({ source });
  try {
    bc && bc.postMessage({ revision: next.revision, source });
  } catch (e) {
    
  }
}

async function commit(state: any, source = "unknown"): Promise<any> {
  const { previous, next } = makeNextState(state, source);
  await Promise.all(COLLECTION_NAMES.map((name) => writeDiffStrict(name, previous[name], next[name])));
  publishOptimistic(next, source);
  return next;
}

async function updateAsync(fn: (s: any) => any, source?: string): Promise<any> {
  const s = load();
  const out = fn(s) || s;
  return commit(out, source);
}

let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch (e) {
  
}

function subscribe(fn: (state: any, meta?: any) => void): () => void {
  subscribers.add(fn);
  
  
  queueMicrotask(() => {
    if (!subscribers.has(fn)) return;
    try {
      fn(clean(clone(cache)), { source: cache.source || "cache" });
    } catch (e) {
      console.warn("store subscriber error:", (e as Error)?.message);
    }
  });
  const onBC = (e: MessageEvent) => {
    const meta = e.data && typeof e.data === "object" ? e.data : {};
    notify({ source: meta.source || "broadcast" });
  };
  if (bc) bc.addEventListener("message", onBC);
  return () => {
    subscribers.delete(fn);
    if (bc) bc.removeEventListener("message", onBC);
  };
}





const toAdminDonor = (d: any) => ({
  ...d,
  id: d.id || d.donorId,
  name: d.name || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  phone: d.phone || "",
  gender: d.gender || "",
  dob: d.dob || "",
  age: resolveAge(d),
  last: d.lastDonationDate || d.last || "",
  available: d.available !== false,
  verified: d.verified !== false,
  suspended: !!d.suspended,
  joined: d.joined || "",
  donations: Number(d.donations ?? d.totalDonations) || 0,
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
  whatsapp: d.whatsapp || "",
  
  photo: d.photo || d.photoURL || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const fromAdminDonor = (d: any) => {
  const out: any = { ...d };
  delete out.age; 
  Object.assign(out, {
    id: d.id,
    donorId: d.id,
    uid: d.ownerUid || d.uid || d.id,
    name: d.name || "",
    bloodGroup: d.group || "",
    gender: d.gender || "",
    dob: d.dob || "",
    phone: d.phone || "",
    whatsapp: d.whatsapp || d.phone || "",
    area: d.area || "",
    lastDonationDate: d.last || "",
    donations: Number(d.donations) || 0,
    totalDonations: Number(d.donations) || 0,
    totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
    status: "approved",
    available: d.available !== false,
    verified: d.verified !== false,
    suspended: !!d.suspended,
    joined: d.joined || "",
    occupation: d.occupation || "",
    photo: d.photo || d.photoURL || "",
    ownerUid: d.ownerUid || "",
  });
  return out;
};

const toDonerDonor = (d: any) => ({
  ...d,
  uid: d.uid || d.ownerUid || d.id,
  donorId: d.id || d.donorId,
  name: d.name || "",
  gender: d.gender || "",
  photo: d.photo || d.photoURL || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  dob: d.dob || "",
  age: resolveAge(d),
  occupation: d.occupation || "",
  phone: d.phone || "",
  whatsapp: !!d.whatsapp,
  lastDonation: d.lastDonationDate || d.last || "",
  totalDonations: Number(d.totalDonations ?? d.donations) || 0,
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
  joined: d.joined || "",
  verified: d.verified !== false,
  privacy: { showArea: true, showGroup: true, showWhatsapp: !!d.whatsapp },
});

const fromDonerDonor = (d: any) => ({
  ...d,
  id: d.donorId || d.id,
  donorId: d.donorId || d.id,
  uid: d.uid || d.donorId || d.id,
  name: d.name || "",
  bloodGroup: d.group || d.bloodGroup || "",
  gender: d.gender || "",
  dob: d.dob || "",
  phone: d.phone || "",
  whatsapp: d.whatsapp === false ? "" : typeof d.whatsapp === "string" ? d.whatsapp : d.phone || "",
  area: d.area || "",
  lastDonationDate: d.lastDonation || d.lastDonationDate || "",
  donations: Number(d.totalDonations ?? d.donations) || 0,
  totalDonations: Number(d.totalDonations ?? d.donations) || 0,
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
  status: "approved",
  available: d.available !== false,
  verified: d.verified !== false,
  suspended: !!d.suspended,
  joined: d.joined || "",
  occupation: d.occupation || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const store = {
  KEY,
  load,
  commit,
  updateAsync,
  subscribe,
  onNodeLoaded,
  isNodeLoaded,
  clone,
  toAdminDonor,
  fromAdminDonor,
  toDonerDonor,
  fromDonerDonor,
};


window.CBDCShared = store;
globalThis.CBDCShared = store;



watchAuthForPrivateNodes();
startRealtimeSync();

export default store;
