import { DIRECTION_VECTORS, type Direction } from "./directions";
import { quarterCircle } from "./grooves";
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

  /** Direction of travel (a unit vector) a distance `s` along the path */
  tangentAt(s: number): Vec3 {
    for (let i = 1; i < this.points.length; i++) {
      if (s <= this.lengths[i] || i === this.points.length - 1) {
        const a = this.points[i - 1];
        const b = this.points[i];
        const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        if (length > 1e-9) {
          return {
            x: (b.x - a.x) / length,
            y: (b.y - a.y) / length,
            z: (b.z - a.z) / length,
          };
        }
      }
    }
    return { x: 0, y: 0, z: 0 };
  }

  /** The way back: from a distance `s` along the path to its start */
  backFrom(s: number): Vec3[] {
    const points = [this.pointAt(s)];
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (this.lengths[i] < s) points.push(this.points[i]);
    }
    return points;
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
  return { points: quarterCircle(from, to), turns: true };
}
