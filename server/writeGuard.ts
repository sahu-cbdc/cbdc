/**
 * Server-side write authorization engine.
 *
<<<<<<< HEAD
 * Every /api/data/write path is checked here BEFORE anything reaches the
=======
 * Every /api/data op=write path is checked here BEFORE anything reaches the
>>>>>>> 69f665ef3c08d211cb53736a98d026fb8416fdf2
 * database: caller role comes from the verified ID token + the server-side
 * `admins/{uid}` row (never from the request body), and ownership is proven
 * against the CURRENT database record. This is a faithful — and in a few
 * places stricter — port of the previous Realtime Database security rules,
 * moved server-side so the browser needs no write access at all.
 *
 * Guarantees:
 *   • IDOR/BOLA: a caller can only touch records they own (verified against
 *     current data), besides staff/admin grants.
 *   • Privilege escalation: role / donorStatus / donorId / verified /
 *     suspended / status / stats fields are locked to staff.
 *   • All-or-nothing: one unauthorized path rejects the whole request.
 */
import { ApiError } from "./deleteApi.ts";

export type GuardRole = "admin" | "moderator" | "donor";

export type Caller = {
  uid: string;
  email: string;
  role: GuardRole;
  staff: boolean;
  admin: boolean;
};

export type GuardIo = {
  get(path: string): Promise<any>;
};

export type WritePlan = {
  patch: Record<string, any>;
  values: Record<string, number>;
};

