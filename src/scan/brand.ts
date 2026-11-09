import { putImage } from "../store/db";

export interface Brand {
  site: string;
  name?: string;
  /** The logo, stored; absent when the site had none we could use. */
  logoId?: string;
}

/** "https://www.Uniqlo.com/jp/en/" → "uniqlo.com" */
export const siteLabel = (site: string) => site.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();

/**
 * A store's name and logo from its website. The app can't read other sites itself, so the server
 * fetches the page and its icons (see /api/brand in server.mjs). The logo is stored with the card,
 * so it shows offline.
 */
export async function lookupBrand(site: string): Promise<Brand> {
  const r = await fetch(`${import.meta.env.BASE_URL}api/brand?site=${encodeURIComponent(siteLabel(site))}`);
  const j = await r.json().catch(() => ({ error: "No answer" }));
  if (!r.ok || j.error) throw new Error(j.error ?? `Lookup failed (${r.status})`);
  let logoId: string | undefined;
  if (j.icon) {
    const bin = Uint8Array.from(atob(j.icon.data), (c) => c.charCodeAt(0));
    logoId = await putImage(new Blob([bin], { type: j.icon.type }));
  }
  return { site: j.site ?? siteLabel(site), name: j.name, logoId };
}
