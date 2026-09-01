/**
 * Site-config source writer — the dev-server channel that persists editable
 * site copy back into src/config/site.ts. Pages call this helper instead of
 * fetching the control endpoint themselves.
 */
import { appBase } from "./router";
import { INTERNAL_ENDPOINTS } from "../config/api";

export type SiteConfigSourceValues = {
  heroTitle: string;
  heroText: string;
  phone: string;
  email: string;
  address: string;
  facebook: string;
  showStats: boolean;
  showGallery: boolean;
  showEmergency: boolean;
};

export async function saveSiteConfigToSource(values: SiteConfigSourceValues): Promise<boolean> {
  try {
    const res = await fetch(appBase() + INTERNAL_ENDPOINTS.siteConfigSource, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    return !!(data && data.ok);
  } catch (e) {
    console.warn("site config save:", (e as Error)?.message);
    return false;
  }
}
