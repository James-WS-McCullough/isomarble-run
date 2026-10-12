/**
 * World space: x and y are the horizontal grid axes and z points up.
 * One unit is one grid cell; piece (x, y, z) fills the unit cube centred
 * on that point.
 *
 * The camera is a true isometric view looking along (-1, -1, -1), so the
 * point p and p + k(1, 1, 1) land on the same spot on screen for any k.
 * Larger x + y + z is closer to the camera. That ambiguity is what lets
 * marbles jump between pieces that only *look* connected.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export const MARBLE_RADIUS = 0.22;
/** Half the width of the groove carved into a piece */
export const GROOVE_HALF_WIDTH = 0.2;
/** Depth of the groove, measured down from the top of the piece */
export const GROOVE_DEPTH = 0.25;

/** Height of a marble's centre above a grooved piece's centre */
export const GROOVE_REST_HEIGHT =
  0.5 + Math.sqrt(MARBLE_RADIUS ** 2 - GROOVE_HALF_WIDTH ** 2);
/** Height of a marble's centre above a flat-topped block's centre */
export const FLAT_REST_HEIGHT = 0.5 + MARBLE_RADIUS;

export const SQRT2 = Math.SQRT2;
export const SQRT6 = Math.sqrt(6);

/** How far towards the camera a point is */
export function depthOf(p: Vec3): number {
  return p.x + p.y + p.z;
}

/** Screen position in world units: right is +x−y, up is +z */
export function screenOf(p: Vec3): { right: number; up: number } {
  return {
    right: (p.x - p.y) / SQRT2,
    up: (2 * p.z - p.x - p.y) / SQRT6,
  };
}

/** The point at a given screen position and depth */
export function fromScreen(right: number, up: number, depth: number): Vec3 {
  const z = (up * SQRT6 + depth) / 3;
  const sum = depth - z;
  const difference = right * SQRT2;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2, z };
}

/** Slide a point along the line of sight; it stays put on screen */
export function slideAlongView(p: Vec3, amount: number): Vec3 {
  return { x: p.x + amount, y: p.y + amount, z: p.z + amount };
}

/**
 * Remove any movement along the line of sight, leaving only the part of a
 * displacement you can actually see.
 */
export function visiblePart(v: Vec3): Vec3 {
  const along = (v.x + v.y + v.z) / 3;
  return { x: v.x - along, y: v.y - along, z: v.z - along };
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

/** Convert world coordinates to three.js coordinates (y up) */
export function toThree(p: Vec3): [number, number, number] {
  return [p.x, p.z, p.y];
}
