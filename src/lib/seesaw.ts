import { DIRECTION_VECTORS, rotateDirection } from "./directions";
import { MARBLE_RADIUS, type Vec3 } from "./space";
import type { Piece } from "./track";

/**
 * Geometry of the cup seesaw, shared by the physics and the 3D model.
 * Heights are relative to the piece centre; the beam runs along the piece's
 * x axis before rotation, from the stand in its own cell to a cup over the
 * cell on either side.
 */
export const SEESAW = {
  /** Height of the pivot above the piece centre */
  PIVOT_HEIGHT: 0.05,
  /** Distance from the pivot to the middle of each cup: one tile */
  CUP_OFFSET: 1,
  /** How far the beam tips each way (radians) */
  TILT: 0.22,
  /** How fast it tips over (radians per second) */
  TIP_SPEED: 4,
  /** Height of a held marble's centre above the beam, resting in its cup */
  MARBLE_LIFT: MARBLE_RADIUS + 0.06,
  /** Launch speed of the flung marble: up, and outwards */
  LAUNCH_UP: 8.5,
  LAUNCH_OUT: 1.5,
};

/** The direction the beam points (its +1 end), in world space */
export function seesawAxis(piece: Piece): { x: number; y: number } {
  return DIRECTION_VECTORS[rotateDirection("+x", piece.rotation)];
}

/**
 * Where a marble sits in the cup at one end (`side` is +1 or -1) when the
 * beam is tipped by `tilt` (positive lowers the +1 end)
 */
export function cupPosition(piece: Piece, side: number, tilt: number): Vec3 {
  const axis = seesawAxis(piece);
  const along = side * SEESAW.CUP_OFFSET * Math.cos(tilt);
  const drop = side * SEESAW.CUP_OFFSET * Math.sin(tilt);
  return {
    x: piece.cell.x + axis.x * along,
    y: piece.cell.y + axis.y * along,
    z: piece.cell.z + SEESAW.PIVOT_HEIGHT - drop + SEESAW.MARBLE_LIFT,
  };
}
