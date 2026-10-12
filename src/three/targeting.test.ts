import { describe, expect, it } from "vitest";
import { nearestCell, neighbourFacing } from "./targeting";

describe("pointer targeting", () => {
  const cell = { x: 2, y: 3, z: 1 };

  it("places on top when pointing anywhere on the top face", () => {
    expect(neighbourFacing(cell, { x: 2.3, y: 2.8, z: 1.4 })).toEqual({
      x: 2,
      y: 3,
      z: 2,
    });
  });

  it("places beside the side face it points at", () => {
    expect(neighbourFacing(cell, { x: 2.5, y: 3.1, z: 1 })).toEqual({
      x: 3,
      y: 3,
      z: 1,
    });
    expect(neighbourFacing(cell, { x: 2.1, y: 2.5, z: 1 })).toEqual({
      x: 2,
      y: 2,
      z: 1,
    });
  });

  it("places underneath when pointing at the bottom face", () => {
    expect(neighbourFacing(cell, { x: 2, y: 3, z: 0.5 })).toEqual({
      x: 2,
      y: 3,
      z: 0,
    });
  });

  it("picks the tile of a long piece nearest the pointer", () => {
    const tiles = [
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    expect(nearestCell(tiles, { x: 0.8, y: 0.1, z: 0.5 })).toEqual(tiles[2]);
  });
});
