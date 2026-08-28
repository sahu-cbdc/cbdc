/**
 * Verification fixture — in-memory Realtime Database.
 *
 * `scripts/verify-admin-panel.mjs` aliases `firebase/database` to this module
 * so the panel's real loading/deletion/role code can run offline against a
 * database we control (seeded rows, delayed first snapshot, realtime
 * notifications on write). It is never used by the app itself.
 */

const tree = {};
let delay = 0;
const listeners = [];

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const segs = (p) => String(p || "").split("/").filter(Boolean);

function getAt(path) {
  let node = tree;
  for (const seg of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = node[seg];
  }
  return node;
}

function setAt(path, value) {
  const parts = path.slice();
  if (!parts.length) return;
  const last = parts.pop();
  if (value === null || value === undefined) {
    const parent = parts.length ? getAt(parts) : tree;
    if (parent && typeof parent === "object") delete parent[last];
    return;
  }
  let node = tree;
  for (const seg of parts) {
    if (node[seg] === null || typeof node[seg] !== "object") node[seg] = {};
    node = node[seg];
  }
  node[last] = clone(value);
}

class Snap {
  constructor(path, value) {
    this.__path = path;
    this.__value = value;
  }
  get key() {
    return this.__path.length ? this.__path[this.__path.length - 1] : null;
  }
  val() {
    return clone(this.__value);
  }
  exists() {
    return this.__value !== undefined && this.__value !== null;
  }
  child(p) {
    const v = this.__value && typeof this.__value === "object" ? this.__value[p] : undefined;
    return new Snap([...this.__path, String(p)], v);
  }
  forEach(fn) {
    const v = this.__value;
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (fn(new Snap([...this.__path, k], v[k])) === true) return true;
      }
    }
    return false;
  }
}

class Ref {
  constructor(path) {
    this.__path = path;
  }
  get key() {
    return this.__path.length ? this.__path[this.__path.length - 1] : null;
  }
  child(p) {
    return new Ref([...this.__path, ...segs(p)]);
  }
}

function isRef(v) {
  return v instanceof Ref;
}

export function ref(dbOrRef, path) {
  if (isRef(dbOrRef)) return new Ref([...dbOrRef.__path, ...segs(path)]);
  return new Ref(segs(path));
}
export function child(parent, p) {
  return isRef(parent) ? parent.child(p) : new Ref(segs(p));
}
export function push(parent) {
  const key = "-N" + Math.random().toString(36).slice(2, 12);
  return isRef(parent) ? parent.child(key) : new Ref([key]);
}

function pathOf(target) {
  return isRef(target) || (target && Array.isArray(target.__path)) ? target.__path : [];
}

export function getDatabase() {
  return { __fake: true };
}

export async function get(target) {
  const path = pathOf(target);
  return new Snap(path, getAt(path));
}

function notify() {
  for (const entry of listeners.slice()) {
    try {
      entry.cb(new Snap(entry.path, getAt(entry.path)));
    } catch (e) {
      console.warn("fake-rtdb listener:", e && e.message);
    }
  }
}

/* client-এর লেখা বন্ধ করে পরীক্ষা করা যায় — প্রমাণ করে যে ডিলিট আসলেই
   সার্ভার (Cloud Function) দিয়ে হচ্ছে, ব্রাউজার দিয়ে নয়। */
let clientWritesLocked = false;

export async function set(target, value) {
  if (clientWritesLocked) throw new Error("client write blocked (server-only test)");
  setAt(pathOf(target), value);
  notify();
}

export async function update(target, map) {
  if (clientWritesLocked) throw new Error("client write blocked (server-only test)");
  const base = pathOf(target);
  for (const [key, value] of Object.entries(map || {})) {
    setAt([...base, ...segs(key)], value);
  }
  notify();
}

export async function remove(target) {
  if (clientWritesLocked) throw new Error("client write blocked (server-only test)");
  setAt(pathOf(target), null);
  notify();
}

/** সার্ভার (Cloud Function) এই path দিয়ে লেখে — client lock উপেক্ষা করে। */
export function __serverUpdate(map) {
  for (const [key, value] of Object.entries(map || {})) setAt(segs(key), value);
  notify();
}

/* delay < 0 মানে: প্রথম snapshot হাতে না ছাড়া পর্যন্ত আটকে থাকবে
   (লোডিং অবস্থা নির্ভরভাবে পরীক্ষা করার জন্য)। */
const pending = [];

export function onValue(target, cb) {
  const entry = { path: pathOf(target), cb };
  listeners.push(entry);
  const deliver = () => {
    try {
      cb(new Snap(entry.path, getAt(entry.path)));
    } catch (e) {
      console.warn("fake-rtdb initial:", e && e.message);
    }
  };
  if (delay < 0) pending.push(deliver);
  else setTimeout(deliver, delay);
  return () => {
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function query(target) {
  return target;
}
export function orderByChild() {
  return { __orderBy: true };
}
export function equalTo() {
  return { __equal: true };
}
export function limitToFirst() {
  return { __limit: true };
}

export async function runTransaction(target, fn) {
  const path = pathOf(target);
  const current = getAt(path);
  const next = fn(clone(current));
  if (next === undefined) return { committed: false, snapshot: new Snap(path, current) };
  setAt(path, next);
  notify();
  return { committed: true, snapshot: new Snap(path, getAt(path)) };
}

export function serverTimestamp() {
  return { ".sv": "timestamp" };
}

/* ── test helpers ─────────────────────────────────────────────────── */
export function __seed(obj) {
  for (const [key, value] of Object.entries(obj || {})) setAt(segs(key), value);
}
/** লাইভ সিড — লেখার সাথে সাথেই listener-দের notify করে (realtime আপডেট)। */
export function __seedLive(obj) {
  __seed(obj);
  notify();
}
export function __setDelay(ms) {
  delay = Number(ms) || 0;
}
/** আটকে রাখা সব প্রথম snapshot একসাথে ডেলিভারি (তারপর স্বাভাবিক realtime)। */
export function __flush() {
  delay = 0;
  const queued = pending.splice(0, pending.length);
  queued.forEach((fn) => fn());
}
export function __dump() {
  return clone(tree);
}
export function __at(path) {
  return getAt(segs(path));
}
export function __lockClientWrites(locked = true) {
  clientWritesLocked = !!locked;
}
export function __reset() {
  for (const key of Object.keys(tree)) delete tree[key];
  /* listener গুলো ইচ্ছে করে রেখে দেওয়া হয় — মাউন্ট করা প্যানেলগুলোর
     subscription টিকে থাকে, ঠিক যেমন Firebase-এর ক্ষেত্রে হয়। */
  pending.length = 0;
  delay = 0;
}
