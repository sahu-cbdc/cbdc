
/**
 * Index-key normalization shared by every server-side identity/login index
 * operation (email claim, login username/phone claim, dedupe, legacy merge).
 * The client keeps its own copy in src/lib/identity.ts (browsers cannot
 * import from server/).
 */
export function indexKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

export function emailIndexKey(email: unknown): string {
  return indexKey(email);
}

export function emailIndexPath(email: unknown): string {
  return `identityIndex/email/${emailIndexKey(email)}`;
}

export function loginIndexKey(value: unknown): string {
  return indexKey(value);
}

export function loginIndexPath(kind: "username" | "phone", value: unknown): string {
  return `loginIndex/${kind}/${indexKey(value)}`;
}
