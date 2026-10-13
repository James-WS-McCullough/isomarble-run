import {
  DIRECTION_VECTORS,
  DIRECTIONS,
  type Direction,
  oppositeDirection,
  rotateDirection,
} from "./directions";
import {
  isFlatTopped,
  isTube,
  isUpsideDown,
  joinsTubeAbove,
  type PieceKind,
  pieceLength,
  portLevel,
} from "./pieces";
import { type PortalLink, portalLinks } from "./portals";
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

/**
 * The cells a piece takes up: its own, and for a long piece (like a
 * seesaw's beam) the cells either side of it along its x axis
 */
export function footprint(
  piece: Pick<Piece, "kind" | "rotation" | "cell">,
): Cell[] {
  const { cell } = piece;
  const reach = (pieceLength(piece.kind) - 1) / 2;
  const v = DIRECTION_VECTORS[rotateDirection("+x", piece.rotation)];
  const cells: Cell[] = [];
  for (let i = -reach; i <= reach; i++) {
    cells.push({ x: cell.x + v.x * i, y: cell.y + v.y * i, z: cell.z });
  }
  return cells;
}

/** Height of a marble's centre above the centre of the piece it rolls on */
export function restHeight(kind: PieceKind): number {
  return isFlatTopped(kind) ? FLAT_REST_HEIGHT : GROOVE_REST_HEIGHT;
}

export const REST_HEIGHTS = [GROOVE_REST_HEIGHT, FLAT_REST_HEIGHT];

/**
 * How many empty cells a fan's air crosses to reach a tube above it. Marbles
 * it kicks up into that tube get sucked up the column.
 */
export const FAN_REACH = 2;

