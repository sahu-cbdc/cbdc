
export function emailIndexKey(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}


export function emailIndexPath(email: unknown): string {
  return `identityIndex/email/${emailIndexKey(email)}`;
}
