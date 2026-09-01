


export const DEFAULT_CORS_ORIGINS = [
  "https://chawkbazarbloodclub.com",
  "https://www.chawkbazarbloodclub.com",
] as const;


export function parseAllowedOrigins(raw?: string | null): string[] {
  const set = new Set<string>();
  for (const o of DEFAULT_CORS_ORIGINS) set.add(normalizeOrigin(o));
  if (raw && typeof raw === "string") {
    for (const piece of raw.split(",")) {
      const o = normalizeOrigin(piece);
      if (o) set.add(o);
    }
  }
  return [...set];
}


export function normalizeOrigin(value: string): string {
  let v = String(value || "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return (u.protocol + "//" + u.host).toLowerCase().replace(/\/+$/, "");
  } catch {
    return "";
  }
}


export function isAllowedOrigin(origin: string | null | undefined, allowed: string[]): boolean {
  const o = normalizeOrigin(origin || "");
  if (!o) return false;
  return allowed.some((a) => normalizeOrigin(a) === o);
}

export type CorsPolicy = {
  
  headers: Record<string, string>;
  
  preflight: boolean;
};


export function corsForRequest(
  origin: string | null | undefined,
  method: string | null | undefined,
  allowedOrigins: string[] = parseAllowedOrigins(),
  requestMethod: string | null | undefined = undefined,
): CorsPolicy {
  const o = normalizeOrigin(origin || "");
  const headers: Record<string, string> = {};
  let preflight = false;
  
  const actual = String(method || "").toUpperCase();
  const requested = String(requestMethod || "").toUpperCase();

  if (o && isAllowedOrigin(o, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = o;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = requested
      ? `${requested}, OPTIONS`
      : "POST, OPTIONS";
    if (actual === "OPTIONS") {
      headers["Access-Control-Max-Age"] = "600";
      preflight = true;
    }
  }
  return { headers, preflight };
}
