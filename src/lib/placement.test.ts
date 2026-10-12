import { describe, expect, it } from "vitest";
import { exampleTrack } from "./example";
import { countJoins, slideCell, snapToJoins } from "./placement";
import { Simulation } from "./simulation";
import { createPiece, TrackIndex } from "./track";

describe("snapToJoins", () => {
  it("lifts a piece pointed at on the floor up to join a raised track", () => {
    const raised = createPiece("straight", 0, { x: 0, y: 0, z: 2 });
    // The floor cell that looks like it's right after the raised track
    const floorCell = slideCell({ x: 1, y: 0, z: 2 }, -2);
    expect(floorCell.z).toBe(0);

    const cell = snapToJoins([raised], "straight", 0, floorCell);
    expect(cell).toEqual({ x: 1, y: 0, z: 2 });
  });

  it("joins two tracks that are at different depths", () => {
    const start = createPiece("straight", 0, { x: 0, y: 0, z: 0 });
    // Looks like it's two cells along, but is really closer and higher
    const end = createPiece("straight", 0, { x: 4, y: 2, z: 2 });

    // Pointing at a cell that looks right but is too far away to join start
    const cell = snapToJoins(
      [start, end],
      "straight",
      0,
      slideCell({ x: 1, y: 0, z: 0 }, -1),
    );
    const track = new TrackIndex([start, end]);
    expect(countJoins(track, "straight", 0, cell)).toBe(2);
  });

  it("stays where it was pointed when nothing would join", () => {
    const cell = { x: 3, y: 4, z: 0 };
    expect(snapToJoins([], "curve", 1, cell)).toEqual(cell);
  });

  it("can go below the floor when that's where the join is", () => {
    const low = createPiece("straight", 0, { x: 0, y: 0, z: 0 });
    // Heading -x (up the screen) the next piece has to be further away
    const cell = snapToJoins(
      [low],
      "straight",
      0,
      slideCell({ x: -1, y: 0, z: 0 }, 1),
    );
    expect(cell.z).toBeLessThanOrEqual(0);
    expect(countJoins(new TrackIndex([low]), "straight", 0, cell)).toBe(1);
  });

  it("rebuilds a hidden climb in the Waterfall from wherever it's pointed at", () => {
    const track = exampleTrack();
    // The straight that climbs from the catcher up to the next corner
    const climb = track.find(
      (p) => p.kind === "straight" && p.cell.x === 5 && p.cell.y === 3,
    );
    if (!climb) throw new Error("Example track changed");
    const rest = track.filter((p) => p !== climb);

    for (const steps of [-3, -1, 0, 2]) {
      const cell = snapToJoins(
        rest,
        climb.kind,
        climb.rotation,
        slideCell(climb.cell, steps),
      );
      const rebuilt = [...rest, createPiece(climb.kind, climb.rotation, cell)];
      expect(
        countJoins(new TrackIndex(rest), climb.kind, climb.rotation, cell),
      ).toBe(2);

      // Marbles still go all the way round
      const sim = new Simulation(() => 0.3);
      sim.setPieces(rebuilt);
      const top = rebuilt[0];
      sim.addMarble({ ...top.cell, z: top.cell.z + 1.2 });
      let landings = 0;
      for (let i = 0; i < 60 * 12; i++) {
        for (const e of sim.advance(1 / 60)) if (e.type === "land") landings++;
      }
      expect(landings).toBeGreaterThanOrEqual(2);
    }
  });
});