/** A stack of tube pieces (tubes, outlets and funnels) */
export interface TubeColumn {
  x: number;
  y: number;
  /** Levels of its lowest and highest pieces */
  bottom: number;
  top: number;
  /**
   * Whether an outlet tops it off. That's an elbow, so whatever rises up
   * the column leaves through its spout rather than out of the top.
   */
  cappedTop: boolean;
  /**
   * Whether an upside-down outlet is at the bottom: what drops down the
   * column leaves through its spout, and no fan can blow up into it
   */
  cappedBottom: boolean;
  /** The piece right under its bottom, if any */
  base: Piece | undefined;
  /** The fan blowing up it: right under it, or below a gap its air crosses */
  fan: Piece | undefined;
}

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
  private readonly portals: Map<string, PortalLink>;

  constructor(pieces: Piece[]) {
    this.pieces = pieces;
    this.portals = portalLinks(pieces);
    for (const piece of pieces) {
      for (const cell of footprint(piece))
        this.byCell.set(cellKey(cell), piece);
    }

    for (const piece of pieces) {
      const covered = this.isCovered(piece);
      // Fans and tubes take marbles in through their sides even with more
      // tube stacked on top; other pieces need a clear top
      if (covered && !joinsTubeAbove(piece.kind)) continue;

      for (const { x, y, z } of footprint(piece)) {
        for (const side of DIRECTIONS) {
          const v = DIRECTION_VECTORS[side];
          // Sides facing the rest of the same piece aren't openings
          if (
            this.byCell.get(cellKey({ x: x + v.x, y: y + v.y, z })) === piece
          ) {
            continue;
          }
          // An upside-down piece's openings are a level down
          const level = z + portLevel(piece);
          const key = portKey(x + v.x / 2 - level, y + v.y / 2 - level, side);
          addTo(this.ports, key, piece);
        }

        if (covered) continue;
        addTo(
          this.columns,
          columnKey(x - z, y - z, restHeight(piece.kind)),
          piece,
        );
      }
    }
  }

  /** The portal a portal leads to, if it has a twin */
  twinOf(portal: Piece): Piece | undefined {
    return this.portals.get(portal.id)?.twin;
  }

  pieceAt(cell: Cell): Piece | undefined {
    return this.byCell.get(cellKey(cell));
  }

  isOccupied(cell: Cell): boolean {
    return this.byCell.has(cellKey(cell));
  }

  /** Whether there's a tube, outlet or funnel in a cell */
  isTubeAt(cell: Cell): boolean {
    const piece = this.pieceAt(cell);
    return piece !== undefined && isTube(piece.kind);
  }

  /** The column of tubes with a tube in the given cell, if there is one */
  tubeColumn(cell: Cell): TubeColumn | undefined {
    const { x, y, z } = cell;
    if (!this.isTubeAt(cell)) return undefined;
    let bottom = z;
    while (this.isTubeAt({ x, y, z: bottom - 1 })) bottom--;
    let top = z;
    while (this.isTubeAt({ x, y, z: top + 1 })) top++;

    const isElbow = (level: number, upsideDown: boolean) => {
      const piece = this.pieceAt({ x, y, z: level });
      return piece?.kind === "outlet" && isUpsideDown(piece) === upsideDown;
    };
    const cappedTop = isElbow(top, false);
    const cappedBottom = isElbow(bottom, true);

    const base = this.pieceAt({ x, y, z: bottom - 1 });
    let fan = base?.kind === "fan" && !cappedBottom ? base : undefined;
    for (let gap = 1; !base && !cappedBottom && gap <= FAN_REACH; gap++) {
      const below = this.pieceAt({ x, y, z: bottom - 1 - gap });
      if (!below) continue;
      if (below.kind === "fan") fan = below;
      break;
    }

    return {
      x,
      y,
      bottom,
      top,
      cappedTop,
      cappedBottom,
      base,
      fan,
    };
  }

  /**
   * The first piece above a fan that its air reaches: right on top of it,
   * or across up to FAN_REACH empty cells
   */
  reachedByFan(fan: Piece): Piece | undefined {
    const { x, y, z } = fan.cell;
    for (let level = z + 1; level <= z + 1 + FAN_REACH; level++) {
      const piece = this.pieceAt({ x, y, z: level });
      if (piece) return piece;
    }
    return undefined;
  }

  /**
   * A piece with another piece on top has no usable top surface, except
   * under a glass tube, which is hollow: marbles drop out of it onto the
   * piece below
   */
  isCovered(piece: Piece): boolean {
    return footprint(piece).some(({ x, y, z }) => {
      const above = this.byCell.get(cellKey({ x, y, z: z + 1 }));
      if (!above) return false;
      return !isTube(above.kind) || joinsTubeAbove(piece.kind);
    });
  }

  /**
   * The piece a marble rolls onto when it leaves `piece` heading in
   * `direction`: a piece whose opening lines up on screen with this exit,
   * at a depth where the join really looks seamless. If several qualify,
   * the one closest to the camera (the one you can see) wins.
   */
  findConnection(piece: Piece, direction: Direction): Piece | undefined {
    return this.findConnectionFrom(portCell(piece), direction, piece);
  }

  /** As findConnection, for a piece that would sit at `cell` */
  findConnectionFrom(
    cell: Cell,
    direction: Direction,
    exclude?: Piece,
  ): Piece | undefined {
    const { x, y, z } = cell;
    const v = DIRECTION_VECTORS[direction];
    const key = portKey(
      x + v.x / 2 - z,
      y + v.y / 2 - z,
      oppositeDirection(direction),
    );
    return frontmost(
      (this.ports.get(key) ?? []).filter(
        (other) =>
          other !== exclude && looksJoined(cell, portCell(other), direction),
      ),
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

/** The cell a piece's side openings belong to */
export function portCell(
  piece: Pick<Piece, "kind" | "rotation" | "cell">,
): Cell {
  return { ...piece.cell, z: piece.cell.z + portLevel(piece) };
}

/**
 * Whether two pieces whose openings line up on screen really look joined.
 *
 * `next` sits k steps along the line of sight from the true neighbouring
 * cell (k > 0 is closer to the camera). Where the pieces meet, the one
 * further down the screen must not be further away: otherwise the front
 * wall of the upper piece hangs down over the join and it looks like a step.
 * Heading down the screen (+x, +y) that means k >= 0; heading up it, k <= 0.
 */
export function looksJoined(
  from: Cell,
  next: Cell,
  direction: Direction,
): boolean {
  const k = next.z - from.z;
  return direction === "+x" || direction === "+y" ? k >= 0 : k <= 0;
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
