import { isSolid } from "../pieces";
import { MARBLE_RADIUS, type Vec3 } from "../space";
import type { TrackIndex } from "../track";
import type { Marble } from "./marble";
import { PHYSICS } from "./physics";
import { clamp, roundCell } from "./vector";

/**
 * Pieces are solid: a flying marble that runs into the side of one bounces
 * off it. Only the sides count; landing on top is handled separately.
 */
export function bounceOffWalls(
  track: TrackIndex,
  marble: Marble,
  before: Vec3,
) {
  const r = MARBLE_RADIUS;
  const centre = roundCell(marble.position);

  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = { x: centre.x + dx, y: centre.y + dy, z: centre.z + dz };
        const piece = track.pieceAt(cell);
        // Some pieces, like a seesaw, are mostly open space
        if (!piece || !isSolid(piece.kind)) continue;

        const p = marble.position;
        // Only below the top of the block, and not under it
        if (p.z >= cell.z + 0.5 || p.z < cell.z - 0.5 - r) continue;

        const offX = p.x - clamp(p.x, cell.x - 0.5, cell.x + 0.5);
        const offY = p.y - clamp(p.y, cell.y - 0.5, cell.y + 0.5);
        const distance = Math.hypot(offX, offY);
        if (distance >= r) continue;

        const v = marble.velocity;
        if (distance === 0) {
          // Got inside the block: step back out and turn round
          marble.position = { ...p, x: before.x, y: before.y };
          v.x = -v.x * PHYSICS.WALL_BOUNCE;
          v.y = -v.y * PHYSICS.WALL_BOUNCE;
          continue;
        }

        // Push out of the wall and bounce off it
        const nx = offX / distance;
        const ny = offY / distance;
        marble.position = {
          ...p,
          x: p.x + nx * (r - distance),
          y: p.y + ny * (r - distance),
        };
        const into = v.x * nx + v.y * ny;
        if (into < 0) {
          v.x -= (1 + PHYSICS.WALL_BOUNCE) * into * nx;
          v.y -= (1 + PHYSICS.WALL_BOUNCE) * into * ny;
        }
      }
    }
  }
}
