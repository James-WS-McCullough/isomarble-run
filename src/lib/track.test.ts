import { describe, expect, it } from "vitest";
import { createPiece, FAN_REACH, TrackIndex } from "./track";

describe("tube columns", () => {
  const at = (z: number, kind: Parameters<typeof createPiece>[0] = "tube") =>
    createPiece(kind, 0, { x: 0, y: 0, z });

  it("spans every tube stacked together", () => {
    const track = new TrackIndex([at(1), at(2, "outlet"), at(3, "funnel")]);
    const column = track.tubeColumn({ x: 0, y: 0, z: 2 });
    expect(column).toMatchObject({ bottom: 1, top: 3, cappedTop: false });
    expect(track.tubeColumn({ x: 0, y: 0, z: 4 })).toBeUndefined();
  });

  it("is capped by an outlet at the top", () => {
    const track = new TrackIndex([at(1), at(2, "outlet")]);
    expect(track.tubeColumn({ x: 0, y: 0, z: 1 })?.cappedTop).toBe(true);
  });

  it("is blown by a fan right under it, or across a gap", () => {
    for (let gap = 0; gap <= FAN_REACH; gap++) {
      const fan = at(0, "fan");
      const track = new TrackIndex([fan, at(1 + gap)]);
      expect(track.tubeColumn({ x: 0, y: 0, z: 1 + gap })?.fan).toBe(fan);
      expect(track.reachedByFan(fan)?.cell.z).toBe(1 + gap);
    }
  });

  it("isn't blown by a fan too far below, or with a piece in the way", () => {
    const fan = at(0, "fan");
    const tooFar = new TrackIndex([fan, at(2 + FAN_REACH)]);
    expect(tooFar.tubeColumn({ x: 0, y: 0, z: 2 + FAN_REACH })?.fan).toBe(
      undefined,
    );
    expect(tooFar.reachedByFan(fan)).toBeUndefined();

    const blocked = new TrackIndex([fan, at(1, "block"), at(2)]);
    const column = blocked.tubeColumn({ x: 0, y: 0, z: 2 });
    expect(column?.fan).toBeUndefined();
    expect(column?.base?.kind).toBe("block");
  });
});
