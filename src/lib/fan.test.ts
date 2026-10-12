import { describe, expect, it } from "vitest";
import type { PieceKind } from "./pieces";
import { motionAs, Simulation, type SimulationEvent } from "./simulation";
import type { Cell } from "./space";
import { visited } from "./testing";
import { createPiece } from "./track";

describe("fans", () => {
  it("is kicked up into the air by a fan it rolls onto", () => {
    const pieces = [
      createPiece("straight", 0, { x: -1, y: 0, z: 0 }),
      createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
    ];
    // With this random source it sets off along the track towards the fan
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: -1, y: 0, z: 1.5 });

    let highest = Number.NEGATIVE_INFINITY;
    let passedFan = false;
    for (let i = 0; i < 120; i++) {
      sim.advance(1 / 60);
      if (marble.position.x > 0) {
        passedFan = true;
        highest = Math.max(highest, marble.position.z);
      }
    }
    expect(passedFan).toBe(true);
    // About two tiles up from the top of the fan
    expect(highest).toBeGreaterThan(2.4);
  });

  const catchers = [
    { name: "an upside-down funnel stacked on it", up: 0, kind: "funnel" },
    { name: "an upside-down funnel a block above", up: 1, kind: "funnel" },
    { name: "a tube two blocks above", up: 2, kind: "tube" },
  ] as const;
  for (const { name, up, kind } of catchers) {
    it(`sucks a marble kicked up by a fan into ${name}`, () => {
      const pieces = [
        createPiece("straight", 0, { x: -1, y: 0, z: 0 }),
        createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
        // A funnel turned once is upside down
        createPiece(kind, 1, { x: 0, y: 0, z: 1 + up }),
        createPiece("tube", 0, { x: 0, y: 0, z: 2 + up }),
        createPiece("outlet", 0, { x: 0, y: 0, z: 3 + up }),
        createPiece("straight", 0, { x: 1, y: 0, z: 3 + up }),
        createPiece("straight", 0, { x: 2, y: 0, z: 3 + up }),
      ];
      const sim = new Simulation(() => 0);
      sim.setPieces(pieces);
      const marble = sim.addMarble({ x: -1, y: 0, z: 1.5 });

      let inTube = false;
      const events: SimulationEvent[] = [];
      for (let i = 0; i < 240; i++) {
        events.push(...sim.advance(1 / 60));
        inTube ||= motionAs(marble, "tube") !== null;
      }
      expect(inTube).toBe(true);
      expect(visited(events, pieces)).toContain(`straight@1,0,${3 + up}`);
    });
  }

  // A fan at the end of a track, and two tiles up and one along a corner
  // that turns off along another track: the jump always lands in the corner
  // and carries on round it, whichever way the layout faces
  for (let turn = 0; turn < 4; turn++) {
    it(`hops a marble up onto a corner two tiles up (turned ${turn})`, () => {
      const at = (x: number, y: number, z: number) => {
        let cell = { x, y, z };
        for (let i = 0; i < turn; i++) cell = { x: -cell.y, y: cell.x, z };
        return cell;
      };
      const piece = (kind: PieceKind, rotation: number, cell: Cell) =>
        createPiece(kind, (rotation + turn) % 4, cell);
      const pieces = [
        piece("catcher", 0, at(-2, 0, 0)),
        piece("straight", 0, at(-1, 0, 0)),
        piece("fan", 0, at(0, 0, 0)),
        piece("block", 0, at(1, 0, 0)),
        piece("block", 0, at(1, 0, 1)),
        piece("curve", 2, at(1, 0, 2)),
        // Just one tile on, so turned layouts don't overlap on screen
        piece("straight", 1, at(1, -1, 2)),
      ];
      const after = pieces[6];
      for (const random of [0, 0.5, 0.99]) {
        for (const drop of [0.6, 3]) {
          const sim = new Simulation(() => random);
          sim.setPieces(pieces);
          const start = at(-2, 0, 0);
          sim.addMarble({ ...start, z: drop + 0.5 });
          const events: SimulationEvent[] = [];
          for (let i = 0; i < 180; i++) events.push(...sim.advance(1 / 60));
          expect(
            events.some((e) => e.type === "visit" && e.pieceId === after.id),
          ).toBe(true);
        }
      }
    });
  }
});
