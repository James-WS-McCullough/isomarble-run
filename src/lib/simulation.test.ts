import { describe, expect, it } from "vitest";
import { pieceExits } from "./pieces";
import {
  PHYSICS,
  Simulation,
  type SimulationEvent,
  type Simulation as SimulationType,
} from "./simulation";
import { screenOf } from "./space";
import { createPiece, TrackIndex } from "./track";

function run(sim: SimulationType, seconds: number): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    events.push(...sim.advance(1 / 60));
  }
  return events;
}

function paintedIds(events: SimulationEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === "paint" ? [event.pieceId] : [],
  );
}

/** A point on screen just above a piece's top face */
function above(cell: { x: number; y: number; z: number }) {
  return { x: cell.x, y: cell.y, z: cell.z + 1.2 };
}

describe("pieceExits", () => {
  it("rotates a curve's behaviour with the piece", () => {
    // A curve turned once joins +y and -x
    expect(pieceExits("curve", 1, "-y")).toEqual(["-x"]);
    expect(pieceExits("curve", 1, "+x")).toEqual(["+y"]);
  });

  it("sends everything out of a catcher's opening", () => {
    expect(pieceExits("catcher", 2, "+y")).toEqual(["-x"]);
  });
});

describe("TrackIndex.findConnection", () => {
  it("connects pieces that only line up on screen", () => {
    const upper = createPiece("straight", 0, { x: 0, y: 0, z: 1 });
    // One level down and one step back looks exactly like the next cell along
    const lower = createPiece("straight", 0, { x: 0, y: -1, z: 0 });
    const track = new TrackIndex([upper, lower]);
    expect(track.findConnection(upper, "+x")).toBe(lower);
  });

  it("prefers the piece closest to the camera", () => {
    const start = createPiece("straight", 0, { x: 0, y: 0, z: 1 });
    const behind = createPiece("straight", 0, { x: 0, y: -1, z: 0 });
    const neighbour = createPiece("straight", 0, { x: 1, y: 0, z: 1 });
    const track = new TrackIndex([start, behind, neighbour]);
    expect(track.findConnection(start, "+x")).toBe(neighbour);
  });

  it("ignores pieces with something stacked on top", () => {
    const start = createPiece("straight", 0, { x: 0, y: 0, z: 0 });
    const covered = createPiece("straight", 0, { x: 1, y: 0, z: 0 });
    const lid = createPiece("block", 0, { x: 1, y: 0, z: 1 });
    const track = new TrackIndex([start, covered, lid]);
    expect(track.findConnection(start, "+x")).toBeUndefined();
  });
});

describe("Simulation", () => {
  it("drops a marble onto the piece below it and rolls along the track", () => {
    const row = [0, 1, 2, 3].map((x) =>
      createPiece("straight", 0, { x, y: 0, z: 0 }),
    );
    const sim = new Simulation(() => 0);
    sim.setPieces(row);
    sim.addMarble(above(row[0].cell));

    const events = run(sim, 3);
    expect(events.some((event) => event.type === "land")).toBe(true);
    expect(paintedIds(events).slice(0, 4)).toEqual(row.map((p) => p.id));
  });

  it("rolls across pieces that only look connected", () => {
    const upper = createPiece("straight", 0, { x: 0, y: 0, z: 1 });
    const lower = createPiece("straight", 0, { x: 0, y: -1, z: 0 });
    const sim = new Simulation(() => 0);
    sim.setPieces([upper, lower]);
    sim.addMarble(above(upper.cell));

    const painted = paintedIds(run(sim, 1.5));
    expect(painted.slice(0, 2)).toEqual([upper.id, lower.id]);
  });

  it("drops behind a piece that is in front of it instead of landing on it", () => {
    const start = createPiece("straight", 0, { x: 0, y: 0, z: 2 });
    const floor = [-4, -3, -2, -1, 0].map((x) =>
      createPiece("straight", 0, { x, y: 0, z: 0 }),
    );
    // Lines up on screen with the floor, but sits in front of the falling marble
    const inFront = createPiece("straight", 0, { x: -1, y: 1, z: 1 });
    // Always pick the last option, so the marble heads off the back (-x)
    const sim = new Simulation(() => 0.999);
    sim.setPieces([start, ...floor, inFront]);
    sim.addMarble(above(start.cell));

    const painted = paintedIds(run(sim, 1.2));
    expect(painted[0]).toBe(start.id);
    expect(painted).not.toContain(inFront.id);
    expect(floor.map((p) => p.id)).toContain(painted[1]);
  });

  it("bounces back out of a catcher", () => {
    const straight = createPiece("straight", 0, { x: 1, y: 0, z: 0 });
    const catcher = createPiece("catcher", 0, { x: 0, y: 0, z: 0 });
    const sim = new Simulation(() => 0.999);
    sim.setPieces([straight, catcher]);
    sim.addMarble(above(straight.cell));

    const painted = paintedIds(run(sim, 2));
    expect(painted.slice(0, 3)).toEqual([straight.id, catcher.id, straight.id]);
  });

  it("caps the falling speed and wraps marbles back to the top", () => {
    const sim = new Simulation(() => 0);
    const marble = sim.addMarble({ x: 0, y: 0, z: 0 });

    let wrapped = false;
    let lastUp = screenOf(marble.position).up;
    for (let i = 0; i < 300; i++) {
      sim.advance(1 / 60);
      expect(marble.velocity.z).toBeGreaterThanOrEqual(-PHYSICS.MAX_SPEED);
      const up = screenOf(marble.position).up;
      if (up > lastUp) wrapped = true;
      lastUp = up;
    }
    expect(wrapped).toBe(true);
    expect(sim.marbles).toHaveLength(1);
  });

  it("caps the rolling speed after a long fall", () => {
    const top = createPiece("straight", 0, { x: 0, y: 0, z: 6 });
    const bottom = [2, 3, 4, 5, 6].map((x) =>
      createPiece("straight", 0, { x, y: 0, z: 0 }),
    );
    const sim = new Simulation(() => 0);
    sim.setPieces([top, ...bottom]);
    const marble = sim.addMarble(above(top.cell));
    for (let i = 0; i < 200; i++) {
      sim.advance(1 / 60);
      expect(marble.speed).toBeLessThanOrEqual(PHYSICS.MAX_SPEED);
    }
  });

  it("removes marbles that fly off the side", () => {
    const sim = new Simulation(() => 0);
    const marble = sim.addMarble({ x: 0, y: 0, z: 0 });
    marble.velocity = { x: PHYSICS.MAX_SPEED, y: -PHYSICS.MAX_SPEED, z: 0 };

    const events = run(sim, 5);
    expect(events).toContainEqual({ type: "removed", marbleId: marble.id });
    expect(sim.marbles).toHaveLength(0);
  });

  it("drops marbles off pieces that are removed", () => {
    const piece = createPiece("straight", 0, { x: 0, y: 0, z: 0 });
    const sim = new Simulation(() => 0);
    sim.setPieces([piece]);
    const marble = sim.addMarble(above(piece.cell));
    for (let i = 0; i < 120 && !marble.rolling; i++) sim.advance(1 / 60);
    expect(marble.rolling).not.toBeNull();

    sim.setPieces([]);
    expect(marble.rolling).toBeNull();
  });
});
