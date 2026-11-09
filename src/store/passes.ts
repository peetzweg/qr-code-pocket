import { createStore, useStore } from "../store";
import { db, uid, type Pass } from "./db";

interface State {
  passes: Pass[];
  loaded: boolean;
}

const store = createStore<State>({ passes: [], loaded: false });
export const usePasses = <S,>(selector: (s: State) => S) => useStore(store, selector);
export const getPasses = () => store.get().passes;

export async function loadPasses() {
  const passes = await (await db).getAll("passes");
  store.set({ passes, loaded: true });
  // Ask the browser not to evict our storage when space runs low (granted silently on installed apps).
  navigator.storage?.persist?.().catch(() => {});
}

export type NewPass = Omit<Pass, "id" | "createdAt" | "updatedAt">;

export async function addPass(data: NewPass): Promise<Pass> {
  const now = Date.now();
  const pass: Pass = { ...data, id: uid(), createdAt: now, updatedAt: now };
  await (await db).put("passes", pass);
  store.set((s) => ({ passes: [...s.passes, pass] }));
  return pass;
}

export async function updatePass(id: string, patch: Partial<Pass>) {
  const current = store.get().passes.find((p) => p.id === id);
  if (!current) return;
  const next: Pass = { ...current, ...patch, updatedAt: Date.now() };
  // An explicit `undefined` in the patch clears the field.
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (next as unknown as Record<string, unknown>)[k];
  await (await db).put("passes", next);
  store.set((s) => ({ passes: s.passes.map((p) => (p.id === id ? next : p)) }));
}

export async function deletePass(id: string) {
  const d = await db;
  const pass = store.get().passes.find((p) => p.id === id);
  const tx = d.transaction(["passes", "images"], "readwrite");
  await tx.objectStore("passes").delete(id);
  if (pass) {
    const imageIds = [pass.sourceId, ...pass.codes.map((c) => c.cropId)].filter(Boolean) as string[];
    // Only images no other pass still points at (combined passes can share a source).
    const others = store.get().passes.filter((p) => p.id !== id);
    const used = new Set(others.flatMap((p) => [p.sourceId, ...p.codes.map((c) => c.cropId)]));
    for (const img of imageIds) if (!used.has(img)) await tx.objectStore("images").delete(img);
  }
  await tx.done;
  store.set((s) => ({ passes: s.passes.filter((p) => p.id !== id) }));
}

export const markUsed = (id: string) => updatePass(id, { usedAt: Date.now() });
export const restore = (id: string) => updatePass(id, { usedAt: undefined });

/** Sort key for the wallet: dated passes soonest first, then undated ones newest first. */
export function walletOrder(a: Pass, b: Pass) {
  const ka = a.date ? `${a.date}T${a.time ?? "99:99"}` : undefined;
  const kb = b.date ? `${b.date}T${b.time ?? "99:99"}` : undefined;
  if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : a.createdAt - b.createdAt;
  if (ka) return -1;
  if (kb) return 1;
  return b.createdAt - a.createdAt;
}

/**
 * The upcoming stack: by date, except that tickets the owner has dragged into place keep that order.
 * Ranked tickets take the date-order slots that ranked tickets hold, in rank order; a new, unranked
 * ticket still lands where its date puts it.
 */
export function walletSort(passes: Pass[]): Pass[] {
  const byDate = [...passes].sort(walletOrder);
  const ranked = byDate.filter((p) => p.rank !== undefined).sort((a, b) => a.rank! - b.rank!);
  let r = 0;
  return byDate.map((p) => (p.rank !== undefined ? ranked[r++] : p));
}

/** Save a dragged order: every ticket in `ids` gets its index as rank. The store updates first, so the drop doesn't flicker. */
export async function reorder(ids: string[]) {
  const changed = new Map<string, Pass>();
  const all = store.get().passes;
  ids.forEach((id, i) => {
    const p = all.find((x) => x.id === id);
    if (p && p.rank !== i) changed.set(id, { ...p, rank: i });
  });
  if (!changed.size) return;
  store.set((s) => ({ passes: s.passes.map((p) => changed.get(p.id) ?? p) }));
  const tx = (await db).transaction("passes", "readwrite");
  for (const p of changed.values()) tx.store.put(p);
  await tx.done;
}

/** Duplicate check on import: the same code payload already in the wallet or history. */
export function findByCode(text: string): Pass | undefined {
  return store.get().passes.find((p) => p.codes.some((c) => c.text === text));
}
