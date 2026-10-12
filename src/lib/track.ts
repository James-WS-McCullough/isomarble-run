import {
  DIRECTION_VECTORS,
  DIRECTIONS,
  type Direction,
  oppositeDirection,
} from "./directions";
import { hasGroove, type PieceKind } from "./pieces";
import {
  type Cell,
  cellKey,
  depthOf,
  FLAT_REST_HEIGHT,
  GROOVE_REST_HEIGHT,
} from "./space";

/** A piece placed in the world */
export interface Piece {
  id: string;
  kind: PieceKind;
  /** Quarter turns, 0-3 */
  rotation: number;
  cell: Cell;
}

let pieceCounter = 0;

export function createPiece(
  kind: PieceKind,
  rotation: number,
  cell: Cell,
): Piece {
  pieceCounter += 1;
  return {
    id: `piece-${Date.now().toString(36)}-${pieceCounter}`,
    kind,
    rotation,
    cell,
  };
}

/** Height of a marble's centre above the centre of the piece it rolls on */
export function restHeight(kind: PieceKind): number {
  return hasGroove(kind) ? GROOVE_REST_HEIGHT : FLAT_REST_HEIGHT;
}

export const REST_HEIGHTS = [GROOVE_REST_HEIGHT, FLAT_REST_HEIGHT];

/**
 * Fast lookups over the pieces of a track for the simulation.
 *
 * Pieces are grouped by where they appear on screen, because the
 * simulation treats anything that lines up on screen as touching.
 */
export class TrackIndex {
  readonly pieces: Piece[];
  private readonly byCell = new Map<string, Piece>();
  /** Pieces by the on-screen position of one of their side openings */
  private readonly ports = new Map<string, Piece[]>();
  /** Uncovered pieces by the on-screen column of their top face */
  private readonly columns = new Map<string, Piece[]>();

  constructor(pieces: Piece[]) {
    this.pieces = pieces;
    for (const piece of pieces) {
      this.byCell.set(cellKey(piece.cell), piece);
    }

    for (const piece of pieces) {
      if (this.isCovered(piece)) continue;
      const { x, y, z } = piece.cell;

      for (const side of DIRECTIONS) {
        const v = DIRECTION_VECTORS[side];
        const key = portKey(x + v.x / 2 - z, y + v.y / 2 - z, side);
        addTo(this.ports, key, piece);
      }

      addTo(
        this.columns,
        columnKey(x - z, y - z, restHeight(piece.kind)),
        piece,
      );
    }
  }

  pieceAt(cell: Cell): Piece | undefined {
    return this.byCell.get(cellKey(cell));
  }

  isOccupied(cell: Cell): boolean {
    return this.byCell.has(cellKey(cell));
  }

  /** A piece with another piece on top has no usable top surface */
  isCovered(piece: Piece): boolean {
    const { x, y, z } = piece.cell;
    return this.byCell.has(cellKey({ x, y, z: z + 1 }));
  }

  /**
   * The piece a marble rolls onto when it leaves `piece` heading in
   * `direction`: any piece whose opening lines up on screen with this
   * exit. If several line up, the one closest to the camera wins.
   */
  findConnection(piece: Piece, direction: Direction): Piece | undefined {
    const { x, y, z } = piece.cell;
    const v = DIRECTION_VECTORS[direction];
    const key = portKey(
      x + v.x / 2 - z,
      y + v.y / 2 - z,
      oppositeDirection(direction),
    );
    return frontmost(
      (this.ports.get(key) ?? []).filter((other) => other !== piece),
    );
  }

  /**
   * Uncovered pieces whose top face shows at a given on-screen column,
   * for marbles resting at `rest` above the piece centre
   */
  piecesInColumn(column: { a: number; b: number }, rest: number): Piece[] {
    return this.columns.get(columnKey(column.a, column.b, rest)) ?? [];
  }
}

function portKey(a: number, b: number, side: Direction): string {
  return `${a * 2},${b * 2},${side}`;
}

function columnKey(a: number, b: number, rest: number): string {
  return `${a},${b},${rest === GROOVE_REST_HEIGHT ? "g" : "f"}`;
}

function addTo(map: Map<string, Piece[]>, key: string, piece: Piece) {
  const list = map.get(key);
  if (list) list.push(piece);
  else map.set(key, [piece]);
}

/** The piece closest to the camera */
export function frontmost(pieces: Piece[]): Piece | undefined {
  let best: Piece | undefined;
  for (const piece of pieces) {
    if (!best || depthOf(piece.cell) > depthOf(best.cell)) best = piece;
  }
  return best;
}
