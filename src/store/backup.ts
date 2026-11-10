import { db, type Pass, type StoredImage } from "./db";
import { loadPasses } from "./passes";

/**
 * A backup is one JSON file with every pass and image in it. Worth having on a trip: on iPhone, the
 * Home Screen app and Safari keep separate storage, and a lost phone takes the wallet with it.
 */
const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;

type Encoded<T> = T & { __b64?: true };

export async function exportBackup(): Promise<File> {
  const d = await db;
  const passes = (await d.getAll("passes")).map((p) => ({ ...p, codes: p.codes.map((c) => ({ ...c, bytes: c.bytes ? b64(c.bytes) : undefined })) }));
  const images = (await d.getAll("images")).map((img) => ({ id: img.id, type: img.type, data: b64(img.data) }));
  const json = JSON.stringify({ app: "kippu", version: 1, exportedAt: new Date().toISOString(), passes, images });
  const day = new Date().toISOString().slice(0, 10);
  return new File([json], `qr-code-pocket-backup-${day}.json`, { type: "application/json" });
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "kippu" || !Array.isArray(data.passes)) throw new Error("That isn't a QR Code Pocket backup.");
  const d = await db;
  const tx = d.transaction(["passes", "images"], "readwrite");
  let added = 0;
  for (const img of data.images as Encoded<{ id: string; type: string; data: string }>[]) {
    if (!(await tx.objectStore("images").get(img.id))) await tx.objectStore("images").put({ id: img.id, type: img.type, data: unb64(img.data) } satisfies StoredImage);
  }
  for (const p of data.passes as (Omit<Pass, "codes"> & { codes: (Omit<Pass["codes"][number], "bytes"> & { bytes?: string })[] })[]) {
    if (await tx.objectStore("passes").get(p.id)) continue;
    await tx.objectStore("passes").put({ ...p, codes: p.codes.map((c) => ({ ...c, bytes: c.bytes ? unb64(c.bytes) : undefined })) });
    added++;
  }
  await tx.done;
  await loadPasses();
  return added;
}
