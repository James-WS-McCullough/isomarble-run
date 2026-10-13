import { describe, expect, it } from "vitest";
import { Simulation } from "./simulation";
import { DISPENSE_EVERY } from "./simulation/dispensers";
import { run, visited } from "./testing";
import { createPiece } from "./track";

describe("flip-flop switches", () => {
  // A dispenser feeding the stem (+x side) of a flip-flop, with a straight
  // off each branch
  const layout = () => [
    createPiece("dispenser", 2, { x: 1, y: 0, z: 0 }),
    createPiece("flipflop", 0, { x: 0, y: 0, z: 0 }),
    createPiece("straight", 1, { x: 0, y: -1, z: 0 }),
    createPiece("straight", 1, { x: 0, y: 1, z: 0 }),
  ];

  it("sends marbles down each branch in turn", () => {
    const pieces = layout();
    const sim = new Simulation(() => 0.5);
    sim.setPieces(pieces);
    const branches = visited(run(sim, DISPENSE_EVERY * 4), pieces).filter(
      (name) => name.startsWith("straight"),
    );
    expect(branches.slice(0, 4)).toEqual([
      "straight@0,-1,0",
      "straight@0,1,0",
      "straight@0,-1,0",
      "straight@0,1,0",
    ]);
  });

  it("shows which way it's pointing, flipping as each marble passes", () => {
    const pieces = layout();
    const sim = new Simulation(() => 0.5);
    sim.setPieces(pieces);
    const flipflop = pieces[1];
    expect(sim.switchSide(flipflop.id)).toBe("-y");
    run(sim, DISPENSE_EVERY);
    expect(sim.switchSide(flipflop.id)).toBe("+y");
  });
});
