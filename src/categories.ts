export type Category = "train" | "transit" | "flight" | "sight" | "food" | "event" | "stay" | "card" | "other";

export interface CategoryInfo {
  id: Category;
  label: string;
  /** A single kanji, drawn large and faint in the card's corner. */
  kanji: string;
  /** Card gradient, top-left to bottom-right. */
  from: string;
  to: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "train", label: "Train", kanji: "鉄", from: "#1d6af2", to: "#0b2c7a" },
  { id: "sight", label: "Sight", kanji: "観", from: "#8a4dff", to: "#3a168f" },
  { id: "food", label: "Food", kanji: "食", from: "#ff7a3d", to: "#c22a1c" },
  { id: "event", label: "Event", kanji: "祭", from: "#ff4f9a", to: "#8c1658" },
  { id: "transit", label: "Transit", kanji: "道", from: "#13b5c9", to: "#05566e" },
  { id: "flight", label: "Flight", kanji: "空", from: "#5c74a8", to: "#1a2442" },
  { id: "stay", label: "Stay", kanji: "宿", from: "#1fb386", to: "#0a5c45" },
  { id: "card", label: "Card", kanji: "会", from: "#c9a227", to: "#6b5410" },
  { id: "other", label: "Other", kanji: "札", from: "#5d6270", to: "#25282f" },
];

export const categoryInfo = (id: Category) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** Loyalty and membership cards: no date, never used up; they live in their own tab. */
export const isCard = (id: Category) => id === "card";

/** Categories that read like a journey: they get the from → to line and a seat. */
export const isJourney = (id: Category) => id === "train" || id === "transit" || id === "flight";
