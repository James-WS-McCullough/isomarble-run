import { describe, expect, it } from "vitest";
import type { PieceKind } from "./pieces";
import { motionAs, PHYSICS, Simulation } from "./simulation";
import type { Cell } from "./space";
import { run, visited } from "./testing";
import { createPiece, TrackIndex } from "./track";

type Layout = [
  kind: PieceKind,
  rotation: number,
  x: number,
  y: number,
  z: number,
][];

/** Pieces laid out along x, turned round by `turn` quarter turns */
function build(layout: Layout, turn = 0) {
  return layout.map(([kind, rotation, x, y, z]) => {
    let cell: Cell = { x, y, z };
    for (let i = 0; i < turn; i++) cell = { x: -cell.y, y: cell.x, z };
    return createPiece(kind, (rotation + turn) % 4, cell);
  });
}

/** A marble from a dispenser on a track, once it's rolled out */
function start(layout: Layout, turn = 0) {
  const pieces = build(layout, turn);
  const sim = new Simulation(() => 0.5);
  sim.setPieces(pieces);
  const events = run(sim, 0.55);
  return { pieces, sim, events, marble: sim.marbles[0] };
}

const DOWN: Layout = [
  ["dispenser", 0, -1, 0, 1],
  ["ramp", 0, 0, 0, 1],
  ["straight", 0, 1, 0, 0],
  ["straight", 0, 2, 0, 0],
  ["straight", 0, 3, 0, 0],
  ["straight", 0, 4, 0, 0],
];

