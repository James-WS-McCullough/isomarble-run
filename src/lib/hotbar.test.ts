import { describe, expect, it } from "vitest";
import {
  ALL_ITEMS,
  DEFAULT_HOTBAR,
  HOTBAR_SIZE,
  isPiece,
  itemLabel,
  parseHotbar,
  withItem,
} from "./hotbar";
import { PIECES } from "./pieces";

describe("hotbar", () => {
  it("starts with nine slots, holding a piece", () => {
    expect(DEFAULT_HOTBAR.slots).toHaveLength(HOTBAR_SIZE);
    const held = DEFAULT_HOTBAR.slots[DEFAULT_HOTBAR.selected];
    expect(held && isPiece(held)).toBe(true);
  });

  it("offers every piece, the marble and the tools in the inventory", () => {
    for (const piece of PIECES) expect(ALL_ITEMS).toContain(piece.kind);
    expect(ALL_ITEMS).toEqual(
      expect.arrayContaining(["marble", "move", "erase"]),
    );
    expect(isPiece("marble")).toBe(false);
    expect(itemLabel("tee")).toBe("Splitter");
  });

  it("puts an item in a slot without touching the others", () => {
    const next = withItem(DEFAULT_HOTBAR, 4, "seesaw");
    expect(next.slots[4]).toBe("seesaw");
    expect(next.slots[3]).toBe(DEFAULT_HOTBAR.slots[3]);
    expect(DEFAULT_HOTBAR.slots[4]).not.toBe("seesaw");
  });

  it("reads back a saved hotbar, dropping anything it doesn't know", () => {
    const slots = [...DEFAULT_HOTBAR.slots];
    slots[0] = "funnel";
    slots[2] = "rocket" as never;
    expect(parseHotbar({ slots, selected: 3 })).toEqual({
      slots: ["funnel", slots[1], null, ...slots.slice(3)],
      selected: 3,
    });
    expect(parseHotbar({ slots: ["tube"], selected: 0 })).toBe(DEFAULT_HOTBAR);
    expect(parseHotbar("nonsense")).toBe(DEFAULT_HOTBAR);
    expect(parseHotbar({ slots, selected: 42 }).selected).toBe(
      DEFAULT_HOTBAR.selected,
    );
  });
});
