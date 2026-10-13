import { describe, expect, it } from "vitest";
import { motionAs, Simulation, type SimulationEvent } from "./simulation";
import { visited } from "./testing";
import { createPiece, TrackIndex } from "./track";

describe("vortex", () => {
  const layout = () => [
    createPiece("vortex", 0, { x: 0, y: 0, z: 1 }),
    // Under the hole
    createPiece("straight", 0, { x: 0, y: 0, z: 0 }),
  ];

  it("takes up 3 by 3 tiles", () => {
    const [vortex] = layout();
    const track = new TrackIndex([vortex]);
    expect(track.pieceAt({ x: 1, y: -1, z: 1 })).toBe(vortex);
    expect(track.pieceAt({ x: -1, y: 1, z: 1 })).toBe(vortex);
    expect(track.pieceAt({ x: 2, y: 0, z: 1 })).toBeUndefined();
  });

  it("spirals a marble round and in, then drops it through the hole", () => {
    const pieces = layout();
    const sim = new Simulation(() => 0.5);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: 1, y: 0.4, z: 2.4 });

    let turned = 0;
    let lastAngle: number | null = null;
    let closest = Number.POSITIVE_INFINITY;
    const events: SimulationEvent[] = [];
    for (let t = 0; t < 20; t += 1 / 60) {
      events.push(...sim.advance(1 / 60));
      const swirl = motionAs(marble, "swirling");
      if (swirl) {
        if (lastAngle !== null) turned += Math.abs(swirl.angle - lastAngle);
        lastAngle = swirl.angle;
        closest = Math.min(closest, swirl.r);
      }
    }
    expect(turned).toBeGreaterThan(4 * Math.PI);
    expect(visited(events, pieces).slice(0, 2)).toEqual([
      "vortex@0,0,1",
      "straight@0,0,0",
    ]);
  });

  it("has marbles knock into each other as they go round", () => {
    const sim = new Simulation(() => 0.5);
    sim.setPieces(layout());
    for (const [x, y] of [
      [1, 0.4],
      [-1, -0.4],
      [0.4, -1],
      [-0.4, 1],
      [1, 1],
    ]) {
      sim.addMarble({ x, y, z: 2.4 });
    }
    const events: SimulationEvent[] = [];
    for (let t = 0; t < 10; t += 1 / 60) events.push(...sim.advance(1 / 60));
    expect(events.some((event) => event.type === "hit")).toBe(true);
  });
});
