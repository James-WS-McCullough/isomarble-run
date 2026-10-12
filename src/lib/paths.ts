import { DIRECTION_VECTORS, type Direction } from "./directions";
import type { Vec3 } from "./space";

/**
 * A route across the top of a piece, as a polyline in world space
 */
export class Path {
  readonly points: Vec3[];
  readonly length: number;
  /** True for curved routes, which scrub off a little speed */
  readonly turns: boolean;
  private readonly lengths: number[];

  constructor(points: Vec3[], turns = false) {
    this.points = points;
    this.turns = turns;
    this.lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.lengths.push(
        this.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
      );
    }
    this.length = this.lengths[this.lengths.length - 1];
  }

  /** The point a distance `s` along the path */
  pointAt(s: number): Vec3 {
    if (s <= 0) return this.points[0];
    for (let i = 1; i < this.points.length; i++) {
      if (s <= this.lengths[i]) {
        const a = this.points[i - 1];
        const b = this.points[i];
        const span = this.lengths[i] - this.lengths[i - 1];
        const t = span === 0 ? 0 : (s - this.lengths[i - 1]) / span;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
        };
      }
    }
    return this.points[this.points.length - 1];
  }
}

const ARC_SEGMENTS = 8;

function portPoint(side: Direction): { x: number; y: number } {
  const v = DIRECTION_VECTORS[side];
  return { x: v.x / 2, y: v.y / 2 };
}

/**
 * Route across a piece from the opening on side `from` to the opening on
 * side `to`, in coordinates relative to the piece centre:
 * straight through, a quarter-circle turn, or in and back out (a U-turn).
 */
export function routeBetween(
  from: Direction,
  to: Direction,
): { points: { x: number; y: number }[]; turns: boolean } {
  const start = portPoint(from);
  const end = portPoint(to);

  if (from === to) {
    return { points: [start, { x: 0, y: 0 }, end], turns: false };
  }
  if (start.x === -end.x && start.y === -end.y) {
    return { points: [start, end], turns: false };
  }

  // Quarter circle around the corner the two openings share
  const corner = { x: start.x + end.x, y: start.y + end.y };
  const startAngle = Math.atan2(start.y - corner.y, start.x - corner.x);
  let endAngle = Math.atan2(end.y - corner.y, end.x - corner.x);
  if (endAngle - startAngle > Math.PI) endAngle -= 2 * Math.PI;
  if (startAngle - endAngle > Math.PI) endAngle += 2 * Math.PI;

  const points = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / ARC_SEGMENTS;
    points.push({
      x: corner.x + 0.5 * Math.cos(angle),
      y: corner.y + 0.5 * Math.sin(angle),
    });
  }
  return { points, turns: true };
}

/**
 * Route from wherever a marble landed on a piece to the opening on side
 * `to`. It settles into the groove first, passing through the centre if it
 * landed on the far side.
 */
export function routeFromLanding(
  landed: { x: number; y: number },
  to: Direction,
): { x: number; y: number }[] {
  const v = DIRECTION_VECTORS[to];
  const along = landed.x * v.x + landed.y * v.y;
  if (along < 0) {
    return [landed, { x: 0, y: 0 }, portPoint(to)];
  }
  const inGroove = { x: v.x * along, y: v.y * along };
  return [landed, inGroove, portPoint(to)];
}
