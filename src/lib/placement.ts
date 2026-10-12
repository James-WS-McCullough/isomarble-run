import { DIRECTIONS, oppositeDirection } from "./directions";
import { isFlatTopped, type PieceKind, piecePorts } from "./pieces";
import { type Cell, cellKey } from "./space";
import { footprint, type Piece, portCell, TrackIndex } from "./track";

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
  const sides = isFlatTopped(kind) ? DIRECTIONS : piecePorts(kind, rotation);
  let joins = 0;
  for (const side of sides) {
    const neighbour = track.findConnectionFrom(
      portCell({ kind, rotation, cell }),
      side,
    );
    if (!neighbour) continue;
    const opening = oppositeDirection(side);
    if (
      isFlatTopped(neighbour.kind) ||
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
  if (isFlatTopped(kind)) return cell;

  const others = pieces.filter((piece) => piece.id !== ignoreId);
  const occupied = occupiedCells(others);
  const track = new TrackIndex(others);
  const fits = (at: Cell) =>
    footprint({ kind, rotation, cell: at }).every(
      (part) => !occupied.has(cellKey(part)),
    );

  let best = cell;
  let bestJoins = fits(cell) ? countJoins(track, kind, rotation, cell) : -1;

  for (let distance = 1; distance <= SNAP_RANGE; distance++) {
    for (const steps of [distance, -distance]) {
      const candidate = slideCell(cell, steps);
      if (candidate.z < LOWEST_LEVEL) continue;
      if (!fits(candidate)) continue;
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

/** Every cell taken up by these pieces */
export function occupiedCells(pieces: Piece[]): Set<string> {
  const occupied = new Set<string>();
  for (const piece of pieces) {
    for (const cell of footprint(piece)) occupied.add(cellKey(cell));
  }
  return occupied;
}

/** Whether a piece fits at `cell` without overlapping any of `pieces` */
export function fitsAt(
  pieces: Piece[],
  kind: PieceKind,
  rotation: number,
  cell: Cell,
  ignoreId?: string,
): boolean {
  if (cell.z < LOWEST_LEVEL) return false;
  const occupied = occupiedCells(
    pieces.filter((piece) => piece.id !== ignoreId),
  );
  return footprint({ kind, rotation, cell }).every(
    (part) => !occupied.has(cellKey(part)),
  );
}
