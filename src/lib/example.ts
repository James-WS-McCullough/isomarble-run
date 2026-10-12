import type { PieceKind } from "./pieces";
import { createPiece, type Piece } from "./track";

type Placement = [
  kind: PieceKind,
  rotation: number,
  /** Where the piece appears on screen, as the cell it would fill at level 0 */
  u: number,
  v: number,
  level: number,
];

/**
 * Escher's Waterfall as a marble run. Marbles roll off the top of a tower
 * and fall four levels into a catcher, then roll along track that looks
 * perfectly flat all the way back to the top.
 *
 * The climb is hidden in the joins: heading down the screen (+x or +y),
 * the next piece can be higher and closer to the camera and the join still
 * looks seamless. A piece at (u + level, v + level, level) looks exactly
 * like it is at (u, v, 0) from the isometric camera.
 */
const WATERFALL: Placement[] = [
  // The top of the tower: marbles leave its +x end and fall
  ["straight", 0, -2, -3, 4],
  // The catcher at the bottom sends marbles off along +y
  ["catcher", 1, 4, 1, 0],
  // Heading +y (down the screen), climbing a level with each piece
  ["straight", 1, 4, 2, 1],
  ["curve", 2, 4, 3, 2],
  // Back along -x and -y (up the screen), staying level
  ["straight", 0, 3, 3, 2],
  ["straight", 0, 2, 3, 2],
  ["straight", 0, 1, 3, 2],
  ["straight", 0, 0, 3, 2],
  ["straight", 0, -1, 3, 2],
  ["straight", 0, -2, 3, 2],
  ["straight", 0, -3, 3, 2],
  ["curve", 3, -4, 3, 2],
  ["straight", 1, -4, 2, 2],
  ["straight", 1, -4, 1, 2],
  ["straight", 1, -4, 0, 2],
  ["straight", 1, -4, -1, 2],
  ["straight", 1, -4, -2, 2],
  ["curve", 0, -4, -3, 2],
  // And +x into the tower top, climbing the last two levels
  ["straight", 0, -3, -3, 3],
];

/** The starter track */
export function exampleTrack(): Piece[] {
  const pieces: Piece[] = [];
  for (const [kind, rotation, u, v, level] of WATERFALL) {
    const x = u + level;
    const y = v + level;
    pieces.push(createPiece(kind, rotation, { x, y, z: level }));
    // A wooden pillar down to the floor
    for (let z = 0; z < level; z++) {
      pieces.push(createPiece("block", 0, { x, y, z }));
    }
  }
  return pieces;
}
