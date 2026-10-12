import { afterEach, describe, expect, it, vi } from "vitest";
import { type Block, createBlock } from "./block-types";
import { GRID_MAX, GRID_MIN } from "./isometric";
import {
  type MarbleState,
  stepMarble,
  wrapGridPosition,
} from "./marble-state-machine";

function marble(overrides: Partial<MarbleState> = {}): MarbleState {
  return {
    id: "m",
    gridPosition: { x: 0, y: 0 },
    state: "falling",
    momentum: "0",
    hue: 100,
    ...overrides,
  };
}

function block(blockName: string, x: number, y: number): Block {
  return createBlock(blockName, { x, y });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stepMarble", () => {
  it("falls straight down the screen when there is no block", () => {
    const next = stepMarble(marble(), []);
    expect(next.gridPosition).toEqual({ x: 1, y: 1 });
    expect(next.state).toBe("falling");
    expect(next.hue).toBe(100);
  });

  it("rolls in the direction a landing block sends it", () => {
    const next = stepMarble(marble(), [block("LandingPlusX", 0, 0)]);
    expect(next.state).toBe("rolling");
    expect(next.momentum).toBe("+x");
    expect(next.gridPosition).toEqual({ x: 1, y: 0 });
  });

  it("keeps its momentum along a straight", () => {
    const next = stepMarble(marble({ state: "rolling", momentum: "-y" }), [
      block("StraightY", 0, 0),
    ]);
    expect(next.momentum).toBe("-y");
    expect(next.gridPosition).toEqual({ x: 0, y: -1 });
  });

  it("turns on a corner", () => {
    const next = stepMarble(marble({ state: "rolling", momentum: "-x" }), [
      block("TurnXY", 0, 0),
    ]);
    expect(next.momentum).toBe("+y");
  });

  it("changes colour when it rolls off the front of the track", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = stepMarble(marble({ state: "rolling", momentum: "+x" }), []);
    expect(next.state).toBe("falling");
    expect(next.hue).toBe(130);
  });

  it("falls behind the track when it rolls off the back", () => {
    const rolling = marble({
      state: "rolling",
      momentum: "-x",
      gridPosition: { x: 2, y: 2 },
    });
    const next = stepMarble(rolling, []);
    expect(next.state).toBe("behind");
    expect(next.behindCoordinates).toEqual({ x: 2, y: 2 });
    expect(next.hue).toBe(100);
  });

  it("stays behind while hidden by a block, then comes back out", () => {
    const blocks = [block("StraightX", 0, 0)];
    const hidden = stepMarble(marble({ state: "behind" }), blocks);
    expect(hidden.state).toBe("behind");
    expect(hidden.gridPosition).toEqual({ x: 1, y: 1 });

    const visible = stepMarble(
      marble({ state: "behind", gridPosition: { x: 2, y: 2 } }),
      blocks,
    );
    expect(visible.state).toBe("falling");
    expect(visible.behindCoordinates).toBeUndefined();
  });
});

describe("wrapGridPosition", () => {
  it("leaves positions inside the grid alone", () => {
    expect(wrapGridPosition({ x: 3, y: -2 })).toEqual({
      position: { x: 3, y: -2 },
      warped: false,
    });
  });

  it("wraps to the top of the diagonal before the bottom edge", () => {
    const { position, warped } = wrapGridPosition({ x: GRID_MAX, y: 4 });
    expect(warped).toBe(true);
    expect(position.x - position.y).toBe(GRID_MAX - 4);
    expect(Math.min(position.x, position.y)).toBe(GRID_MIN);
  });

  it("flags a warp when a falling marble wraps", () => {
    const next = stepMarble(marble({ gridPosition: { x: 9, y: 9 } }), []);
    expect(next.warped).toBe(true);
    expect(next.gridPosition).toEqual({ x: GRID_MIN, y: GRID_MIN });
  });
});
