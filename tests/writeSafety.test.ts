import { describe, it, expect, beforeEach, vi } from "vitest";
import { runExclusive, withButtonLock, isLocked, debounce, __resetLocksForTests } from "../src/lib/actionLock";

describe("action locks / request de-duplication", () => {
  beforeEach(() => __resetLocksForTests());

  it("collapses concurrent calls with the same key into ONE execution", async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "done";
    });
    const [a, b, c] = await Promise.all([
      runExclusive("save", fn),
      runExclusive("save", fn),
      runExclusive("save", fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(["done", "done", "done"]);
  });

  it("releases the lock after settling so a retry still runs", async () => {
    const fn = vi.fn(async () => "x");
    await runExclusive("k", fn);
    expect(isLocked("k")).toBe(false);
    await runExclusive("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after a FAILED write so the user can retry", async () => {
    const bad = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(runExclusive("k", bad)).rejects.toThrow("network");
    expect(isLocked("k")).toBe(false);
    await expect(runExclusive("k", bad)).rejects.toThrow("network");
    expect(bad).toHaveBeenCalledTimes(2);
  });

  it("does not collapse different keys", async () => {
    const fn = vi.fn(async () => 1);
    await Promise.all([runExclusive("a", fn), runExclusive("b", fn)]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("withButtonLock disables then re-enables the button", async () => {
    const btn: any = { disabled: false };
    const p = withButtonLock(btn, "b1", async () => {
      expect(btn.disabled).toBe(true);
      return "ok";
    });
    expect(await p).toBe("ok");
    expect(btn.disabled).toBe(false);
  });

  it("withButtonLock re-enables the button even when the write fails", async () => {
    const btn: any = { disabled: false };
    await expect(
      withButtonLock(btn, "b2", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(btn.disabled).toBe(false);
  });

  it("debounce collapses a burst into one call", async () => {
    const fn = vi.fn();
    const d = debounce(fn, 5);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* ── apiWritePaths in-flight de-duplication ───────────────────────────── */

const postSpy = vi.fn();
vi.mock("../src/lib/firebase", () => ({
  getAuthInstance: () => ({ currentUser: { getIdToken: async () => "test-token" } }),
}));
vi.mock("../src/lib/router", () => ({ appBase: () => "" }));
vi.mock("../src/config/api", () => ({
  API_GATEWAYS: { data: "/api/data" },
  API_TIMEOUTS: { default: 1000 },
}));

describe("apiWritePaths duplicate-write protection", () => {
  it("issues ONE request for two identical concurrent writes", async () => {
    let resolveFetch: (v: any) => void = () => {};
    const gate = new Promise((r) => (resolveFetch = r));
    (globalThis as any).fetch = vi.fn(async () => {
      postSpy();
      await gate;
      return { ok: true, json: async () => ({ ok: true, applied: 1, values: {} }) } as any;
    });
    const api = await import("../src/lib/api");
    api.__resetWriteDedupe();
    const w = { "donors/a/name": "x" };
    const p1 = api.apiWritePaths(w);
    const p2 = api.apiWritePaths(w);
    resolveFetch(null);
    await Promise.all([p1, p2]);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT collapse increment sentinels (two +1 clicks mean +2)", async () => {
    postSpy.mockClear();
    (globalThis as any).fetch = vi.fn(async () => {
      postSpy();
      return { ok: true, json: async () => ({ ok: true, applied: 1, values: {} }) } as any;
    });
    const api = await import("../src/lib/api");
    api.__resetWriteDedupe();
    const w = { "donors/a/donations": { __inc__: 1 } };
    await Promise.all([api.apiWritePaths(w), api.apiWritePaths(w)]);
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("allows a fresh write after the first one settles", async () => {
    postSpy.mockClear();
    (globalThis as any).fetch = vi.fn(async () => {
      postSpy();
      return { ok: true, json: async () => ({ ok: true, applied: 1, values: {} }) } as any;
    });
    const api = await import("../src/lib/api");
    api.__resetWriteDedupe();
    const w = { "donors/a/name": "y" };
    await api.apiWritePaths(w);
    await api.apiWritePaths(w);
    expect(postSpy).toHaveBeenCalledTimes(2);
  });
});
