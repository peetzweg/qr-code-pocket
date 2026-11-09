import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { inboxAvailable, takeInbox } from "./inbox";
import { draftFromText, type Draft } from "./scan/importer";
import { loadPasses, usePasses, walletOrder, walletSort } from "./store/passes";
import { useTheme } from "./theme";
import { AddSheet } from "./ui/AddSheet";
import { categoryInfo } from "./categories";
import { WalletStack } from "./ui/WalletStack";
import { historyDay } from "./ui/format";
import { Onboarding } from "./ui/Onboarding";
import { Review, type Source } from "./ui/Review";
import { Scanner } from "./ui/Scanner";
import { Settings } from "./ui/Settings";
import { Sheet } from "./ui/Sheet";
import { prepareCode } from "./ui/qr";
import type { Pass } from "./store/db";

type Tab = "upcoming" | "collected";
interface Toast {
  id: number;
  msg: string;
  undo?: () => void;
}

export function App() {
  const onboarded = useTheme((t) => t.onboarded);
  const passes = usePasses((s) => s.passes);
  const loaded = usePasses((s) => s.loaded);
  const [tab, setTab] = useState<Tab>("upcoming");
  /** A ticket is open in the wallet (the title area fades, the list stops scrolling). */
  const [selecting, setSelecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sources, setSources] = useState<Source[]>();
  const [settings, setSettings] = useState<false | "open" | "share">(false);
  const [toast, setToast] = useState<Toast>();
  const [shareReady, setShareReady] = useState(false);

  const upcoming = useMemo(() => walletSort(passes.filter((p) => !p.usedAt)), [passes]);
  const collected = useMemo(() => passes.filter((p) => p.usedAt).sort(byUsed), [passes]);


  const showToast = useCallback((msg: string, undo?: () => void) => {
    const id = Date.now();
    setToast({ id, msg, undo });
    setTimeout(() => setToast((t) => (t?.id === id ? undefined : t)), 4500);
  }, []);
  const importFiles = useCallback((files: File[]) => {
    setAdding(false);
    setSources(files.map((file) => ({ kind: "file" as const, file })));
  }, []);
  const importDraft = useCallback((draft: Draft) => {
    setAdding(false);
    setScanning(false);
    setSources([{ kind: "draft", draft }]);
  }, []);

  // Draw every upcoming ticket's code in the background, nearest first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const p of upcoming) {
        if (cancelled) return;
        if (p.codes[0]) await prepareCode(p.codes[0], p.style);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upcoming]);

  useEffect(() => {
    loadPasses();
    inboxAvailable().then(setShareReady);
    if (new URLSearchParams(location.search).has("inbox")) history.replaceState(null, "", location.pathname);
  }, []);

  useEffect(() => {
    if (!shareReady || !onboarded) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible" || sources) return;
      busy = true;
      const files = await takeInbox();
      busy = false;
      if (files.length) importFiles(files);
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [shareReady, sources, importFiles, onboarded]);

  useEffect(() => {
    const pick = (list?: FileList | null) => [...(list ?? [])].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      const files = pick(e.clipboardData?.files);
      if (files.length) {
        e.preventDefault();
        importFiles(files);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = pick(e.dataTransfer?.files);
      if (files.length) importFiles(files);
    };
    addEventListener("paste", onPaste);
    addEventListener("dragover", onDragOver);
    addEventListener("drop", onDrop);
    return () => {
      removeEventListener("paste", onPaste);
      removeEventListener("dragover", onDragOver);
      removeEventListener("drop", onDrop);
    };
  }, [importFiles]);

  if (!onboarded) return <Onboarding />;

  // The soonest by date, whatever order the stack has been dragged into.
  const next = upcoming.reduce<Pass | undefined>((a, p) => (!a || walletOrder(p, a) < 0 ? p : a), undefined);
  return (
    <div className={`app${selecting ? " selecting" : ""}`}>
      <main className="main">
        <header className="header">
          <div className="masthead">
            <span>QR Code Pocket</span>
            <span className="masthead-actions">
              <button className="link" onClick={() => setSettings("open")}>Settings</button>
              <button className="link strong" onClick={() => setAdding(true)}>+ Add</button>
            </span>
          </div>
          <h1 className="title serif">{tab === "upcoming" ? "Upcoming" : "Collected"}</h1>
          <p className="subtitle">
            {tab === "upcoming"
              ? upcoming.length
                ? `${upcoming.length} ticket${upcoming.length === 1 ? "" : "s"}${next?.time ? ` · next at ${next.time}` : ""}`
                : "Nothing coming up"
              : `${collected.length} used`}
          </p>
          <nav className="tabs">
            <button className={tab === "upcoming" ? "on" : ""} onClick={() => setTab("upcoming")}>Upcoming {upcoming.length || ""}</button>
            <button className={tab === "collected" ? "on" : ""} onClick={() => setTab("collected")}>Collected {collected.length || ""}</button>
          </nav>
        </header>
        {loaded &&
          (tab === "upcoming" ? (
            upcoming.length ? (
              <WalletStack key="upcoming" reorderable passes={upcoming} onToast={showToast} onSelecting={setSelecting} />
            ) : (
              <Empty onAdd={() => setAdding(true)} />
            )
          ) : collected.length ? (
            <>
              <Stats passes={collected} />
              <WalletStack key="collected" passes={collected} onToast={showToast} onSelecting={setSelecting} />
            </>
          ) : (
            <p className="lede empty-note">Mark a ticket as used and it's postmarked and kept here, so the trip stays with you.</p>
          ))}
      </main>

      <AnimatePresence>
        {adding && (
          <AddSheet
            key="add"
            onClose={() => setAdding(false)}
            onFiles={importFiles}
            onScan={() => {
              setAdding(false);
              setScanning(true);
            }}
            onText={(t) => importDraft(draftFromText(t))}
            onShareHelp={() => {
              setAdding(false);
              setSettings("share");
            }}
            shareReady={shareReady}
          />
        )}
        {sources && (
          <Sheet key="review" full onClose={() => setSources(undefined)}>
            <Review
              sources={sources}
              onDone={(n) => {
                setSources(undefined);
                if (n) {
                  setTab("upcoming");
                  showToast(n === 1 ? "Added to your pocket" : `Added ${n} tickets`);
                }
              }}
            />
          </Sheet>
        )}
        {settings && <Settings key="settings" onClose={() => setSettings(false)} shareReady={shareReady} focusShare={settings === "share"} />}
      </AnimatePresence>

      {scanning && <Scanner onDraft={importDraft} onClose={() => setScanning(false)} />}

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="toast" initial={{ y: -24, opacity: 0, x: "-50%" }} animate={{ y: 0, opacity: 1, x: "-50%" }} exit={{ y: -24, opacity: 0, x: "-50%", transition: { duration: 0.16 } }} transition={{ type: "spring", stiffness: 500, damping: 36 }}>
            <span>{toast.msg}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  setToast(undefined);
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const byUsed = (a: Pass, b: Pass) => (b.usedAt ?? 0) - (a.usedAt ?? 0);

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <p className="serif-l">No tickets yet.</p>
      <p className="lede">Add a screenshot, a PDF from your email, or scan a code. It's read on this phone and printed in your style.</p>
      <button className="btn solid" onClick={onAdd}>Add a ticket</button>
    </div>
  );
}

/** A few numbers about the trip, like a passport's stamp count. */
function Stats({ passes }: { passes: Pass[] }) {
  const places = new Set(passes.flatMap((p) => [p.from, p.to, p.place]).filter((v): v is string => !!v && !/\./.test(v)));
  const byCat = new Map<string, number>();
  for (const p of passes) byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
  const top = [...byCat.entries()].filter(([c]) => c !== "other").sort((a, b) => b[1] - a[1])[0];
  const stats: [number, string][] = [[passes.length, passes.length === 1 ? "ticket" : "tickets"], [new Set(passes.map(historyDay)).size, "days"], [places.size, "places"]];
  if (top) stats.push([top[1], `${categoryInfo(top[0] as Pass["category"]).label.toLowerCase()}${top[1] === 1 ? "" : "s"}`]);
  return (
    <div className="stats">
      {stats.map(([n, l]) => (
        <div key={l}><b>{n}</b>{l}</div>
      ))}
    </div>
  );
}
