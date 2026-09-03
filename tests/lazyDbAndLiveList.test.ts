import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocked Firebase for rtdb.ts ───────────────────────────────────────── */
let TREE: any = {};
const listeners: Array<(v: any) => void> = [];
const getSpy = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (_d: any, p?: string) => ({ __path: p ?? "" }),
  child: (r: any, k: string) => ({ __path: `${r.__path}/${k}` }),
  get: async (r: any) => {
    getSpy(r.__path);
    const segs = String(r.__path || "").split("/").filter(Boolean);
    let cur = TREE;
    for (const s of segs) cur = cur == null ? undefined : cur[s];
    return { val: () => (cur === undefined ? null : cur) };
  },
  query: (r: any) => r,
  orderByChild: (f: string) => ({ f }),
  equalTo: (v: any) => ({ v }),
  limitToFirst: (n: number) => ({ n }),
  onValue: (_t: any, cb: any) => {
    listeners.push(cb);
    return () => undefined;
  },
}));
vi.mock("../src/lib/firebase", () => ({ getRtdb: () => ({}), NODES: {} }));
vi.mock("../src/lib/api", () => ({
  apiWritePaths: vi.fn(),
  apiIncrementField: vi.fn(),
  apiEnsureFieldAtLeast: vi.fn(),
  apiNextDonorId: vi.fn(),
  apiReleaseDonorSerial: vi.fn(),
  SERVER_TIMESTAMP: {},
}));

const rtdb = await import("../src/lib/rtdb");
const { watchListCached } = await import("../src/lib/liveList");
const { cacheSet, clearAllCache } = await import("../src/lib/idbCache");

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe("Database Management — lazy loading", () => {
  beforeEach(() => {
    getSpy.mockClear();
    TREE = {
      donors: { d1: { name: "A" }, d2: { name: "B" } },
      users: { u1: { email: "x@y.z" } },
      settings: { app: { rules: { minAge: 18 } } },
      flag: true,
    };
  });

  it("lists ONLY the top-level nodes first — never the whole tree", async () => {
    const res = await rtdb.listChildren("");
    expect(res.children.map((c) => c.key).sort()).toEqual(["donors", "flag", "settings", "users"]);
    // container children come back as descriptors, values withheld
    const donors = res.children.find((c) => c.key === "donors")!;
    expect(donors.type).toBe("object");
    expect(donors.count).toBe(2);
    expect(donors.value).toBeUndefined();
    expect(donors.truncated).toBe(true);
    // scalars are inlined (cheap)
    expect(res.children.find((c) => c.key === "flag")!.value).toBe(true);
  });

  it("loads a child node only when that node is asked for", async () => {
    getSpy.mockClear();
    const res = await rtdb.listChildren("donors");
    expect(getSpy).toHaveBeenCalledWith("donors");
    expect(res.children.map((c) => c.key)).toEqual(["d1", "d2"]);
  });

  it("paginates large nodes and reports hasMore", async () => {
    TREE.big = {};
    for (let i = 0; i < 250; i++) TREE.big["k" + i] = i;
    const p1 = await rtdb.listChildren("big", { limit: 100 });
    expect(p1.children).toHaveLength(100);
    expect(p1.hasMore).toBe(true);
    expect(p1.total).toBe(250);
    const p2 = await rtdb.listChildren("big", {
      limit: 100,
      startAfter: p1.children[99].key,
    });
    expect(p2.children).toHaveLength(100);
    expect(p2.hasMore).toBe(true);
    const p3 = await rtdb.listChildren("big", { limit: 100, startAfter: p2.children[99].key });
    expect(p3.children).toHaveLength(50);
    expect(p3.hasMore).toBe(false);
  });

  it("returns an empty page for a missing / scalar path instead of throwing", async () => {
    expect((await rtdb.listChildren("nope")).children).toEqual([]);
    expect((await rtdb.listChildren("flag")).children).toEqual([]);
  });

  it("listRootKeys exposes the top-level names", async () => {
    expect((await rtdb.listRootKeys()).sort()).toEqual(["donors", "flag", "settings", "users"]);
  });

  it("getPathOnce fetches a single node on demand", async () => {
    expect(await rtdb.getPathOnce("donors/d1")).toEqual({ name: "A" });
  });

  it("search uses a bounded server-side query, not a full download", async () => {
    TREE.donors = { d1: { name: "A", bloodGroup: "O+" } };
    const rows = await rtdb.queryChildrenByField("donors", "bloodGroup", "O+", 10);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("watchListCached — cache-first panel lists", () => {
  beforeEach(async () => {
    await clearAllCache();
    listeners.length = 0;
  });

  it("replays cached rows before Firebase answers, then the server wins", async () => {
    await cacheSet("list:audit", "uidA", [{ id: "a1", act: "cached" }]);
    const calls: Array<{ rows: any[]; fromCache: boolean }> = [];
    const un = watchListCached("audit", "uidA", (rows, meta) =>
      calls.push({ rows, fromCache: meta.fromCache })
    );
    await flush();
    expect(calls[0].fromCache).toBe(true);
    expect(calls[0].rows[0].act).toBe("cached");

    listeners[0]({ val: () => ({ a1: { act: "server" } }) } as any);
    await flush();
    const last = calls[calls.length - 1];
    expect(last.fromCache).toBe(false);
    expect(last.rows[0].act).toBe("server");
    un();
  });

  it("never replays another user's cached rows", async () => {
    await cacheSet("list:audit", "uidA", [{ id: "a1", act: "secret" }]);
    const calls: any[] = [];
    const un = watchListCached("audit", "uidB", (rows, meta) => calls.push({ rows, meta }));
    await flush();
    expect(calls.filter((c) => c.meta.fromCache)).toHaveLength(0);
    un();
  });

  it("skips the stale replay if the server already answered", async () => {
    await cacheSet("list:audit", "uidA", [{ id: "a1", act: "cached" }]);
    const calls: any[] = [];
    const un = watchListCached("audit", "uidA", (rows, meta) => calls.push(meta.fromCache));
    listeners[listeners.length - 1]({ val: () => ({ z: { act: "server" } }) } as any);
    await flush();
    expect(calls).not.toContain(true);
    un();
  });

  it("stops delivering after unsubscribe", async () => {
    const cb = vi.fn();
    const un = watchListCached("audit", "uidA", cb);
    un();
    listeners[listeners.length - 1]({ val: () => ({ a: { x: 1 } }) } as any);
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});
