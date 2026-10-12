/** The four horizontal directions a marble can travel in */
export type Direction = "+x" | "+y" | "-x" | "-y";

/** In quarter-turn order: rotating a direction by one step turns +x into +y */
export const DIRECTIONS: Direction[] = ["+x", "+y", "-x", "-y"];

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  "+x": { x: 1, y: 0 },
  "+y": { x: 0, y: 1 },
  "-x": { x: -1, y: 0 },
  "-y": { x: 0, y: -1 },
};

/** Rotate a direction by a number of quarter turns */
export function rotateDirection(
  direction: Direction,
  turns: number,
): Direction {
  const index = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(((index + turns) % 4) + 4) % 4];
}

export function oppositeDirection(direction: Direction): Direction {
  return rotateDirection(direction, 2);
}

/**
 * The main direction of a horizontal velocity, or null when it is too slow
 * to count as moving.
 */
export function directionOfVelocity(
  vx: number,
  vy: number,
  minSpeed: number,
): Direction | null {
  if (Math.hypot(vx, vy) < minSpeed) return null;
  if (Math.abs(vx) >= Math.abs(vy)) return vx > 0 ? "+x" : "-x";
  return vy > 0 ? "+y" : "-y";
}