describe("ramps", () => {
  it("joins track at its top end, and a level down at its low end", () => {
    const [top, ramp, bottom] = build(DOWN);
    const track = new TrackIndex([top, ramp, bottom]);
    expect(track.findConnection(top, "+x")).toBe(ramp);
    expect(track.findConnection(ramp, "+x")).toBe(bottom);
    expect(track.findConnection(bottom, "-x")).toBe(ramp);
    expect(track.findConnection(ramp, "-x")).toBe(top);
  });

  for (let turn = 0; turn < 4; turn++) {
    it(`rolls a marble down a level (turned ${turn})`, () => {
      const { pieces, sim, events } = start(DOWN, turn);
      events.push(...run(sim, 2));
      expect(visited(events, pieces)).toEqual([
        `ramp@${build(DOWN, turn)[1].cell.x},${build(DOWN, turn)[1].cell.y},1`,
        ...pieces.slice(2).map(({ cell }) => `straight@${cell.x},${cell.y},0`),
      ]);
    });
  }

  it("speeds marbles up, and they keep most of it at the bottom", () => {
    const { sim, marble } = start(DOWN);
    expect(marble.speed).toBeCloseTo(PHYSICS.CRUISE_SPEED);
    run(sim, 0.6);
    // Off the bottom of the ramp
    expect(marble.position.x).toBeGreaterThan(0.6);
    expect(marble.speed).toBeGreaterThan(5.5);
    run(sim, 0.5);
    expect(marble.position.x).toBeGreaterThan(3);
    expect(marble.speed).toBeGreaterThan(4.5);
  });

  it("rolls back down a ramp it's too slow to get up", () => {
    const layout: Layout = [
      ["dispenser", 0, -1, 0, 0],
      ["ramp", 2, 0, 0, 1],
      ["straight", 0, 1, 0, 1],
    ];
    const { pieces, sim, events, marble } = start(layout);
    let highest = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 120; i++) {
      events.push(...sim.advance(1 / 60));
      highest = Math.max(highest, marble.position.z);
    }
    expect(visited(events, pieces)).toContain("ramp@0,0,1");
    expect(visited(events, pieces)).not.toContain("straight@1,0,1");
    // Part way up, never to the top
    expect(highest).toBeGreaterThan(0.6);
    expect(highest).toBeLessThan(1);
  });

  it("gets up a ramp with the speed from coming down one", () => {
    const layout: Layout = [
      ["dispenser", 0, -2, 0, 1],
      ["ramp", 0, -1, 0, 1],
      ["straight", 0, 0, 0, 0],
      ["ramp", 2, 1, 0, 1],
      ["straight", 0, 2, 0, 1],
    ];
    const { pieces, sim, events } = start(layout);
    events.push(...run(sim, 1.5));
    expect(visited(events, pieces)).toEqual([
      "ramp@-1,0,1",
      "straight@0,0,0",
      "ramp@1,0,1",
      "straight@2,0,1",
    ]);
  });

  it("flies a fast marble off level track over the top of a ramp", () => {
    // Fast from the first ramp, along a level track and over the lip of
    // the next: it sails right over it
    const layout: Layout = [
      ["dispenser", 0, -1, 0, 2],
      ["ramp", 0, 0, 0, 2],
      ["straight", 0, 1, 0, 1],
      ["ramp", 0, 2, 0, 1],
      ["straight", 0, 3, 0, 0],
      ["straight", 0, 4, 0, 0],
      ["straight", 0, 5, 0, 0],
    ];
    const { pieces, sim, events, marble } = start(layout);
    let flewOverRamp = false;
    for (let i = 0; i < 90; i++) {
      events.push(...sim.advance(1 / 60));
      const { x } = marble.position;
      if (x > 1.7 && x < 2.5) {
        flewOverRamp ||= motionAs(marble, "flying") !== null;
      }
    }
    expect(flewOverRamp).toBe(true);
    expect(visited(events, pieces)).not.toContain("ramp@2,0,1");
    expect(visited(events, pieces)).toContain("straight@4,0,0");
  });

  // Two ramps in a row make one long slope, wherever the second is along
  // the line of sight, as long as it looks joined on
  for (const depth of [-1, 0, 1]) {
    it(`rolls down two ramps in a row as one slope (${depth} closer)`, () => {
      const second = { x: 1 + depth, y: depth, z: 1 + depth };
      const layout: Layout = [
        ["dispenser", 0, -1, 0, 2],
        ["ramp", 0, 0, 0, 2],
        ["ramp", 0, second.x, second.y, second.z],
        ["straight", 0, second.x + 1, second.y, second.z - 1],
        ["straight", 0, second.x + 2, second.y, second.z - 1],
      ];
      const { pieces, sim, events, marble } = start(layout);
      // Never in the air on the way down
      let flew = false;
      let speed = 0;
      for (let i = 0; i < 60; i++) {
        events.push(...sim.advance(1 / 60));
        if (marble.position.x < second.x + 1.5) {
          flew ||= motionAs(marble, "flying") !== null;
          speed = marble.speed;
        }
      }
      expect(flew).toBe(false);
      expect(visited(events, pieces)).toEqual(
        pieces
          .slice(1)
          .map(({ kind, cell }) => `${kind}@${cell.x},${cell.y},${cell.z}`),
      );
      // Faster than off one ramp
      expect(speed).toBeGreaterThan(7);
    });
  }

  it("launches a fast marble off the top of a ramp up, like a ski jump", () => {
    const layout: Layout = [
      ["dispenser", 0, -2, 0, 3],
      ["ramp", 0, -1, 0, 3],
      ["ramp", 0, 0, 0, 2],
      ["straight", 0, 1, 0, 1],
      ["straight", 0, 2, 0, 1],
      ["ramp", 2, 3, 0, 2],
    ];
    const { sim, marble } = start(layout);
    let highest = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 120; i++) {
      sim.advance(1 / 60);
      if (marble.position.x > 3.5)
        highest = Math.max(highest, marble.position.z);
    }
    // Up into the air above the top of the ramp
    expect(highest).toBeGreaterThan(2.75);
  });

  for (let turn = 0; turn < 4; turn++) {
    it(`catches a marble dropped onto its slope (turned ${turn})`, () => {
      const layout: Layout = [
        ["ramp", 0, 0, 0, 1],
        ["straight", 0, 1, 0, 0],
        ["straight", 0, 2, 0, 0],
      ];
      const pieces = build(layout, turn);
      const sim = new Simulation(() => 0.5);
      sim.setPieces(pieces);
      sim.addMarble({ x: 0, y: 0, z: 2.5 });
      const events = run(sim, 3);
      expect(visited(events, pieces)).toEqual(
        pieces.map(({ kind, cell }) => `${kind}@${cell.x},${cell.y},${cell.z}`),
      );
    });
  }
});
