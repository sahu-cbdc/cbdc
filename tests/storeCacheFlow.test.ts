import { describe, it, expect, vi, beforeAll } from "vitest";

/**
 * End-to-end (mocked-Firebase) verification of the new data layer:
 *   refresh → IndexedDB cache renders first → Firebase overwrites in background
 *   add/edit/delete → optimistic UI → success keeps / failure rolls back
 *   logout → private cached data is gone
 */

let authCb: ((u: any) => void) | null = null;
let currentUser: any = { uid: "uidA" };
const listeners = new Map<string, (rows: any[]) => void>();

vi.mock("../src/lib/authState", () => ({
  getAuthUser: () => currentUser,
  subscribeAuthUser: (cb: any) => {
    authCb = cb;
    return () => (authCb = null);
  },
}));

vi.mock("../src/lib/firebase", () => ({
  NODES: {},
  getAuthInstance: () => ({ currentUser }),
}));

const setRow = vi.fn(async () => undefined);
const removeRow = vi.fn(async () => undefined);

vi.mock("../src/lib/rtdb", () => ({
  watchList: (node: string, cb: any) => {
    listeners.set(node, cb);
    return () => listeners.delete(node);
  },
  setRow: (...a: any[]) => setRow(...(a as [])),
  removeRow: (...a: any[]) => removeRow(...(a as [])),
}));

import { cacheSet, cacheGet, clearAllCache } from "../src/lib/idbCache";

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let store: any;
let stopRealtimeSync: any;

beforeAll(async () => {
  await clearAllCache();
  // Seed IndexedDB as if a previous session had already loaded data.
  await cacheSet("shared.public", null, {
    updatedAt: new Date().toISOString(),
    donors: [{ id: "d1", name: "Cached Donor", status: "approved" }],
    requests: [],
    gallery: [],
    notices: [],
  });
  await cacheSet("shared.private", "uidA", {
    updatedAt: new Date().toISOString(),
    accounts: [{ id: "a1", uid: "uidA", name: "Private A" }],
    queue: [],
    donations: [],
  });
  const mod = await import("../src/lib/store");
  store = mod.default;
  stopRealtimeSync = mod.stopRealtimeSync;
  await store.whenHydrated();
  await flush();
});

describe("refresh → cached data first → background Firebase sync", () => {
  it("renders cached public data without waiting for Firebase", () => {
    const s = store.load();
    expect(s.donors).toHaveLength(1);
    expect(s.donors[0].name).toBe("Cached Donor");
  });

  it("renders cached PRIVATE data for the signed-in uid", () => {
    expect(store.load().accounts[0].name).toBe("Private A");
  });

  it("reports hasData so panels can skip the full-page skeleton", () => {
    expect(store.hasData("donors")).toBe(true);
    expect(store.hasData("gallery")).toBe(false); // truly empty → skeleton is fine
  });

  it("marks cache-hydrated nodes as loaded", () => {
    expect(store.isNodeLoaded("donors")).toBe(true);
  });

  it("lets the Firebase snapshot OVERWRITE the cache (Firebase is authoritative)", async () => {
    const seen: any[] = [];
    const un = store.subscribe((s: any, meta: any) => seen.push({ s, meta }));
    listeners.get("donors")!([{ id: "d1", name: "Server Donor", status: "approved" }]);
    await flush();
    expect(store.load().donors[0].name).toBe("Server Donor");
    const rtdbEvent = seen.find((x) => x.meta && x.meta.source === "rtdb");
    expect(rtdbEvent).toBeTruthy();
    un();
  });

  it("persists the authoritative value back into IndexedDB", async () => {
    await flush(200);
    const pub: any = await cacheGet("shared.public", null);
    expect(pub.donors[0].name).toBe("Server Donor");
  });

  it("does not re-notify when Firebase resends an identical snapshot", async () => {
    const cb = vi.fn();
    const un = store.subscribe(cb);
    await flush();
    cb.mockClear();
    listeners.get("donors")!([{ id: "d1", name: "Server Donor", status: "approved" }]);
    await flush();
    expect(cb).not.toHaveBeenCalled();
    un();
  });
});

describe("optimistic add/edit/delete", () => {
  it("shows the change immediately, before the write resolves", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const p = store.optimistic(
      (s: any) => {
        s.notices.push({ id: "n1", title: "New notice" });
        return s;
      },
      async () => {
        await gate;
        return "ok";
      }
    );
    // UI already updated while the write is still in flight
    expect(store.load().notices).toHaveLength(1);
    release();
    await p;
    expect(store.load().notices).toHaveLength(1);
  });

  it("rolls the UI back and rethrows when the Firebase write fails", async () => {
    const before = store.load().notices.length;
    const seen: any[] = [];
    const un = store.subscribe((_s: any, meta: any) => seen.push(meta));
    await expect(
      store.optimistic(
        (s: any) => {
          s.notices.push({ id: "bad", title: "Will fail" });
          return s;
        },
        async () => {
          throw new Error("permission denied");
        }
      )
    ).rejects.toThrow("permission denied");
    expect(store.load().notices).toHaveLength(before);
    expect(seen.some((m) => m && m.rolledBack)).toBe(true);
    un();
  });

  it("does not fabricate success — the caller sees the real error", async () => {
    await expect(
      store.optimistic((s: any) => s, async () => {
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");
  });
});

describe("logout clears private cached data", () => {
  it("empties private collections and wipes them from IndexedDB", async () => {
    expect(store.load().accounts.length).toBeGreaterThan(0);
    currentUser = null;
    authCb!(null);
    await flush(120);
    expect(store.load().accounts).toHaveLength(0);
    expect(await cacheGet("shared.private", "uidA")).toBeNull();
  });

  it("keeps PUBLIC cached data after logout (it is not sensitive)", async () => {
    expect(await cacheGet("shared.public", null)).toBeTruthy();
  });

  it("tears every listener down cleanly on stopRealtimeSync", () => {
    stopRealtimeSync();
    expect(listeners.size).toBe(0);
  });
});
