import { describe, expect, it } from "vitest";
import { portalLinks } from "./portals";
import { Simulation } from "./simulation";
import { run, visited } from "./testing";
import { createPiece } from "./track";

describe("portals", () => {
  it("pairs portals in the order they were placed", () => {
    const portals = [0, 1, 2].map((x) =>
      createPiece("portal", 0, { x, y: 0, z: 0 }),
    );
    const links = portalLinks([
      createPiece("straight", 0, { x: 5, y: 0, z: 0 }),
      ...portals,
    ]);
    expect(links.get(portals[0].id)).toEqual({ pair: 0, twin: portals[1] });
    expect(links.get(portals[1].id)).toEqual({ pair: 0, twin: portals[0] });
    expect(links.get(portals[2].id)).toEqual({ pair: 1, twin: undefined });
  });

  it("sends a marble out of the twin, heading its way", () => {
    // In along +x; the twin is turned once, so out along +y
    const pieces = [
      createPiece("straight", 0, { x: -1, y: 0, z: 0 }),
      createPiece("portal", 0, { x: 0, y: 0, z: 0 }),
      createPiece("portal", 1, { x: 6, y: 3, z: 0 }),
      createPiece("straight", 1, { x: 6, y: 4, z: 0 }),
    ];
    // With this random source the marble sets off along +x
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    sim.addMarble({ x: -1, y: 0, z: 1.2 });
    const route = visited(run(sim, 3), pieces);
    expect(route.slice(0, 4)).toEqual([
      "straight@-1,0,0",
      "portal@0,0,0",
      "portal@6,3,0",
      "straight@6,4,0",
    ]);
  });

  it("is just a track until it has a twin", () => {
    const pieces = [
      createPiece("straight", 0, { x: -1, y: 0, z: 0 }),
      createPiece("portal", 0, { x: 0, y: 0, z: 0 }),
      createPiece("straight", 0, { x: 1, y: 0, z: 0 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    sim.addMarble({ x: -1, y: 0, z: 1.2 });
    expect(visited(run(sim, 2), pieces).slice(0, 3)).toEqual([
      "straight@-1,0,0",
      "portal@0,0,0",
      "straight@1,0,0",
    ]);
  });
});
