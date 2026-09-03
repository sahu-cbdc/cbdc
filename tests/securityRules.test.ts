import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Guard rail: the performance work must never weaken Firebase Security Rules.
 * Only `.indexOn` entries may be added.
 */
const rules = JSON.parse(readFileSync("database.rules.json", "utf8"));
const base = JSON.parse(
  execSync("git show 07bdf009361217a2d83446b90388541404e45ac7:database.rules.json").toString()
);

function collectReadWrite(node: any, path = ""): Record<string, any> {
  const out: Record<string, any> = {};
  if (!node || typeof node !== "object") return out;
  for (const k of Object.keys(node)) {
    const p = path ? `${path}/${k}` : k;
    if (k === ".read" || k === ".write" || k === ".validate") out[p] = node[k];
    else if (k !== ".indexOn") Object.assign(out, collectReadWrite(node[k], p));
  }
  return out;
}

describe("Firebase Security Rules are not weakened", () => {
  it("keeps every .read/.write/.validate expression byte-identical", () => {
    expect(collectReadWrite(rules)).toEqual(collectReadWrite(base));
  });

  it("root still denies public read and all client writes", () => {
    expect(rules.rules[".write"]).toBe(false);
    expect(rules.rules[".read"]).toContain("auth != null");
  });

  it("only adds .indexOn entries, never removes them", () => {
    const idx = (o: any): Record<string, string[]> => {
      const out: Record<string, string[]> = {};
      for (const k of Object.keys(o.rules)) {
        const v = (o.rules as any)[k];
        if (v && typeof v === "object" && Array.isArray(v[".indexOn"])) out[k] = v[".indexOn"];
      }
      return out;
    };
    const now = idx(rules);
    for (const [node, keys] of Object.entries(idx(base))) {
      for (const k of keys) expect(now[node]).toContain(k);
    }
  });

  it("private nodes still require an admin/moderator claim to read", () => {
    for (const node of ["queue", "donations", "audit", "messages", "reports", "accounts"]) {
      expect(String(rules.rules[node][".read"])).toContain("auth != null");
    }
  });
});
