import { describe, expect, it } from "vitest";
import { motionAs, Simulation } from "./simulation";
import { runUntil, sequence } from "./testing";
import { createPiece, type Piece } from "./track";

function row(xs: number[], at = (x: number) => ({ x, y: 0, z: 0 })): Piece[] {
  return xs.map((x) => createPiece("straight", 0, at(x)));
}

describe("marble collisions", () => {
  it("bounces two marbles off each other head on", () => {
    const sim = new Simulation(sequence(0, 0, 0, 0.9));
    sim.setPieces(row([-4, -3, -2, -1, 0, 1, 2, 3, 4]));
    const left = sim.addMarble({ x: -2, y: 0, z: 1.2 });
    const right = sim.addMarble({ x: 2, y: 0, z: 1.2 });

    runUntil(
      sim,
      () =>
        motionAs(left, "rolling") !== null &&
        motionAs(right, "rolling") !== null,
    );
    expect(motionAs(left, "rolling")?.exit).toBe("+x");
    expect(motionAs(right, "rolling")?.exit).toBe("-x");

    for (let i = 0; i < 90; i++) {
      sim.advance(1 / 60);
      // They never pass through each other
      expect(left.position.x).toBeLessThan(right.position.x);
    }
    expect(motionAs(left, "rolling")?.exit).toBe("-x");
    expect(motionAs(right, "rolling")?.exit).toBe("+x");
  });

  it("passes speed on when a fast marble catches a slow one", () => {
    const sim = new Simulation(sequence(0, 0, 0, 0));
    sim.setPieces(row([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]));
    const back = sim.addMarble({ x: -3, y: 0, z: 1.2 });
    const front = sim.addMarble({ x: -1, y: 0, z: 1.2 });
    runUntil(
      sim,
      () =>
        motionAs(back, "rolling") !== null &&
        motionAs(front, "rolling") !== null,
    );
    back.speed = 7;
    front.speed = 2.5;

    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) {
      for (const event of sim.advance(1 / 60)) hit ||= event.type === "hit";
    }
    expect(hit).toBe(true);
    expect(front.speed).toBeGreaterThan(back.speed);
    expect(back.position.x).toBeLessThan(front.position.x);
  });

  it("collides across a join that hides a change of depth", () => {
    // The right half is a step closer to the camera, but looks joined on
    const pieces = [
      ...row([-3, -2, -1, 0]),
      ...row([1, 2, 3], (x) => ({ x: x + 1, y: 1, z: 1 })),
    ];
    const sim = new Simulation(sequence(0, 0, 0, 0.9));
    sim.setPieces(pieces);
    const left = sim.addMarble({ x: -1, y: 0, z: 1.2 });
    const right = sim.addMarble({ x: 3, y: 1, z: 2.2 });
    runUntil(
      sim,
      () =>
        motionAs(left, "rolling") !== null &&
        motionAs(right, "rolling") !== null,
    );
    expect(motionAs(left, "rolling")?.exit).toBe("+x");
    expect(motionAs(right, "rolling")?.exit).toBe("-x");

    let hit = false;
    for (let i = 0; i < 120 && !hit; i++) {
      for (const event of sim.advance(1 / 60)) hit ||= event.type === "hit";
    }
    expect(hit).toBe(true);
  });

  it("lets marbles pass when one is only in front of the other", () => {
    // Two separate tracks that cross on screen at different depths
    const near = row([-3, -2, -1, 0, 1, 2, 3], (x) => ({
      x: x + 3,
      y: 3,
      z: 0,
    }));
    const far = [-3, -2, -1, 0, 1, 2, 3].map((y) =>
      createPiece("straight", 1, { x: 0, y, z: 0 }),
    );
    const sim = new Simulation(sequence(0, 0, 0, 0));
    sim.setPieces([...near, ...far]);
    sim.addMarble({ x: 0, y: 3, z: 1.2 });
    sim.addMarble({ x: 0, y: -3, z: 1.2 });
    const events = [];
    for (let i = 0; i < 240; i++) events.push(...sim.advance(1 / 60));
    expect(events.some((event) => event.type === "hit")).toBe(false);
  });
});