const MAX_PATHS = 128;
const MAX_DEPTH = 16;
const MAX_KEY_LEN = 768;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const BAD_KEY_RE = /[.#$/\[\]]/;

const DENY_MESSAGE = "এই পরিবর্তনের অনুমতি আপনার নেই।";
const QUEUE_KINDS_OWN = new Set(["donor", "group", "request", "donation", "report"]);
const QUEUE_KINDS_ANON = new Set(["donor", "request"]);

export function badPathMessage(path: string): string {
  return `অবৈধ পথ: ${String(path).slice(0, 120)}`;
}

function segments(path: string): string[] {
  return String(path || "").split("/").filter((s) => s.length > 0);
}

function validatePathShape(path: string): string[] {
  const segs = segments(path);
  if (!segs.length || segs.length > MAX_DEPTH) throw new ApiError(400, badPathMessage(path));
  for (const s of segs) {
    if (!s || s.length > MAX_KEY_LEN || BAD_KEY_RE.test(s) || FORBIDDEN_KEYS.has(s)) {
      throw new ApiError(400, badPathMessage(path));
    }
  }
  return segs;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** RTDB rules equality: missing child === null. */
function sameValue(a: any, b: any): boolean {
  const x = a === undefined ? null : a;
  const y = b === undefined ? null : b;
  return x === y;
}

function toNumber(v: any): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
}

/** Merge a (possibly deep) write into the current record, like rules' newData. */
function mergedRecord(current: any, segs: string[], value: any): any {
  if (value === null) return null;
  const write = (obj: any, i: number): any => {
    if (i >= segs.length) return value;
    const key = segs[i];
    const base = isPlainObject(obj) ? obj : {};
    const next = write(base[key], i + 1);
    if (next === undefined) return base;
    const out = { ...base };
    if (next === null) delete out[key];
    else out[key] = next;
    return out;
  };
  if (segs.length === 0) return value;
  return write(isPlainObject(current) ? current : {}, 0);
}

function ownerUidOf(row: any): string {
  return isPlainObject(row) ? String(row.ownerUid ?? "").trim() : "";
}

function requireCondition(cond: boolean, status = 403, message = DENY_MESSAGE): void {
  if (!cond) throw new ApiError(status, message);
}

type Ctx = {
  caller: Caller;
  io: GuardIo;
  recordCache: Map<string, any>;
};

async function readRecord(ctx: Ctx, node: string, id: string): Promise<any> {
  const path = `${node}/${id}`;
  if (ctx.recordCache.has(path)) return ctx.recordCache.get(path);
  const value = await ctx.io.get(path).catch(() => null);
  ctx.recordCache.set(path, value ?? null);
  return value ?? null;
}

async function readValue(ctx: Ctx, path: string): Promise<any> {
  if (ctx.recordCache.has(path)) return ctx.recordCache.get(path);
  const value = await ctx.io.get(path).catch(() => null);
  ctx.recordCache.set(path, value ?? null);
  return value ?? null;
}

/* ────────────────────────── node policies ────────────────────────── */

function checkUserDataObject(caller: Caller, uid: string, dataValue: any, curData: any): void {
  if (caller.staff || dataValue === null || dataValue === undefined) return;
  requireCondition(uid === caller.uid || caller.staff);
  if (!isPlainObject(dataValue)) return;
  for (const locked of ["donations", "verifiedDonations"]) {
    const before = isPlainObject(curData) ? (curData as any)[locked] : undefined;
    const after = dataValue[locked];
    requireCondition(
      sameJsonValue(before, after),
      403,
      "রক্তদানের যাচাইকৃত তথ্য শুধু স্টাফ বদলাতে পারেন।"
    );
  }
  if (isPlainObject(dataValue.noticeReads)) {
    for (const v of Object.values(dataValue.noticeReads)) {
      requireCondition(typeof v === "boolean", 400, "noticeReads শুধু true/false হতে পারে।");
    }
  }
}

function checkUsersField(caller: Caller, uid: string, field: string, value: any, current: any): void {
  const cur = isPlainObject(current) ? (current as any)[field] : undefined;
  if (field === "role") {
    requireCondition(caller.admin || value === "donor", 403, "role শুধু অ্যাডমিন বদলাতে পারেন।");
    return;
  }
  if (field === "donorStatus") {
    requireCondition(caller.staff || value !== "approved", 403, "ডোনার অনুমোদন শুধু স্টাফ করতে পারেন।");
    return;
  }
  if (field === "donorId") {
    requireCondition(
      caller.admin || sameValue(value, cur) || (cur == null && (value === null || value === "")),
      403,
      "ডোনার আইডি শুধু অ্যাডমিন নির্ধারণ করেন।"
    );
    return;
  }
  if (field === "bloodGroup") {
    requireCondition(
      caller.staff || current == null || cur === "" || cur === undefined || sameValue(value, cur),
      403,
      "রক্তের গ্রুপ পরিবর্তনে অনুমোদন লাগে।"
    );
    return;
  }
}

function guardUsersSubtree(ctx: Ctx, uid: string, sub: string[], value: any, current: any): void {
  const { caller } = ctx;
  requireCondition(uid === caller.uid || caller.staff);

  if (sub.length === 0) {
    requireCondition(value !== null, 403, "অ্যাকাউন্ট রেকর্ড এই পথে মোছা যায় না।");
    if (isPlainObject(value)) {
      for (const field of ["role", "donorStatus", "donorId", "bloodGroup"]) {
        if (field in value) checkUsersField(caller, uid, field, value[field], current);
      }
      if ("data" in value) {
        const curData = isPlainObject(current) ? (current as any).data : null;
        checkUserDataObject(caller, uid, value.data, curData);
      }
    }
    return;
  }

  const field = sub[0];
  if (field === "role" || field === "donorStatus" || field === "donorId" || field === "bloodGroup") {
    requireCondition(sub.length === 1, 400, badPathMessage("users/" + uid + "/" + sub.join("/")));
    checkUsersField(caller, uid, field, value, current);
    return;
  }

  if (field === "data") {
    const dataSub = sub.slice(1);
    const curData = isPlainObject(current) ? (current as any).data : null;
    if (dataSub.length === 0) {
      checkUserDataObject(caller, uid, value, curData);
      requireCondition(uid === caller.uid || caller.staff);
      return;
    }
    const bucket = dataSub[0];
    if (bucket === "donations" || bucket === "verifiedDonations") {
      requireCondition(caller.staff, 403, "রক্তদানের যাচাইকৃত তথ্য শুধু স্টাফ বদলাতে পারেন।");
      return;
    }
    if (bucket === "noticeReads") {
      requireCondition(uid === caller.uid || caller.admin);
      if (dataSub.length === 2) {
        requireCondition(typeof value === "boolean", 400, "noticeReads শুধু true/false হতে পারে।");
      }
      return;
    }
    requireCondition(uid === caller.uid || caller.staff);
    return;
  }
}

function sameJsonValue(a: any, b: any): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

function guardDonors(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  if (caller.staff) return;
  const current = ctx.recordCache.get(`donors/${id}`) ?? null;
  if (value === null) {
    requireCondition(isPlainObject(current) && ownerUidOf(current) === caller.uid);
    return;
  }
  requireCondition(isPlainObject(current), 403, "নতুন ডোনার রেকর্ড শুধু স্টাফ তৈরি করতে পারেন।");
  requireCondition(ownerUidOf(current) === caller.uid);
  const merged = mergedRecord(current, sub, value);
  requireCondition(isPlainObject(merged) && ownerUidOf(merged) === caller.uid);
  const PROTECTED = ["id", "donorId", "uid", "ownerUid", "verified", "suspended", "status", "bloodGroup", "group"];
  for (const key of PROTECTED) {
    requireCondition(
      sameValue((merged as any)[key], (current as any)[key]),
      403,
      `ডোনার রেকর্ডের «${key}» শুধু স্টাফ বদলাতে পারেন।`
    );
  }
  const statsEqual =
    sameValue((merged as any).donations, (current as any).donations) &&
    sameValue((merged as any).totalDonations, (current as any).totalDonations) &&
    sameValue((merged as any).totalBags, (current as any).totalBags) &&
    sameValue((merged as any).lastDonationDate, (current as any).lastDonationDate);
  const curDonations = toNumber((current as any).donations);
  const curTotal = toNumber((current as any).totalDonations);
  const curBags = toNumber((current as any).totalBags);
  const nextDonations = toNumber((merged as any).donations);
  const nextTotal = toNumber((merged as any).totalDonations);
  const nextBags = toNumber((merged as any).totalBags);
  const decrementOk =
    curDonations !== null &&
    curTotal !== null &&
    curBags !== null &&
    nextDonations === curDonations - 1 &&
    nextTotal === curTotal - 1 &&
    nextBags !== null &&
    nextBags >= 0 &&
    nextBags <= curBags &&
    sameValue((merged as any).lastDonationDate, (current as any).lastDonationDate);
  requireCondition(statsEqual || decrementOk, 403, "ডোনার পরিসংখ্যান শুধু যাচাইয়ের মাধ্যমে বদলায়।");
}

function guardRequests(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  if (caller.staff) return;
  const current = ctx.recordCache.get(`requests/${id}`) ?? null;
  if (!current) {
    const merged = mergedRecord(null, sub, value);
    requireCondition(isPlainObject(merged) && String((merged as any).ownerUid ?? "") === caller.uid);
    return;
  }
  requireCondition(ownerUidOf(current) === caller.uid);
  if (value === null) return;
  const merged = mergedRecord(current, sub, value);
  for (const key of ["ownerUid", "createdAt", "status", "workflowStatus"]) {
    requireCondition(
      sameValue((merged as any)[key], (current as any)[key]),
      403,
      `আবেদনের «${key}» পরিবর্তন করা যায় না।`
    );
  }
  requireCondition(ownerUidOf(merged as any) === caller.uid);
}

function guardMembers(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  const current = ctx.recordCache.get(`members/${id}`) ?? null;
  if (!current) {
    const merged = mergedRecord(null, sub, value);
    requireCondition(isPlainObject(merged) && (merged as any).status === "pending", 403, "নতুন সদস্য রেকর্ড শুধু pending অবস্থায় তৈরি হতে পারে।");
    return;
  }
  requireCondition(caller.staff || String((current as any).uid ?? "") === caller.uid || ownerUidOf(current) === caller.uid);
  if (value === null || caller.staff) return;
  const merged = mergedRecord(current, sub, value);
  const nextStatus = (merged as any).status;
  requireCondition(
    sameValue(nextStatus, (current as any).status) || nextStatus === "pending" || nextStatus === "rejected",
    403,
    "সদস্যের অবস্থা শুধু pending/rejected হতে পারে।"
  );
}

async function guardQueue(ctx: Ctx, id: string, sub: string[], value: any): Promise<void> {
  const { caller } = ctx;
  if (caller.staff) return;
  const current = ctx.recordCache.get(`queue/${id}`) ?? null;
  if (value === null) {
    requireCondition(isPlainObject(current) && ownerUidOf(current) === caller.uid);
    return;
  }
  requireCondition(!current, 403, "কিউ-রেকর্ড পরিবর্তন শুধু স্টাফ করতে পারেন।");
  const merged = mergedRecord(null, sub, value);
  const kind = String((merged as any).kind ?? "");
  const owner = String((merged as any).ownerUid ?? "");
  if (caller.uid) {
    requireCondition(owner === caller.uid, 403, "কিউ-রেকর্ড শুধু নিজের uid দিয়ে তৈরি করা যায়।");
    requireCondition(QUEUE_KINDS_OWN.has(kind), 403, "এই ধরনের কিউ-রেকর্ড অনুমোদিত নয়।");
  } else {
    requireCondition(owner === "" && QUEUE_KINDS_ANON.has(kind), 403, "এই ধরনের কিউ-রেকর্ড অনুমোদিত নয়।");
  }
  if (kind === "donor" && caller.uid) {
    const callerUser = await readRecord(ctx, "users", caller.uid);
    const myGroup = isPlainObject(callerUser) ? String((callerUser as any).bloodGroup ?? "") : "";
    requireCondition(
      !myGroup || String((merged as any).group ?? "") === myGroup,
      403,
      "কিউ-রেকর্ডে রক্তের গ্রুপ নিজের গ্রুপের সাথে মিলতে হবে।"
    );
  }
}

function guardDonations(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  const current = ctx.recordCache.get(`donations/${id}`) ?? null;
  if (value === null) {
    requireCondition(caller.admin || (isPlainObject(current) && ownerUidOf(current) === caller.uid));
    return;
  }
  requireCondition(
    caller.admin || (caller.role === "moderator" && !current),
    403,
    "অনুমোদিত রক্তদান রেকর্ড শুধু স্টাফ যোগ/বদলাতে পারেন।"
  );
  const merged = mergedRecord(current, sub, value);
  requireCondition(isPlainObject(merged));
  requireCondition(
    (merged as any).livesSaved === 1 &&
      typeof (merged as any).donorId === "string" &&
      typeof (merged as any).ownerUid === "string" &&
      typeof (merged as any).date === "string" &&
      typeof (merged as any).place === "string",
    400,
    "রক্তদান রেকর্ডে প্রয়োজনীয় তথ্য (donorId/ownerUid/date/place) দিন।"
  );
}

function guardAccounts(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  if (caller.admin) return;
  const current = ctx.recordCache.get(`accounts/${id}`) ?? null;
  if (value === null) {
    requireCondition(isPlainObject(current) && String((current as any).uid ?? "") === caller.uid);
    return;
  }
  const merged = mergedRecord(current, sub, value);
  requireCondition(isPlainObject(merged) && String((merged as any).uid ?? "") === caller.uid);
  requireCondition(!current || String((current as any).uid ?? "") === caller.uid);
}

function guardAdmins(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  if (!caller.admin) {
    const current = ctx.recordCache.get(`admins/${id}`) ?? null;
    requireCondition(value === null && id === caller.uid && isPlainObject(current));
    return;
  }
  if (value === null) return;
  const current = ctx.recordCache.get(`admins/${id}`) ?? null;
  const merged = mergedRecord(current, sub, value);
  requireCondition(isPlainObject(merged));
  requireCondition(
    (merged as any).role === "admin" || (merged as any).role === "moderator",
    400,
    "অ্যাডমিন রেকর্ডে role শুধু admin/moderator হতে পারে।"
  );
  if (id === caller.uid) {
    for (const key of ["role", "permissions", "status"]) {
      requireCondition(
        sameValue((merged as any)[key], (current as any)?.[key]),
        403,
        "নিজের role/permissions/status বদলানো যায় না।"
      );
    }
  }
}

function guardReports(ctx: Ctx, id: string, sub: string[], value: any): void {
  const { caller } = ctx;
  if (caller.staff) return;
  const current = ctx.recordCache.get(`reports/${id}`) ?? null;
  if (!current) {
    const merged = mergedRecord(null, sub, value);
    requireCondition(isPlainObject(merged) && String((merged as any).ownerUid ?? "") === caller.uid);
    return;
  }
  requireCondition(ownerUidOf(current) === caller.uid);
  if (value === null) return;
  const merged = mergedRecord(current, sub, value);
  requireCondition(isPlainObject(merged) && String((merged as any).ownerUid ?? "") === caller.uid);
}

function guardAudit(ctx: Ctx, id: string, value: any): void {
  const { caller } = ctx;
  const current = ctx.recordCache.get(`audit/${id}`) ?? null;
  if (value === null) {
    requireCondition(caller.admin);
    return;
  }
  requireCondition(caller.staff && !current, 403, "অডিট লগ শুধু যোগ করা যায়।");
}

function guardMessages(ctx: Ctx, id: string, value: any): void {
  const { caller } = ctx;
  if (caller.staff) return;
  const current = ctx.recordCache.get(`messages/${id}`) ?? null;
  requireCondition(!current && value !== null, 403, "মেসেজ শুধু স্টাফ বদলাতে পারেন।");
}

async function guardMeta(ctx: Ctx, segs: string[], value: any): Promise<void> {
  const { caller } = ctx;
  if (caller.admin) return;
  if (segs[0] === "donorCounter" && segs.length === 2) {
    requireCondition(caller.staff);
    const n = toNumber(value);
    requireCondition(n !== null && n >= 0, 400, "কাউন্টার অবশ্যই ঋণাত্মক-নয় সংখ্যা হতে হবে।");
    const current = await readValue(ctx, `_meta/${segs.join("/")}`);
    const cur = toNumber(current);
    requireCondition(cur === null || n >= cur, 403, "কাউন্টার কমানো যায় না।");
    return;
  }
  if (segs[0] === "donorSerials" && segs.length === 2) {
    requireCondition(caller.staff);
    if (value !== null) {
      requireCondition(
        isPlainObject(value) && "at" in value && "year" in value,
        400,
        "সিরিয়াল ক্লেইমে at/year দিতে হবে।"
      );
    }
    return;
  }
  requireCondition(false, 403, DENY_MESSAGE);
}

/* ────────────────────────── entry point ────────────────────────── */

export type AuthorizeInput = {
  writes: Record<string, unknown>;
};

const SV_TIMESTAMP = { ".sv": "timestamp" };

function translateValue(value: any): any {
  if (isPlainObject(value)) {
    if (value.__sv__ === "timestamp" && Object.keys(value).length === 1) return SV_TIMESTAMP;
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(k)) throw new ApiError(400, "অবৈধ ফিল্ড।");
      out[k] = translateValue(value[k]);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(translateValue);
  return value;
}

function isIncMarker(v: any): v is { __inc__: number } {
  return isPlainObject(v) && typeof v.__inc__ === "number" && Object.keys(v).length === 1;
}

function isMaxMarker(v: any): v is { __max__: number } {
  return isPlainObject(v) && typeof v.__max__ === "number" && Object.keys(v).length === 1;
}

async function preloadRecords(ctx: Ctx, writes: Record<string, unknown>): Promise<void> {
  const RECORD_NODES = new Set([
    "users",
    "donors",
    "requests",
    "members",
    "queue",
    "donations",
    "accounts",
    "admins",
    "audit",
    "messages",
    "reports",
  ]);
  const jobs: Array<Promise<void>> = [];
  for (const rawPath of Object.keys(writes)) {
    const segs = validatePathShape(rawPath);
    const node = segs[0];
    if (!RECORD_NODES.has(node) || segs.length < 2) continue;
    const path = `${node}/${segs[1]}`;
    if (ctx.recordCache.has(path)) continue;
    jobs.push(
      (async () => {
        const value = await ctx.io.get(path).catch(() => null);
        ctx.recordCache.set(path, value ?? null);
      })()
    );
  }
  await Promise.all(jobs);
}

/**
 * Authorize + plan a multi-path write. Throws ApiError (401/403/400) when any
 * path is not permitted; nothing is written in that case.
 */
export async function authorizeDataWrite(
  caller: Caller,
  input: AuthorizeInput,
  io: GuardIo
): Promise<WritePlan> {
  const writes = input && typeof input === "object" ? (input as Record<string, unknown>).writes : null;
  if (!isPlainObject(writes) || !Object.keys(writes).length) {
    throw new ApiError(400, "কোনো লেখার অনুরোধ (writes) দেওয়া হয়নি।");
  }
  const paths = Object.keys(writes);
  requireCondition(paths.length <= MAX_PATHS, 400, "একসাথে এতগুলো পথ লেখা যায় না।");
  for (const rawPath of paths) {
    if (segments(rawPath).length < 2) {
      requireCondition(caller.admin, 403, "পুরো node লেখা শুধু অ্যাডমিন পারেন।");
    }
  }

  const ctx: Ctx = { caller, io, recordCache: new Map() };
  for (const rawPath of paths) validatePathShape(rawPath);
  await preloadRecords(ctx, writes);

  const patch: Record<string, any> = {};
  const values: Record<string, number> = {};

  for (const rawPath of paths) {
    const segs = segments(rawPath);
    const node = segs[0];
    const id = segs[1] ?? "";
    const sub = segs.slice(2);
    const rawValue = (writes as any)[rawPath];

    let value = rawValue;
    let marker: null | { kind: "inc" | "max"; n: number } = null;
    if (isIncMarker(rawValue)) marker = { kind: "inc", n: rawValue.__inc__ };
    else if (isMaxMarker(rawValue)) marker = { kind: "max", n: rawValue.__max__ };
    else value = translateValue(rawValue);

    let authorizedValue = value;
    if (marker) {
      const current = await readValue(ctx, rawPath);
      const cur = toNumber(current) ?? 0;
      const next = marker.kind === "inc" ? cur + marker.n : Math.max(marker.n, cur);
      requireCondition(Number.isFinite(next), 400, "সংখ্যা গণনা করা যায়নি।");
      authorizedValue = next;
      values[rawPath] = next;
    }

    switch (node) {
      case "users": {
        const current = ctx.recordCache.get(`users/${id}`) ?? null;
        guardUsersSubtree(ctx, id, sub, authorizedValue, current);
        break;
      }
      case "donors":
        guardDonors(ctx, id, sub, authorizedValue);
        break;
      case "requests":
        guardRequests(ctx, id, sub, authorizedValue);
        break;
      case "members":
        guardMembers(ctx, id, sub, authorizedValue);
        break;
      case "queue":
        await guardQueue(ctx, id, sub, authorizedValue);
        break;
      case "donations":
        guardDonations(ctx, id, sub, authorizedValue);
        break;
      case "accounts":
        guardAccounts(ctx, id, sub, authorizedValue);
        break;
      case "admins":
        guardAdmins(ctx, id, sub, authorizedValue);
        break;
      case "reports":
        guardReports(ctx, id, sub, authorizedValue);
        break;
      case "audit":
        guardAudit(ctx, id, authorizedValue);
        break;
      case "messages":
        guardMessages(ctx, id, authorizedValue);
        break;
      case "_meta":
        await guardMeta(ctx, segs.slice(1), authorizedValue);
        break;
      case "notices":
      case "gallery":
      case "settings":
      case "identityIndex":
      case "loginIndex":
        requireCondition(caller.admin, 403, "এই পরিবর্তন শুধু অ্যাডমিন করতে পারেন।");
        break;
      default:
        requireCondition(caller.admin, 403, DENY_MESSAGE);
    }
    patch[segs.join("/")] = authorizedValue;
  }
  return { patch, values };
}

/** Resolve the caller's role from the server-side admins row. */
export function callerRoleFromAdminRow(row: any, uid: string, email: string): Caller {
  const role = String(row && row.role ? row.role : "").toLowerCase();
  const status = String(row && row.status ? row.status : "active").toLowerCase();
  const active = status !== "disabled";
  const isAdmin = !!row && role === "admin" && active;
  const isMod = !!row && (role === "moderator" || role === "mod") && active;
  return {
    uid,
    email,
    role: isAdmin ? "admin" : isMod ? "moderator" : "donor",
    staff: isAdmin || isMod,
    admin: isAdmin,
  };
}
