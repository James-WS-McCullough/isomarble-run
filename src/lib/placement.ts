import { DIRECTIONS, oppositeDirection } from "./directions";
import { hasGroove, type PieceKind, piecePorts } from "./pieces";
import { type Cell, cellKey } from "./space";
import { type Piece, TrackIndex } from "./track";

/** Pieces can go this far below the floor, for joins that need to be low */
export const LOWEST_LEVEL = -12;

/** How many steps along the line of sight to look for a better depth */
const SNAP_RANGE = 10;

/** Move a cell along the line of sight; it stays in the same spot on screen */
export function slideCell(cell: Cell, steps: number): Cell {
  return { x: cell.x + steps, y: cell.y + steps, z: cell.z + steps };
}

/**
 * How many neighbouring grooves a piece would join seamlessly, groove to
 * groove, if it sat at `cell`
 */
export function countJoins(
  track: TrackIndex,
  kind: PieceKind,
  rotation: number,
  cell: Cell,
): number {
  const sides = hasGroove(kind) ? piecePorts(kind, rotation) : DIRECTIONS;
  let joins = 0;
  for (const side of sides) {
    const neighbour = track.findConnectionFrom(cell, side);
    if (!neighbour) continue;
    const opening = oppositeDirection(side);
    if (
      !hasGroove(neighbour.kind) ||
      piecePorts(neighbour.kind, neighbour.rotation).includes(opening)
    ) {
      joins += 1;
    }
  }
  return joins;
}

/**
 * Pick the depth to place a grooved piece at. Every cell along the line of sight
 * through `cell` looks the same on screen; choose the free one where the
 * piece joins up with the most neighbouring track, preferring `cell` itself
 * (where the pointer is) when there's a tie.
 */
export function snapToJoins(
  pieces: Piece[],
  kind: PieceKind,
  rotation: number,
  cell: Cell,
  ignoreId?: string,
): Cell {
  // Plain blocks have no grooves to join up, so they go where they're put
  if (!hasGroove(kind)) return cell;

  const others = pieces.filter((piece) => piece.id !== ignoreId);
  const occupied = new Set(others.map((piece) => cellKey(piece.cell)));
  const track = new TrackIndex(others);

  let best = cell;
  let bestJoins = occupied.has(cellKey(cell))
    ? -1
    : countJoins(track, kind, rotation, cell);

  for (let distance = 1; distance <= SNAP_RANGE; distance++) {
    for (const steps of [distance, -distance]) {
      const candidate = slideCell(cell, steps);
      if (candidate.z < LOWEST_LEVEL) continue;
      if (occupied.has(cellKey(candidate))) continue;
      // Something on top would block its groove
      if (occupied.has(cellKey({ ...candidate, z: candidate.z + 1 }))) continue;
      const joins = countJoins(track, kind, rotation, candidate);
      if (joins > bestJoins) {
        best = candidate;
        bestJoins = joins;
      }
    }
  }
  return best;
}
