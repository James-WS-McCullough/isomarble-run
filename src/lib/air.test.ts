import { describe, expect, it } from "vitest";
import { airStreams } from "./air";
import { createPiece, TrackIndex } from "./track";

describe("air from fans", () => {
  it("rises two tiles from a fan in the open", () => {
    const [stream] = airStreams(
      new TrackIndex([createPiece("fan", 0, { x: 0, y: 0, z: 0 })]),
    );
    expect(stream.tubeFrom).toBeNull();
    expect(stream.to).toBeCloseTo(2.5);
  });

  it("goes all the way up a tube column across a gap", () => {
    const [stream] = airStreams(
      new TrackIndex([
        createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
        createPiece("funnel", 1, { x: 0, y: 0, z: 2 }),
        createPiece("tube", 0, { x: 0, y: 0, z: 3 }),
        createPiece("tube", 0, { x: 0, y: 0, z: 4 }),
      ]),
    );
    expect(stream.tubeFrom).toBeCloseTo(1.5);
    expect(stream.to).toBeCloseTo(4.5);
  });

  it("stops at a solid piece above the fan", () => {
    const [stream] = airStreams(
      new TrackIndex([
        createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
        createPiece("block", 0, { x: 0, y: 0, z: 2 }),
      ]),
    );
    expect(stream.to).toBeCloseTo(1.5);
  });
});
