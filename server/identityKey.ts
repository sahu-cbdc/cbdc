/**
 * CBDC — ইমেইল → identityIndex কী (client src/lib/identity.ts-এর হুবহু মিরর)।
 * server bundle আর client bundle আলাদা হওয়ায় একই pure function দুই জায়গায় থাকে;
 * নিয়ম বদলালে দুটোই একসাথে বদলাতে হবে।
 */
export function emailIndexKey(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#.$/\[\]\\]/g, "_")
    .slice(0, 190);
}

/** identityIndex/email-এ এই ইমেইলের path। */
export function emailIndexPath(email: unknown): string {
  return `identityIndex/email/${emailIndexKey(email)}`;
}
