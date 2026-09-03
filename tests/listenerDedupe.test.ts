import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The shared listener registry must open exactly ONE Firebase onValue()
 * per distinct query, no matter how many panels subscribe.
 */
const onValueCalls: Array<{ target: any; cb: (s: any) => void }> = [];
const detachSpy = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (_d: any, p?: string) => ({ __path: p ?? "" }),
  child: (r: any, k: string) => ({ __path: `${r.__path}/${k}` }),
  get: vi.fn(),
  query: (r: any) => r,
  orderByChild: (f: string) => ({ f }),
  equalTo: (v: any) => ({ v }),
  limitToFirst: (n: number) => ({ n }),
  onValue: (target: any, cb: any) => {
    onValueCalls.push({ target, cb });
    return detachSpy;
  },
}));

vi.mock("../src/lib/firebase", () => ({
  getRtdb: () => ({}),
  NODES: {},
}));

vi.mock("../src/lib/api", () => ({
  apiWritePaths: vi.fn(),
  apiIncrementField: vi.fn(),
  apiEnsureFieldAtLeast: vi.fn(),
  apiNextDonorId: vi.fn(),
  apiReleaseDonorSerial: vi.fn(),
  SERVER_TIMESTAMP: { __sv__: "timestamp" },
}));

const rtdb = await import("../src/lib/rtdb");

const emit = (value: any) => onValueCalls.forEach((c) => c.cb({ val: () => value }));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("shared realtime listener registry", () => {
  beforeEach(() => {
    onValueCalls.length = 0;
    detachSpy.mockClear();
  });

  it("attaches only one Firebase listener for identical watchList calls", () => {
    const a = vi.fn();
    const b = vi.fn();
    const un1 = rtdb.watchList("donors", a);
    const un2 = rtdb.watchList("donors", b);
    expect(onValueCalls.length).toBe(1);
    expect(rtdb.activeListenerCount()).toBe(1);
    un1();
    un2();
  });

  it("fans one server event out to every subscriber", () => {
    const a = vi.fn();
    const b = vi.fn();
    const un1 = rtdb.watchList("donors", a);
    const un2 = rtdb.watchList("donors", b);
    emit({ k1: { name: "x" } });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a.mock.calls[0][0]).toEqual([{ name: "x", id: "k1" }]);
    un1();
    un2();
  });

  it("replays the last value to a late subscriber without a new fetch", async () => {
    const un1 = rtdb.watchList("donors", vi.fn());
    emit({ k1: { name: "x" } });
    const late = vi.fn();
    const un2 = rtdb.watchList("donors", late);
    expect(onValueCalls.length).toBe(1); // still no second listener
    await flush();
    expect(late).toHaveBeenCalledTimes(1);
    un1();
    un2();
  });

  it("detaches from Firebase only when the LAST subscriber leaves", () => {
    const un1 = rtdb.watchList("donors", vi.fn());
    const un2 = rtdb.watchList("donors", vi.fn());
    un1();
    expect(detachSpy).not.toHaveBeenCalled();
    un2();
    expect(detachSpy).toHaveBeenCalledTimes(1);
    expect(rtdb.activeListenerCount()).toBe(0);
  });

  it("is idempotent — unsubscribing twice does not double-detach", () => {
    const un = rtdb.watchList("donors", vi.fn());
    un();
    un();
    expect(detachSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps different queries on separate listeners", () => {
    const a = rtdb.watchList("donors", vi.fn());
    const b = rtdb.watchList("requests", vi.fn());
    const c = rtdb.watchList("donors", vi.fn(), { limit: 10 });
    expect(rtdb.activeListenerCount()).toBe(3);
    a();
    b();
    c();
  });

  it("de-duplicates watchRow and watchPath too", () => {
    const a = rtdb.watchRow("users", "u1", vi.fn());
    const b = rtdb.watchRow("users", "u1", vi.fn());
    const c = rtdb.watchPath("/", vi.fn());
    const d = rtdb.watchPath("/", vi.fn());
    expect(rtdb.activeListenerCount()).toBe(2);
    a();
    b();
    c();
    d();
    expect(rtdb.activeListenerCount()).toBe(0);
  });
});
