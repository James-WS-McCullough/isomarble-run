import type { ThreeEvent } from "@react-three/fiber";
import type { Object3D } from "three";
import type { Cell, Vec3 } from "@/lib/space";
import { footprint, type Piece } from "@/lib/track";

/** Working out what the pointer is over on the board, for building */

/** What the pointer is over */
export interface BoardTarget {
  /** Piece under the pointer, if any */
  pieceId: string | null;
  /** Empty cell next to the face under the pointer, for placing a piece */
  placeCell: Cell;
  /** World position under the pointer */
  point: Vec3;
}

/** The id of the piece a 3D object belongs to, if any */
function findPieceId(object: Object3D | null): string | null {
  for (let current = object; current; current = current.parent) {
    const id = current.userData.pieceId;
    if (typeof id === "string") return id;
  }
  return null;
}

/**
 * What the pointer is over: the piece it hit (the floor is see-through to
 * pieces below it) and the empty cell beside the face it hit
 */
export function targetFromEvent(
  event: ThreeEvent<PointerEvent | MouseEvent>,
  pieces: Piece[],
): BoardTarget {
  const hit =
    event.intersections.find((intersection) =>
      findPieceId(intersection.object),
    ) ?? event;
  const point = { x: hit.point.x, y: hit.point.z, z: hit.point.y };
  const pieceId = findPieceId(hit.object);
  const piece = pieceId ? pieces.find((p) => p.id === pieceId) : undefined;

  if (piece) {
    return {
      pieceId: piece.id,
      placeCell: neighbourFacing(nearestCell(footprint(piece), point), point),
      point,
    };
  }

  return {
    pieceId: null,
    placeCell: { x: Math.round(point.x), y: Math.round(point.y), z: 0 },
    point,
  };
}

/** The cell of a (possibly multi-cell) piece closest to a point */
export function nearestCell(cells: Cell[], point: Vec3): Cell {
  const distance = (cell: Cell) =>
    Math.hypot(point.x - cell.x, point.y - cell.y);
  return cells.reduce((best, cell) =>
    distance(cell) < distance(best) ? cell : best,
  );
}

/**
 * The cell next to a piece on the side the pointer hit. Anywhere on the top
 * surface, grooves included, counts as the top.
 */
export function neighbourFacing(cell: Cell, point: Vec3): Cell {
  const local = {
    x: point.x - cell.x,
    y: point.y - cell.y,
    z: point.z - cell.z,
  };
  const edge = 0.49;
  if (local.z <= -edge) return { ...cell, z: cell.z - 1 };
  if (Math.abs(local.x) < edge && Math.abs(local.y) < edge) {
    return { ...cell, z: cell.z + 1 };
  }
  if (Math.abs(local.x) >= Math.abs(local.y)) {
    return { ...cell, x: cell.x + Math.sign(local.x) };
  }
  return { ...cell, y: cell.y + Math.sign(local.y) };
}
