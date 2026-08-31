/**
 * CBDC — Intelligent abuse protection (NOT a fixed user quota)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  উদ্দেশ্য: legitimate user-দের কার্যত unlimited ব্যবহার দিতে হবে, অথচ স্পষ্ট
 *  abuse/flooding (একই UID থেকে দ্রুত ধারাবাহিক অনুরোধের জোয়াড়) থামাতে হবে।
 *
 *  নকশা:
 *   • কোনো **fixed normal-user quota** (যেমন "২০০ অনুরোধ/মিনিট") UI-তে দেখানো
 *     হয় না এবং এটি legitimate usage-কে আটকায় না।
 *   • প্রতি-limit **key** (UID + endpoint) ভিত্তিক একটি **sliding-window burst
 *     limiter** — threshold খুবই উদার রাখা হয় (human/স্বাভাবিক ক্লিক কখনো
 *     স্পর্শ করে না), এবং শুধু সাসটেইনড abuse-এর ক্ষেত্রে 429 দেয়।
 *   • Multi-user legitimate traffic-এ প্রত্যেকের নিজস্ব bucket থাকে, তাই
 *     aggregate অনুমতি কার্যত unlimited — কোনো পর্যায়ে "সাইট সীমা" থেকে যায় না।
 *   • Return 429 শুধু abuse দমনের জন্য; message সংক্ষিপ্ত ও বন্ধুত্বপূর্ণ।
 *
 *  এই মডিউলটি pure (in-memory Map) — Worker (isolates-এ মেমরি) ও পরীক্ষা
 *  harness-এ একই logic চলে। Multi-instance deploy-এ প্রতিটি isolate নিজস্ব
 *  counter রাখে, যা abuse দমনে যথেষ্ট (ক্ষণস্থায়ী in-memory)।
 */

export type AbuseGuardOptions = {
  /** উইন্ডো-র মধ্যে সর্বোচ্চ অনুমোদিত request সংখ্যা (very generous)। */
  max: number;
  /** স্লাইডিং-উইন্ডোর দৈর্ঘ্য (ms)। */
  windowMs: number;
};

export type AbuseGuard = {
  /** key-এর জন্য অনুরোধ ভর্তি করা হয়েছে কি না; false = 429 (blocked)। */
  check(key: string): boolean;
  /** পরিসংখ্যান/পরীক্ষার জন্য বর্তমান উইন্ডোতে কতগুলো অনুরোধ আছে। */
  count(key: string): number;
  /** বর্তমান state মুছে ফেলা (পরীক্ষা/যখন দরকার হয়)। */
  clear(): void;
};

const DEFAULT_OPTS: AbuseGuardOptions = {
  /* খুবই উদার ও per-source: 600/মিনিট (Worker-এর ডিফল্ট)। এটি কোনো per-user
     normal-usage quota নয় — শুধু একই উৎস থেকে স্পষ্ট flood দমন। স্বাভাবিক ক্লিক/
     bulk-admin কাজ কখনো এতে পৌঁছায় না। ABUSE_GUARD_MAX দিয়ে আরও উদার করা যায়। */
  max: 600,
  windowMs: 60_000,
};

/** উইন্ডো-তে টাইমস্ট্যাম্প বজায় রাখা — স্লাইডিং উইন্ডো; মেমরি বেঁধে রাখা। */
export function createAbuseGuard(opts: Partial<AbuseGuardOptions> = {}): AbuseGuard {
  const { max, windowMs } = { ...DEFAULT_OPTS, ...opts };
  const buckets = new Map<string, number[]>();

  function prune(key: string, now: number): number[] {
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length) buckets.set(key, arr);
    else buckets.delete(key);
    return arr;
  }

  return {
    check(key: string): boolean {
      if (!key) return false;
      const now = Date.now();
      const arr = prune(key, now);
      if (arr.length >= max) {
        buckets.set(key, arr);
        return false;
      }
      arr.push(now);
      buckets.set(key, arr);
      return true;
    },
    count(key: string): number {
      return prune(key, Date.now()).length;
    },
    clear(): void {
      buckets.clear();
    },
  };
}

/** হলো ছোট helper — key তৈরি (UID + endpoint)। */
export function guardKey(uid: string, endpoint: string): string {
  return `${String(uid || "anon")}::${String(endpoint || "api")}`;
}
