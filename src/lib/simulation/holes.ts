import type { Vec3 } from "../space";
import type { Piece } from "../track";
import type { Marble, SimulationEvent, Vanishing } from "./marble";
import { rollTo } from "./marble";
import { PHYSICS } from "./physics";

/** How fast a marble slides into the middle of a hole */
const SLIDE_IN = 3;

/**
 * Start dropping into a hole, from where the marble reached it. It slides
 * to the middle and falls out of sight inside the piece.
 */
export function fallIntoHole(
  marble: Marble,
  hole: Piece,
  from: Vec3,
  events: SimulationEvent[],
) {
  const { x, y, z } = hole.cell;
  marble.position = from;
  marble.velocity = { x: 0, y: 0, z: Math.min(marble.velocity.z, 0) };
  marble.motion = { mode: "vanishing", x, y, bottom: z - 0.4 };
  events.push({ type: "visit", pieceId: hole.id, marbleId: marble.id });
}

/** Returns false once the marble has dropped out of sight */
export function stepVanishing(
  marble: Marble,
  hole: Vanishing,
  dt: number,
): boolean {
  const { position: p, velocity: v } = marble;
  v.z = Math.max(v.z - PHYSICS.GRAVITY * dt, -PHYSICS.MAX_SPEED);
  const dx = hole.x - p.x;
  const dy = hole.y - p.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.min(distance, SLIDE_IN * dt);
  rollTo(marble, {
    x: distance > 0 ? p.x + (dx / distance) * step : p.x,
    y: distance > 0 ? p.y + (dy / distance) * step : p.y,
    z: p.z + v.z * dt,
  });
  return marble.position.z > hole.bottom;
}
