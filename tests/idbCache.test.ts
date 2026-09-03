import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  clearPrivateCache,
  clearForeignCache,
  clearAllCache,
  CACHE_SCHEMA_VERSION,
} from "../src/lib/idbCache";

describe("IndexedDB cache", () => {
  beforeEach(async () => {
    await clearAllCache();
  });

  it("round-trips a value", async () => {
    await cacheSet("ns", null, { a: 1 });
    expect(await cacheGet("ns", null)).toEqual({ a: 1 });
  });

  it("returns null on a miss", async () => {
    expect(await cacheGet("nope", null)).toBeNull();
  });

  it("scopes records per owner — user B never reads user A's data", async () => {
    await cacheSet("private", "uidA", { secret: "A" });
    await cacheSet("private", "uidB", { secret: "B" });
    expect(await cacheGet("private", "uidA")).toEqual({ secret: "A" });
    expect(await cacheGet("private", "uidB")).toEqual({ secret: "B" });
    expect(await cacheGet("private", "uidC")).toBeNull();
    // anonymous / public reader sees neither
    expect(await cacheGet("private", null)).toBeNull();
  });

  it("expires records older than maxAge", async () => {
    await cacheSet("ns", null, { a: 1 });
    expect(await cacheGet("ns", null, -1)).toBeNull();
  });

  it("clearPrivateCache wipes owned records but keeps public ones", async () => {
    await cacheSet("pub", null, { p: 1 });
    await cacheSet("priv", "uidA", { s: 1 });
    await clearPrivateCache();
    expect(await cacheGet("pub", null)).toEqual({ p: 1 });
    expect(await cacheGet("priv", "uidA")).toBeNull();
  });

  it("clearForeignCache keeps the current uid and drops the others", async () => {
    await cacheSet("priv", "uidA", { s: "a" });
    await cacheSet("priv", "uidB", { s: "b" });
    await cacheSet("pub", null, { p: 1 });
    await clearForeignCache("uidB");
    expect(await cacheGet("priv", "uidA")).toBeNull();
    expect(await cacheGet("priv", "uidB")).toEqual({ s: "b" });
    expect(await cacheGet("pub", null)).toEqual({ p: 1 });
  });

  it("cacheDelete removes exactly one record", async () => {
    await cacheSet("a", null, 1);
    await cacheSet("b", null, 2);
    await cacheDelete("a", null);
    expect(await cacheGet("a", null)).toBeNull();
    expect(await cacheGet("b", null)).toBe(2);
  });

  it("exposes a schema version so future changes can invalidate old caches", () => {
    expect(typeof CACHE_SCHEMA_VERSION).toBe("number");
    expect(CACHE_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
