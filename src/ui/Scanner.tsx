import { useEffect, useRef, useState } from "react";
import { toCanvas, pixels } from "../scan/image";
import { draftFromCanvas, type Draft } from "../scan/importer";
import { findCodes } from "../scan/zxing";
import { Close } from "./icons";

/** Point the camera at a code (a printed voucher, a friend's phone) and it's added. */
export function Scanner({ onDraft, onClose }: { onDraft: (d: Draft) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        while (!stop) {
          if (v.videoWidth) {
            const canvas = toCanvas(v, v.videoWidth, v.videoHeight, 1600);
            const found = await findCodes(pixels(canvas), true);
            if (found.length && !stop) {
              navigator.vibrate?.(40);
              // Look again at full effort, in case there's more than one code in view.
              const full = toCanvas(v, v.videoWidth, v.videoHeight);
              const all = await findCodes(pixels(full));
              onDraft(await draftFromCanvas(full, "Camera", all.length ? all : undefined));
              return;
            }
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch (err) {
        console.error(err);
        setError("The camera isn't available. Allow camera access for this site in Settings, or import a screenshot instead.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDraft]);

  return (
    <div className="scanner">
      <video ref={video} playsInline muted />
      <div className="viewfinder" />
      <div className="scanner-hint">{error ?? "Point at a QR code"}</div>
      <button className="round-btn scanner-close" onClick={onClose} aria-label="Close camera">
        <Close />
      </button>
    </div>
  );
}
