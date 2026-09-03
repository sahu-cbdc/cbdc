/**
 * Write-path helpers: request de-duplication + temporary action locks.
 *
 * Panels call the same handlers from buttons the user can hammer. These
 * helpers make sure a second click while the first Firebase write is still
 * in flight reuses the pending promise instead of issuing a duplicate write.
 */

const inflight = new Map<string, Promise<any>>();

/**
 * Run `fn` under `key`. While a call for that key is in flight, every extra
 * call gets the SAME promise back — no duplicate Firebase write is issued.
 */
export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  let p: Promise<T>;
  try {
    p = Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e);
  }
  const tracked = p.finally(() => {
    if (inflight.get(key) === tracked) inflight.delete(key);
  });
  inflight.set(key, tracked);
  return tracked;
}

export function isLocked(key: string): boolean {
  return inflight.has(key);
}

/**
 * Disable a button for the duration of an async action and restore it
 * afterwards — visual style is untouched, only the `disabled` flag moves.
 */
export async function withButtonLock<T>(
  btn: { disabled?: boolean } | null | undefined,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (btn && btn.disabled) return Promise.reject(new Error("locked"));
  if (btn) btn.disabled = true;
  try {
    return await runExclusive(key, fn);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Trailing debounce. Repeated calls inside `ms` collapse into one. */
export function debounce<A extends any[]>(
  fn: (...args: A) => void,
  ms = 250
): ((...args: A) => void) & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return wrapped;
}

/** Test helper. */
export function __resetLocksForTests(): void {
  inflight.clear();
}
