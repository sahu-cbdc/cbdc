

export type AbuseGuardOptions = {
  
  max: number;
  
  windowMs: number;
};

export type AbuseGuard = {
  
  check(key: string): boolean;
  
  count(key: string): number;
  
  clear(): void;
};

const DEFAULT_OPTS: AbuseGuardOptions = {
  
  max: 600,
  windowMs: 60_000,
};


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


export function guardKey(uid: string, endpoint: string): string {
  return `${String(uid || "anon")}::${String(endpoint || "api")}`;
}
