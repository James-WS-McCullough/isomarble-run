import { describe, expect, it } from "vitest";
import { fitsAt } from "./placement";
import { motionAs, Simulation } from "./simulation";
import { createPiece, TrackIndex } from "./track";

function settle(sim: Simulation, seconds = 1) {
  for (let t = 0; t < seconds; t += 1 / 60) sim.advance(1 / 60);
}

describe("cup seesaw", () => {
  // The beam runs along x; it starts with its +x cup down
  const seesaw = () => createPiece("seesaw", 0, { x: 0, y: 0, z: 0 });

  it("holds a marble that lands in its low cup", () => {
    const sim = new Simulation(() => 0.5);
    const piece = seesaw();
    sim.setPieces([piece]);
    const marble = sim.addMarble({ x: 1, y: 0, z: 1.5 });
    settle(sim);
    expect(motionAs(marble, "held")?.side).toBe(1);
    expect(sim.marbles).toContain(marble);
  });

  it("flings the waiting marble when another lands in the high cup", () => {
    const sim = new Simulation(() => 0.5);
    const piece = seesaw();
    sim.setPieces([piece]);
    const waiting = sim.addMarble({ x: 1, y: 0, z: 1.5 });
    settle(sim);
    const tilt = sim.seesawTilt(piece.id);

    const trigger = sim.addMarble({ x: -1, y: 0, z: 1.5 });
    let highest = waiting.position.z;
    for (let i = 0; i < 60; i++) {
      sim.advance(1 / 60);
      highest = Math.max(highest, waiting.position.z);
    }
    expect(motionAs(trigger, "held")?.side).toBe(-1);
    expect(motionAs(waiting, "held")).toBeNull();
    expect(highest).toBeGreaterThan(1.2);
    // It tipped the other way
    expect(Math.sign(sim.seesawTilt(piece.id))).toBe(-Math.sign(tilt));
  });

  it("bounces a marble off a cup that's already full", () => {
    const sim = new Simulation(() => 0.5);
    const piece = seesaw();
    sim.setPieces([piece]);
    const first = sim.addMarble({ x: 1, y: 0, z: 1.5 });
    settle(sim);
    const second = sim.addMarble({ x: 1.05, y: 0, z: 2.5 });
    settle(sim, 0.6);
    expect(motionAs(first, "held")?.side).toBe(1);
    expect(motionAs(second, "held")).toBeNull();
  });

  it("rolls off a track into the cup at the end", () => {
    const sim = new Simulation(() => 0.5);
    const piece = seesaw();
    // A straight along x, right beside the +x cup's tile. With this random
    // source the marble sets off along it towards the seesaw.
    const track = createPiece("straight", 0, { x: 2, y: 0, z: 0 });
    sim.setPieces([piece, track]);
    const marble = sim.addMarble({ x: 2, y: 0, z: 1.5 });
    settle(sim, 3);
    expect(motionAs(marble, "held")?.piece).toBe(piece);
  });

  it("takes up three tiles along its beam", () => {
    const piece = createPiece("seesaw", 1, { x: 0, y: 0, z: 0 });
    const index = new TrackIndex([piece]);
    expect(index.pieceAt({ x: 0, y: 1, z: 0 })).toBe(piece);
    expect(index.pieceAt({ x: 0, y: -1, z: 0 })).toBe(piece);
    expect(index.pieceAt({ x: 1, y: 0, z: 0 })).toBeUndefined();

    expect(fitsAt([piece], "straight", 0, { x: 0, y: 1, z: 0 })).toBe(false);
    expect(fitsAt([piece], "straight", 0, { x: 1, y: 1, z: 0 })).toBe(true);
    // Another seesaw can't overlap its ends either
    expect(fitsAt([piece], "seesaw", 1, { x: 0, y: 2, z: 0 })).toBe(false);
    expect(fitsAt([piece], "seesaw", 1, { x: 0, y: 3, z: 0 })).toBe(true);
  });
});
