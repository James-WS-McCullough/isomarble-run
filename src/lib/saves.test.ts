import { describe, expect, it } from "vitest";
import { exampleTrack } from "./example";
import { decodePieces, encodePieces } from "./saves";

describe("saved runs", () => {
  it("round-trips a track", () => {
    const track = exampleTrack();
    const restored = decodePieces(
      JSON.parse(JSON.stringify(encodePieces(track))),
    );
    expect(
      restored.map(({ kind, rotation, cell }) => [kind, rotation, cell]),
    ).toEqual(track.map(({ kind, rotation, cell }) => [kind, rotation, cell]));
  });

  it("skips anything that isn't a valid piece", () => {
    const restored = decodePieces([
      ["straight", 1, 0, 0, 0],
      ["rocket", 0, 0, 0, 0],
      ["curve", 0, 0.5, 0, 0],
      "nonsense",
      ["catcher", 7, 1, 2, 3],
    ]);
    expect(restored.map((piece) => piece.kind)).toEqual([
      "straight",
      "catcher",
    ]);
    expect(restored[1].rotation).toBe(3);
    expect(decodePieces(null)).toEqual([]);
  });
});
