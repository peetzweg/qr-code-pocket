import { useEffect, useRef, useState } from "react";
import { inboxUrl } from "../inbox";
import { exportBackup, importBackup } from "../store/backup";
import { usePasses } from "../store/passes";
import { Download, Upload } from "./icons";
import { Sheet } from "./Sheet";
import { setTheme, useTheme } from "../theme";
import { QR_STYLES } from "./qrart";
import { StylePager } from "./StylePager";
import { ColourPicker, SAMPLE, SampleCode } from "./ThemePicker";

export function Settings({ onClose, shareReady, focusShare }: { onClose: () => void; shareReady: boolean; focusShare?: boolean }) {
  const passes = usePasses((s) => s.passes);
  const file = useRef<HTMLInputElement>(null);
  const shareRef = useRef<HTMLElement>(null);
  const [msg, setMsg] = useState<string>();
  const [usage, setUsage] = useState<string>();
  const [persisted, setPersisted] = useState<boolean>();
  const [copied, setCopied] = useState(false);
  const [styling, setStyling] = useState(false);
  const style = useTheme((t) => t.qrStyle);
  const [signed, setSigned] = useState(false);
  const shortcutUrl = `${import.meta.env.BASE_URL}Add-to-Kippu.shortcut`;

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`));
    navigator.storage?.persisted?.().then(setPersisted);
    fetch(shortcutUrl, { method: "HEAD", cache: "no-store" }).then((r) => setSigned(r.ok && !r.headers.get("content-type")?.includes("html")), () => {});
    if (focusShare) setTimeout(() => shareRef.current?.scrollIntoView({ behavior: "smooth" }), 350);
  }, [focusShare]);

  async function doExport() {
    const f = await exportBackup();
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: "Kippu backup" });
      } catch {
        /* cancelled */
      }
    } else {
      Object.assign(document.createElement("a"), { href: URL.createObjectURL(f), download: f.name }).click();
    }
  }

  const used = passes.filter((p) => p.usedAt).length;

  return (
    <Sheet onClose={onClose} full>
      <div className="bar">
        <span />
        <span className="bar-title">Settings</span>
        <button className="link strong" onClick={onClose}>Done</button>
      </div>
      <div className="scroll settings">
        <section>
          <h3>Colour</h3>
          <ColourPicker />
        </section>
        <section>
          <h3>Code style</h3>
          <SampleCode />
          <button className="btn line wide" onClick={() => setStyling(true)}>{QR_STYLES.find((s) => s.id === style)?.label} · swipe through styles →</button>
        </section>
        <section>
          <h3>Your wallet</h3>
          <dl className="facts">
            <div><dt>Tickets</dt><dd>{passes.length - used} upcoming · {used} collected</dd></div>
            {usage && (
              <div><dt>Storage</dt><dd>{usage}{persisted ? " · kept" : ""}</dd></div>
            )}
          </dl>
          <p className="muted small">Everything stays on this phone, in the browser's storage. Nothing is uploaded, except what you send to the share inbox (below), which is deleted once the app picks it up.</p>
        </section>

        <section ref={shareRef}>
          <h3>Add from the share sheet</h3>
          {shareReady ? (
            <>
              <p className="small">iPhone doesn't let Home Screen web apps appear in the share sheet, so a Shortcut does it: share a screenshot or PDF to <strong>Add to Kippu</strong>, then open Kippu and it's there.</p>
              {signed && (
                <a className="btn solid wide" href={shortcutUrl} download="Add to Kippu.shortcut" target="_blank" rel="noreferrer">
                  Get the “Add to Kippu” shortcut
                </a>
              )}
              <details className="small" open={!signed}>
                <summary>{signed ? "Or build it yourself" : "Build the shortcut"}</summary>
              <ol className="steps small">
                <li>Open <strong>Shortcuts</strong>, tap <strong>+</strong>, name it <strong>Add to Kippu</strong>.</li>
                <li>Tap the <strong>ⓘ</strong> (or the name) and turn on <strong>Show in Share Sheet</strong>. Set it to receive <strong>Images</strong> and <strong>PDFs</strong>.</li>
                <li>Add <strong>Repeat with Each</strong> item in <em>Shortcut Input</em>.</li>
                <li>Inside it, add <strong>Get Contents of URL</strong> with the address below. Show more: Method <strong>POST</strong>, Request Body <strong>File</strong>, File: <em>Repeat Item</em>.</li>
                <li>Optional: after the repeat, <strong>Show Notification</strong> “Added to Kippu”.</li>
              </ol>
              <div className="copy-row">
                <code>{inboxUrl()}</code>
                <button
                  className="btn line"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inboxUrl());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              </details>
              <p className="muted small">Works while the phone is on your tailnet. On Android, Kippu shows up in the share sheet by itself once installed.</p>
            </>
          ) : (
            <p className="muted small">The share inbox isn't available where this copy of Kippu is hosted. Import from Photos &amp; Files instead.</p>
          )}
        </section>

        <section>
          <h3>Backup</h3>
          <div className="btn-row">
            <button className="btn line" onClick={doExport}>
              <Download /> Export
            </button>
            <button className="btn line" onClick={() => file.current?.click()}>
              <Upload /> Import
            </button>
          </div>
          <p className="muted small">On iPhone the Home Screen app keeps its own storage, separate from Safari. A backup moves your passes between them, or to a new phone.</p>
          {msg && <p className="note">{msg}</p>}
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const n = await importBackup(f);
                setMsg(n ? `Restored ${n} pass${n === 1 ? "" : "es"}.` : "Everything in that backup is already here.");
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Couldn't read that file.");
              }
            }}
          />
        </section>

        <section>
          <h3>About</h3>
          <p className="small">
            <strong>QR Code Wallet</strong> keeps your tickets and QR codes in one place. Codes are found and redrawn on your phone, and the text around them is read by a small
            on-device model (Tesseract, Japanese and English), so it works offline too.
          </p>
          <p className="muted small mono">
            v{__APP_VERSION__} · {__COMMIT__} · {new Date(__BUILT_AT__).toLocaleString("en-GB")}
          </p>
        </section>
      </div>
      {styling && <StylePager code={SAMPLE.codes[0]} value={style} title="Wallet style" onClose={() => setStyling(false)} onPick={(s) => { setTheme({ qrStyle: s }); setStyling(false); }} />}
    </Sheet>
  );
}
