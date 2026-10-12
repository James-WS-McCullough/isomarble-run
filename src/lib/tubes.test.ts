import { describe, expect, it } from "vitest";
import { isUpsideDown, orientations } from "./pieces";
import { decodePieces } from "./saves";
import { motionAs, Simulation, type SimulationEvent } from "./simulation";
import { painted, run } from "./testing";
import { createPiece, TrackIndex } from "./track";

describe("tubes and fans", () => {
  it("drops a marble down a tube onto the track below", () => {
    const pieces = [
      createPiece("straight", 0, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 2 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: 0, y: 0, z: 4 });

    let inTube = false;
    const events: SimulationEvent[] = [];
    for (let i = 0; i < 120; i++) {
      events.push(...sim.advance(1 / 60));
      inTube ||= motionAs(marble, "tube") !== null;
    }
    expect(inTube).toBe(true);
    expect(painted(events, pieces)).toContain("straight@0,0,0");
  });

  it("blows a marble up from a fan's intake and out of an outlet", () => {
    const pieces = [
      createPiece("straight", 0, { x: -2, y: 0, z: 0 }),
      createPiece("straight", 0, { x: -1, y: 0, z: 0 }),
      // Intake facing -x, towards the track
      createPiece("fan", 2, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 2 }),
      createPiece("outlet", 0, { x: 0, y: 0, z: 3 }),
      createPiece("straight", 0, { x: 1, y: 0, z: 3 }),
      createPiece("straight", 0, { x: 2, y: 0, z: 3 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: -2, y: 0, z: 1.2 });

    let highest = 0;
    const events: SimulationEvent[] = [];
    for (let i = 0; i < 240; i++) {
      events.push(...sim.advance(1 / 60));
      highest = Math.max(highest, marble.position.z);
    }
    const route = painted(events, pieces);
    expect(route.slice(0, 5)).toEqual([
      "straight@-2,0,0",
      "straight@-1,0,0",
      "fan@0,0,0",
      "outlet@0,0,3",
      "straight@1,0,3",
    ]);
    expect(highest).toBeGreaterThan(3.4);
  });

  it("drops a marble rolling into an outlet's spout down the tube", () => {
    const pieces = [
      createPiece("straight", 0, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("outlet", 0, { x: 0, y: 0, z: 2 }),
      createPiece("straight", 0, { x: 1, y: 0, z: 2 }),
      createPiece("straight", 0, { x: 2, y: 0, z: 2 }),
    ];
    // Always pick the last option, so the marble heads -x into the spout
    const sim = new Simulation(() => 0.999);
    sim.setPieces(pieces);
    sim.addMarble({ x: 2, y: 0, z: 3.2 });

    const route = painted(run(sim, 3), pieces);
    expect(route.slice(0, 4)).toEqual([
      "straight@2,0,2",
      "straight@1,0,2",
      "outlet@0,0,2",
      "straight@0,0,0",
    ]);
  });

  it("keeps marbles bobbing in a blown tube with no outlet", () => {
    const pieces = [
      createPiece("fan", 0, { x: 0, y: 0, z: 0 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 1 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 2 }),
    ];
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    const marble = sim.addMarble({ x: 0, y: 0, z: 4 });
    run(sim, 6);
    expect(sim.marbles).toContain(marble);
    expect(marble.position.z).toBeGreaterThan(0.5);
    expect(marble.position.z).toBeLessThan(5);
  });
});

describe("upside-down outlets", () => {
  // Turns 4-7 are the four directions upside down; turned 4, its spout
  // points +x at the bottom, level with the track a level down
  const column = () => [
    createPiece("funnel", 0, { x: 0, y: 0, z: 3 }),
    createPiece("tube", 0, { x: 0, y: 0, z: 2 }),
    createPiece("outlet", 4, { x: 0, y: 0, z: 1 }),
    createPiece("straight", 0, { x: 1, y: 0, z: 0 }),
    createPiece("straight", 0, { x: 2, y: 0, z: 0 }),
  ];

  it("lets a marble dropping down the pipe out onto the track below", () => {
    const pieces = column();
    const sim = new Simulation(() => 0);
    sim.setPieces(pieces);
    sim.addMarble({ x: 0, y: 0, z: 4.2 });
    const route = painted(run(sim, 3), pieces);
    expect(route.slice(0, 2)).toEqual(["outlet@0,0,1", "straight@1,0,0"]);
  });

  it("joins the track a level down", () => {
    const pieces = column();
    const track = new TrackIndex(pieces);
    expect(track.findConnection(pieces[2], "+x")).toBe(pieces[3]);
    expect(track.findConnection(pieces[3], "-x")).toBe(pieces[2]);
  });

  it("caps the bottom of its column, so no fan blows up it", () => {
    const fan = createPiece("fan", 0, { x: 0, y: 0, z: 0 });
    const track = new TrackIndex([
      fan,
      createPiece("outlet", 4, { x: 0, y: 0, z: 1 }),
      createPiece("tube", 0, { x: 0, y: 0, z: 2 }),
    ]);
    const tubes = track.tubeColumn({ x: 0, y: 0, z: 2 });
    expect(tubes).toMatchObject({ cappedBottom: true, cappedTop: false });
    expect(tubes?.fan).toBeUndefined();
  });

  it("turns eight ways, and keeps its turn when saved", () => {
    expect(orientations("outlet")).toBe(8);
    expect(orientations("funnel")).toBe(2);
    expect(isUpsideDown({ kind: "outlet", rotation: 5 })).toBe(true);
    expect(isUpsideDown({ kind: "outlet", rotation: 3 })).toBe(false);
    const [saved] = decodePieces([["outlet", 5, 0, 0, 0]]);
    expect(saved.rotation).toBe(5);
  });
});
