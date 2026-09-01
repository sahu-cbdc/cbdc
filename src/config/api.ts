/**
 * Central API gateway map — the single place endpoint paths live.
 *
 * The website and any future Android/iOS client call the SAME four
 * gateways; each gateway dispatches on `op` (see server/index.ts):
 *
 *   api/auth   → profile | claim-email | claim-login | resolve-legacy
 *   api/data   → write | apply | public-submit
 *   api/admin  → delete | dedupe | config-check | donor-id
 *   api/media  → image upload
 */
export const API_GATEWAYS = {
  auth: "api/auth",
  data: "api/data",
  admin: "api/admin",
  media: "api/media",
} as const;

export type ApiGateway = keyof typeof API_GATEWAYS;

/**
 * Request timeouts (ms) for every API call — client library defaults,
 * kept here so tuning never means hunting through lib files.
 */
export const API_TIMEOUTS = {
  default: 30_000,
  long: 45_000,
  upload: 25_000,
  statusCheck: 10_000,
  apply: 20_000,
  accountDelete: 20_000,
  dedupeScan: 30_000,
} as const;
