/**
 * The share inbox. iOS doesn't let a Home Screen web app receive shares, so the share sheet goes through
 * a Shortcut (or Android's share target) that uploads to the little server hosting the app; the app
 * picks things up from there whenever it comes to the front, and deletes them once they're in.
 * Only exists when served by server.mjs; elsewhere the endpoint 404s and this stays quiet.
 */
const base = import.meta.env.BASE_URL;
export const inboxUrl = () => new URL(`${base}api/inbox`, location.href).href;

interface Item {
  id: string;
  name: string;
  type: string;
}

export async function takeInbox(): Promise<File[]> {
  try {
    const res = await fetch(`${base}api/inbox`, { cache: "no-store" });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return [];
    const items: Item[] = await res.json();
    const files: File[] = [];
    for (const item of items) {
      const r = await fetch(`${base}api/inbox/${item.id}`, { cache: "no-store" });
      if (!r.ok) continue;
      files.push(new File([await r.blob()], item.name, { type: item.type }));
      await fetch(`${base}api/inbox/${item.id}`, { method: "DELETE" });
    }
    return files;
  } catch {
    return [];
  }
}

export async function inboxAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${base}api/inbox`, { cache: "no-store" });
    return res.ok && !!res.headers.get("content-type")?.includes("json");
  } catch {
    return false;
  }
}
