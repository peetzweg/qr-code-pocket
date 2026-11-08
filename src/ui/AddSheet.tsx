import { useRef, useState } from "react";
import { Camera, Clipboard, Keyboard, Photos } from "./icons";
import { Sheet } from "./Sheet";

export function AddSheet({
  onClose,
  onFiles,
  onScan,
  onText,
  onShareHelp,
  shareReady,
}: {
  onClose: () => void;
  onFiles: (files: File[]) => void;
  onScan: () => void;
  onText: (text: string) => void;
  onShareHelp: () => void;
  shareReady: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [pasteError, setPasteError] = useState<string>();

  async function paste() {
    setPasteError(undefined);
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/") || t === "application/pdf");
        if (type) files.push(new File([await item.getType(type)], `Pasted.${type.split("/")[1]}`, { type }));
      }
      if (files.length) return onFiles(files);
      const t = (await navigator.clipboard.readText()).trim();
      if (t) return onText(t);
      setPasteError("Nothing to paste. Copy a screenshot or an image first.");
    } catch {
      setPasteError("Couldn't read the clipboard.");
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-pad">
        <h3 className="sheet-h">Add a ticket</h3>
        {typing ? (
          <div className="type-code">
            <p className="lede">The text or link inside the code, or a booking number to print as a QR code.</p>
            <textarea className="textbox" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="https://… or ABC123" />
            <div className="btn-row">
              <button className="btn line" onClick={() => setTyping(false)}>Back</button>
              <button className="btn solid" disabled={!text.trim()} onClick={() => onText(text.trim())}>Make code</button>
            </div>
          </div>
        ) : (
          <>
            <div className="rows">
              <button className="row-btn" onClick={() => input.current?.click()}>
                <Photos /> <span>Photos &amp; files<small>Screenshots, PDFs from email</small></span><em>→</em>
              </button>
              <button className="row-btn" onClick={onScan}>
                <Camera /> <span>Scan<small>A printed voucher, another phone</small></span><em>→</em>
              </button>
              <button className="row-btn" onClick={paste}>
                <Clipboard /> <span>Paste<small>A copied screenshot or link</small></span><em>→</em>
              </button>
              <button className="row-btn" onClick={() => setTyping(true)}>
                <Keyboard /> <span>Type<small>A link or booking number</small></span><em>→</em>
              </button>
            </div>
            {pasteError && <p className="note">{pasteError}</p>}
            {shareReady && (
              <button className="link hint" onClick={onShareHelp}>
                Tip: send screenshots straight from the share sheet with the “Add to Kippu” shortcut →
              </button>
            )}
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </div>
    </Sheet>
  );
}
