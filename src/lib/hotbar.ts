import { getPiece, PIECES, type PieceKind } from "./pieces";

/**
 * The hotbar: nine numbered slots holding what you build with, picked with
 * the number keys. Anything can be swapped in from the inventory.
 */

/** Something you can hold: a piece to build with, a marble, or a tool */
export type HotbarItem = PieceKind | "marble" | "move" | "erase";

export const HOTBAR_SIZE = 9;

/** What's in the hotbar to start with */
export const DEFAULT_SLOTS: (HotbarItem | null)[] = [
  "marble",
  "straight",
  "curve",
  "tee",
  "catcher",
  "block",
  "tube",
  "fan",
  "move",
];

const TOOLS: Record<
  "marble" | "move" | "erase",
  { label: string; hint: string }
> = {
  marble: { label: "Marble", hint: "Click anywhere to drop a marble" },
  move: {
    label: "Move",
    hint: "Drag a piece to move it · R turns the piece under the pointer",
  },
  erase: { label: "Erase", hint: "Click a piece to remove it" },
};

/** Everything in the inventory: the marble and tools, then every piece */
export const ALL_ITEMS: HotbarItem[] = [
  "marble",
  "move",
  "erase",
  ...PIECES.map((piece) => piece.kind),
];

export function isPiece(item: HotbarItem): item is PieceKind {
  return !(item in TOOLS);
}

export function itemLabel(item: HotbarItem): string {
  return isPiece(item) ? getPiece(item).label : TOOLS[item].label;
}

/** A short reminder of how to use what you're holding */
export function itemHint(item: HotbarItem): string {
  return isPiece(item)
    ? "Click to place · R turns it · [ and ] slide it further or closer"
    : TOOLS[item].hint;
}

export interface HotbarState {
  slots: (HotbarItem | null)[];
  /** Index of the slot in hand */
  selected: number;
}

export const DEFAULT_HOTBAR: HotbarState = {
  slots: DEFAULT_SLOTS,
  selected: 1,
};

const KNOWN = new Set<string>(ALL_ITEMS);

/** A hotbar read back from storage, falling back on anything unexpected */
export function parseHotbar(stored: unknown): HotbarState {
  if (!stored || typeof stored !== "object") return DEFAULT_HOTBAR;
  const { slots, selected } = stored as Partial<HotbarState>;
  if (!Array.isArray(slots) || slots.length !== HOTBAR_SIZE) {
    return DEFAULT_HOTBAR;
  }
  return {
    slots: slots.map((slot) =>
      typeof slot === "string" && KNOWN.has(slot) ? (slot as HotbarItem) : null,
    ),
    selected:
      Number.isInteger(selected) &&
      (selected as number) >= 0 &&
      (selected as number) < HOTBAR_SIZE
        ? (selected as number)
        : DEFAULT_HOTBAR.selected,
  };
}

/** Put an item in a slot */
export function withItem(
  state: HotbarState,
  slot: number,
  item: HotbarItem | null,
): HotbarState {
  const slots = [...state.slots];
  slots[slot] = item;
  return { ...state, slots };
}
