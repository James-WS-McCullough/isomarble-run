import { describe, expect, it } from "vitest";
import { Simulation, type SimulationEvent } from "./simulation";
import { createPiece, type Piece } from "./track";

function painted(events: SimulationEvent[], pieces: Piece[]): string[] {
  const names = new Map(
    pieces.map((p) => [p.id, `${p.kind}@${p.cell.x},${p.cell.y},${p.cell.z}`]),
  );
  return events.flatMap((e) =>
    e.type === "paint" ? [names.get(e.pieceId) ?? "?"] : [],
  );
}

describe("funnels", () => {
  it("catches a marble falling near its rim and spirals it down the tube", () => {
    const pieces = [
      createPiece("straight", 0, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("funnel", 0, { x: 0, y: 0, z: 2 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    // Well off the middle of the tile, where a plain tube would miss it
    const marble = sim.addMarble({ x: 0.4, y: -0.3, z: 4 });

    let circled = 0;
    let lastAngle: number | null = null;
    const events: SimulationEvent[] = [];
    for (let i = 0; i < 180; i++) {
      events.push(...sim.advance(1 / 60));
      const { x, y } = marble.position;
      if (marble.tube && Math.hypot(x, y) > 0.02) {
        const angle = Math.atan2(y, x);
        if (lastAngle !== null) {
          circled += Math.abs(
            Math.atan2(
              Math.sin(angle - lastAngle),
              Math.cos(angle - lastAngle),
            ),
          );
        }
        lastAngle = angle;
      }
    }
    // It went round the funnel before dropping down onto the track
    expect(circled).toBeGreaterThan(Math.PI / 2);
    expect(painted(events, pieces)).toContain("straight@0,0,0");
  });

  it("feeds a fan's tube, which blows the marble out of an outlet", () => {
    const pieces = [
      createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("outlet", 0, { x: 0, y: 0, z: 2 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 3 }),
      createPiece("funnel", 0, { x: 0, y: 0, z: 4 }),
      createPiece("straight", 0, { x: 1, y: 0, z: 2 }),
      createPiece("straight", 0, { x: 2, y: 0, z: 2 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: -0.3, y: 0.2, z: 6 });

    let lowest = Number.POSITIVE_INFINITY;
    const events: SimulationEvent[] = [];
    for (let i = 0; i < 300; i++) {
      events.push(...sim.advance(1 / 60));
      if (marble.tube) lowest = Math.min(lowest, marble.position.z);
    }
    // Down past the outlet to the fan, then back up and out of the spout
    expect(lowest).toBeLessThan(1);
    expect(painted(events, pieces)).toContain("straight@1,0,2");
  });

  it("takes a marble rolling in over its rim", () => {
    const pieces = [
      createPiece("straight", 0, { x: -1, y: 0, z: 1 }),
      createPiece("funnel", 0, { x: 0, y: 0, z: 1 }),
      createPiece("block", 0, { x: 0, y: 0, z: -1 }),
    ];
    // With this random source it sets off along the track towards the funnel
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: -1, y: 0, z: 2.5 });

    let inFunnel = false;
    for (let i = 0; i < 120; i++) {
      sim.advance(1 / 60);
      inFunnel ||= marble.tube !== null;
    }
    expect(inFunnel).toBe(true);
  });
});
