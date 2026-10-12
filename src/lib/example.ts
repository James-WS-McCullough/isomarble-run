import type { PieceKind } from "./pieces";
import { createPiece, type Piece } from "./track";

interface Placement {
  kind: PieceKind;
  rotation: number;
  /** Position on screen, as the cell this piece would be in at level 0 */
  u: number;
  v: number;
  level: number;
}

/**
 * A Penrose staircase: a square loop of track where every piece is one step
 * lower than the one before it, yet the last piece still joins up with the
 * first. A piece at (u + level, v + level, level) looks exactly like it is
 * at (u, v, 0) from the isometric camera, so the loop looks closed.
 */
function penroseLoop(size: number): Piece[] {
  const low = -Math.floor(size / 2);
  const high = low + size - 1;

  // Walk the ring clockwise on screen: corners are curves, sides straights
  const ring: Placement[] = [];
  const sides = [
    { corner: [low, low], curve: 0, step: [1, 0], straight: 0 },
    { corner: [high, low], curve: 1, step: [0, 1], straight: 1 },
    { corner: [high, high], curve: 2, step: [-1, 0], straight: 0 },
    { corner: [low, high], curve: 3, step: [0, -1], straight: 1 },
  ];
  for (const side of sides) {
    const [cu, cv] = side.corner;
    ring.push({ kind: "curve", rotation: side.curve, u: cu, v: cv, level: 0 });
    for (let i = 1; i < size - 1; i++) {
      ring.push({
        kind: "straight",
        rotation: side.straight,
        u: cu + side.step[0] * i,
        v: cv + side.step[1] * i,
        level: 0,
      });
    }
  }

  return ring.map(({ kind, rotation, u, v }, index) => {
    const level = ring.length - 1 - index;
    return createPiece(kind, rotation, {
      x: u + level,
      y: v + level,
      z: level,
    });
  });
}

/** The starter track: an endless Penrose staircase */
export function exampleTrack(): Piece[] {
  return penroseLoop(5);
}
