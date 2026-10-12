import { describe, expect, it } from "vitest";
import { createBlock } from "./block-types";
import { moveBlocks, toggleBlockAt } from "./editing";
import { GRID_MIN } from "./isometric";
import type { MarbleState } from "./marble-state-machine";
import { stepWorld } from "./world";

function rollingMarble(overrides: Partial<MarbleState> = {}): MarbleState {
  return {
    id: "m",
    gridPosition: { x: 0, y: 0 },
    state: "rolling",
    momentum: "+x",
    hue: 0,
    ...overrides,
  };
}

describe("stepWorld", () => {
  it("paints a block with the colour of the marble rolling off it, including hue 0", () => {
    const blocks = [createBlock("StraightX", { x: 0, y: 0 })];
    const next = stepWorld({ blocks, marbles: [rollingMarble({ hue: 0 })] });
    expect(next.blocks[0].hue).toBe(0);
  });

  it("removes marbles that roll off the side of the grid", () => {
    const blocks = [createBlock("StraightX", { x: GRID_MIN, y: 0 })];
    const marble = rollingMarble({
      gridPosition: { x: GRID_MIN, y: 0 },
      momentum: "-x",
    });
    expect(stepWorld({ blocks, marbles: [marble] }).marbles).toHaveLength(0);
  });

  it("returns the same world when there are no marbles", () => {
    const world = { blocks: [], marbles: [] };
    expect(stepWorld(world)).toBe(world);
  });
});

describe("editing", () => {
  it("toggles a block on and off", () => {
    const placed = toggleBlockAt([], { x: 1, y: 2 }, "CrissCross");
    expect(placed).toHaveLength(1);
    expect(toggleBlockAt(placed, { x: 1, y: 2 }, "CrissCross")).toHaveLength(0);
  });

  it("won't move a block onto another block", () => {
    const a = createBlock("StraightX", { x: 0, y: 0 });
    const b = createBlock("StraightX", { x: 1, y: 0 });
    const origins = new Map([[a.id, a.position]]);
    const blocks = [a, b];
    expect(moveBlocks(blocks, origins, { x: 1, y: 0 })).toBe(blocks);
    expect(moveBlocks(blocks, origins, { x: 0, y: 1 })[0].position).toEqual({
      x: 0,
      y: 1,
    });
  });
});
