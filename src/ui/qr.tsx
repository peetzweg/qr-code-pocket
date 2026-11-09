import { useEffect, useState } from "react";
import { writeBarcode } from "zxing-wasm/full";
import "../scan/zxing"; // points zxing at the bundled wasm
import { codeSvg, isLinear, isStacked } from "../scan/zxing";
import type { Code } from "../store/db";
import { colours, getTheme, useTheme } from "../theme";
import { HOUSE_STYLE, matrixFrom, qrArt, type Matrix, type QrStyle } from "./qrart";

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

/**
 * Barcodes (EAN, Code 128, PDF417…) are always printed dark on white: checkout laser scanners can't
 * read them inverted, so Flood's light-on-colour is for QR codes only.
 */
export const barcodeInk = (format: string, ink: string, plain: string) => (isQr(format) ? ink : plain);

export function useCodeUrl(code: Pick<Code, "text" | "format" | "bytes"> | undefined, style?: QrStyle, inkOverride?: string) {
  const themeInk = useTheme((t) => colours(t).codeFg);
  const plain = useTheme((t) => colours(t).plainInk);
  const ink = code && !isQr(code.format) ? plain : inkOverride ?? themeInk;
  const s = style ?? HOUSE_STYLE;
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

/** The code as an image, in the theme's colours unless `ink`/`bg` say otherwise ("transparent" for a lit plate). */
export function QrImage({ code, style, className = "", ink, bg }: { code: Pick<Code, "text" | "format" | "bytes">; style?: QrStyle; className?: string; ink?: string; bg?: string }) {
  const url = useCodeUrl(code, style, ink);
  return (
    <div className={`qr ${codeShape(code.format)} ${className}`} style={bg ? { background: bg } : undefined}>
      {url && <img src={url} alt="" draggable={false} />}
    </div>
  );
}

/**
 * Get a ticket's code drawn and decoded before it's needed (both the themed and the lit-plate
 * variant), so it's already there when the ticket opens instead of popping in mid-transition.
 */
export function prepareCode(code: Pick<Code, "text" | "format" | "bytes">, style?: QrStyle): Promise<void> {
  const t = getTheme();
  const c = colours(t);
  const s = style ?? HOUSE_STYLE;
  return Promise.all(
    [barcodeInk(code.format, c.codeFg, c.plainInk), c.plainInk].map((ink) =>
      codeUrl(code, s, ink).then((url) => {
        if (!url) return;
        const img = new Image();
        img.src = url;
        return img.decode().catch(() => {});
      }),
    ),
  ).then(() => {});
}
