import {
  AirplaneTilt, ArrowUUpLeft, Bank, Bed, Bus, Cardholder, Camera as PCamera, ClipboardText, DownloadSimple, ForkKnife, Images, Keyboard as PKeyboard,
  MaskHappy, QrCode, Sun, TrainSimple, UploadSimple, WifiHigh, X,
  type Icon,
} from "@phosphor-icons/react";
import type { Category } from "../categories";

/** Phosphor, light weight: thin strokes that sit with the print look. */
const w = "light" as const;
type P = { size?: number };
const make = (I: Icon, def = 22) => ({ size = def }: P) => <I size={size} weight={w} aria-hidden />;

export const Close = make(X, 20);
export const Photos = make(Images, 24);
export const Camera = make(PCamera, 24);
export const Clipboard = make(ClipboardText, 24);
export const Keyboard = make(PKeyboard, 24);
export const Download = make(DownloadSimple, 18);
export const Upload = make(UploadSimple, 18);
export const Undo = make(ArrowUUpLeft, 18);
export const Bright = make(Sun, 22);

const BY_CATEGORY: Record<Category, Icon> = {
  train: TrainSimple,
  transit: Bus,
  flight: AirplaneTilt,
  sight: Bank,
  food: ForkKnife,
  event: MaskHappy,
  stay: Bed,
  card: Cardholder,
  wifi: WifiHigh,
  other: QrCode,
};

export const CategoryIcon = ({ id, size = 18 }: { id: Category; size?: number }) => {
  const I = BY_CATEGORY[id] ?? QrCode;
  return <I size={size} weight={w} aria-hidden />;
};
