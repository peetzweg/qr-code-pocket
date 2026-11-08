import { useEffect, useState } from "react";
import { writeBarcode } from "zxing-wasm/full";
import "../scan/zxing"; // points zxing at the bundled wasm
import { codeSvg, isLinear, isStacked } from "../scan/zxing";
import type { Code } from "../store/db";
import { colours, useTheme } from "../theme";
import { matrixFrom, qrArt, type Matrix, type QrStyle } from "./qrart";

const matrices = new Map<string, Promise<Matrix | undefined>>();

/** The code re-encoded at error correction H (the room the styling needs). Same payload, byte for byte. */
export function qrMatrix(code: { text: string; bytes?: ArrayBuffer }): Promise<Matrix | undefined> {
  let m = matrices.get(code.text);
  if (!m) {
    const input = code.bytes ? new Uint8Array(code.bytes) : code.text;
    m = (async () => {
      for (const ec of ["H", "Q", "M", "L"]) {
        const r = await writeBarcode(input, { format: "QRCode", options: `ecLevel=${ec}`, withQuietZones: false });
        if (!r.error && r.symbol) return matrixFrom(r.symbol);
      }
    })().catch(() => undefined);
    matrices.set(code.text, m);
  }
  return m;
}

export const isQr = (format: string) => format === "QRCode" || format === "MicroQRCode";
export const codeShape = (format: string) => (isQr(format) ? "square" : isLinear(format) || isStacked(format) ? "wide" : "square");

const urls = new Map<string, Promise<string | undefined>>();

/** The code drawn in its style and colour as an SVG string (shared by the app and the share image). */
export async function codeSvgArt(code: Pick<Code, "text" | "format" | "bytes">, style: QrStyle, ink: string): Promise<string | undefined> {
  let svg: string | undefined;
  if (isQr(code.format)) {
    const m = await qrMatrix(code);
    if (m) svg = qrArt(m, style, { ink, quiet: 1, bytes: code.bytes ? new Uint8Array(code.bytes) : new TextEncoder().encode(code.text) });
  }
  if (!svg) svg = (await codeSvg(code.format, code.text, code.bytes).catch(() => undefined))?.replace(/fill="#000000"/g, `fill="${ink}"`).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}

/** An object URL of the code drawn in its style and ink; crisp at any size, cached per variant. */
function codeUrl(code: Pick<Code, "text" | "format" | "bytes">, style: QrStyle, ink: string): Promise<string | undefined> {
  const key = `${style}|${ink}|${code.format}|${code.text}`;
  let u = urls.get(key);
  if (!u) {
    u = codeSvgArt(code, style, ink).then((svg) => svg && URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
    urls.set(key, u);
  }
  return u;
}

export function useCodeUrl(code: Pick<Code, "text" | "format" | "bytes"> | undefined, style?: QrStyle) {
  const ink = useTheme((t) => colours(t).codeFg);
  const wallet = useTheme((t) => t.qrStyle);
  const s = style ?? wallet;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!code) return setUrl(undefined);
    let live = true;
    codeUrl(code, s, ink).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [code?.text, code?.format, s, ink]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

/** The code as an image. `vt` names it for view transitions, so it can grow from a card into a full page. */
export function QrImage({ code, style, vt, className = "" }: { code: Pick<Code, "text" | "format" | "bytes">; style?: QrStyle; vt?: string; className?: string }) {
  const url = useCodeUrl(code, style);
  return (
    <div className={`qr ${codeShape(code.format)} ${className}`} style={vt ? { viewTransitionName: vt } : undefined}>
      {url && <img src={url} alt="" draggable={false} />}
    </div>
  );
}
