import { useEffect, useState } from "react";
import { imageUrl, type Code } from "../store/db";
import { codeSvg, isLinear, isStacked } from "../scan/zxing";

export function useImageUrl(id?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    if (id) imageUrl(id).then((u) => live && setUrl(u));
    else setUrl(undefined);
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

/**
 * The code itself, redrawn from its payload in black on white for the gate scanner. "Original" shows
 * it cut out of the screenshot instead, in case a reader is picky about a redrawn one.
 */
export function CodeView({ code, original = false }: { code: Code; original?: boolean }) {
  const [svg, setSvg] = useState<string>();
  const [failed, setFailed] = useState(false);
  const crop = useImageUrl(code.cropId);
  useEffect(() => {
    let live = true;
    setFailed(false);
    codeSvg(code.format, code.text, code.bytes)
      .then((s) => live && setSvg(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [code]);
  const shape = isLinear(code.format) ? "linear" : isStacked(code.format) ? "stacked" : "matrix";
  if ((original || failed) && crop) return <img className={`code-img ${shape} original`} src={crop} alt="The code from the original image" />;
  if (!svg) return <div className={`code-img ${shape} placeholder`} />;
  return <div className={`code-img ${shape}`} role="img" aria-label={`${code.format} code`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
