import { describe, expect, it } from "vitest";
import { motionAs, Simulation, type SimulationEvent } from "./simulation";
import { DISPENSE_EVERY, MAX_MARBLES } from "./simulation/dispensers";
import { run, visited } from "./testing";
import { createPiece } from "./track";

const count = (events: SimulationEvent[], type: SimulationEvent["type"]) =>
  events.filter((event) => event.type === type).length;

describe("dispensers", () => {
  it("lets a marble roll out every couple of seconds", () => {
    const pieces = [
      createPiece("dispenser", 0, { x: 0, y: 0, z: 0 }),
      createPiece("straight", 0, { x: 1, y: 0, z: 0 }),
      createPiece("straight", 0, { x: 2, y: 0, z: 0 }),
    ];
    const sim = new Simulation(() => 0.5);
    sim.setPieces(pieces);
    const events = run(sim, DISPENSE_EVERY * 3);
    expect(count(events, "added")).toBe(3);
    expect(visited(events, pieces)).toContain("straight@1,0,0");
  });

  it("waits while the board is full of marbles", () => {
    const sim = new Simulation(() => 0.5);
    sim.setPieces([createPiece("dispenser", 0, { x: 0, y: 0, z: 0 })]);
    for (let i = 0; i < MAX_MARBLES; i++) {
      sim.addMarble({ x: 0, y: 0, z: 50 + i });
    }
    expect(count(run(sim, 1), "added")).toBe(0);
  });
});

describe("holes", () => {
  it("swallows a marble that rolls onto it", () => {
    const pieces = [
      createPiece("dispenser", 0, { x: 0, y: 0, z: 0 }),
      createPiece("hole", 0, { x: 1, y: 0, z: 0 }),
    ];
    const sim = new Simulation(() => 0.5);
    sim.setPieces(pieces);
    const events = run(sim, 2);
    expect(count(events, "added")).toBe(1);
    expect(count(events, "removed")).toBe(1);
    expect(sim.marbles).toHaveLength(0);
  });

  it("swallows a marble dropped onto it", () => {
    const sim = new Simulation(() => 0.5);
    sim.setPieces([createPiece("hole", 0, { x: 0, y: 0, z: 0 })]);
    const marble = sim.addMarble({ x: 0, y: 0, z: 1.2 });
    let fell = false;
    for (let i = 0; i < 120 && sim.marbles.length > 0; i++) {
      sim.advance(1 / 60);
      fell ||= motionAs(marble, "vanishing") !== null;
    }
    expect(fell).toBe(true);
    expect(sim.marbles).toHaveLength(0);
  });
});
