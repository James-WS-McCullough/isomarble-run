import {
  DIRECTION_VECTORS,
  type Direction,
  oppositeDirection,
} from "../directions";
import {
  hasBowl,
  marbleHeightAt,
  nearestOnRoute,
  routeToExit,
} from "../grooves";
import { Path, routeBetween } from "../paths";
import { pieceExits } from "../pieces";
import type { Vec3 } from "../space";
import type { Piece } from "../track";
import { type Marble, type Rolling, snapTo } from "./marble";
import { clamp } from "./vector";

/** Paths for marbles rolling across pieces */

type Point = { x: number; y: number };

/** One of several options, chosen at random */
export function pick<T>(options: T[], random: () => number): T {
  return options[Math.floor(random() * options.length)];
}

/**
 * A path across a piece through points relative to its centre, at the
 * height a marble sits at each point (resting in the groove, or higher up
 * the side of a bowl)
 */
export function pathOnPiece(
  piece: Piece,
  points: Point[],
  turns = false,
): Path {
  const { x, y, z } = piece.cell;
  return new Path(
    points.map((p) => ({
      x: x + p.x,
      y: y + p.y,
      z: z + marbleHeightAt(piece.kind, piece.rotation, p),
    })),
    turns,
  );
}

/**
 * A marble that came down on a piece at `point` settles from there into its
 * groove, and follows it out through `exit`
 */
export function settle(
  marble: Marble,
  piece: Piece,
  point: Vec3,
  exit: Direction,
) {
  const local = {
    x: clamp(point.x - piece.cell.x, -0.5, 0.5),
    y: clamp(point.y - piece.cell.y, -0.5, 0.5),
  };
  const route = routeToExit(piece.kind, piece.rotation, exit);
  const { point: inGroove, next } = nearestOnRoute(route, local);
  // Follow the shape of the wood as it rolls down into the groove
  const path = pathOnPiece(
    piece,
    densify([local, inGroove, ...route.slice(next)]),
  );

  marble.velocity = { x: 0, y: 0, z: 0 };
  marble.position = point;
  snapTo(marble, path.points[0]);
  marble.motion = {
    mode: "rolling",
    piece,
    path,
    distance: 0,
    exit,
    entry: null,
  };
}

/**
 * Route for a marble rolling in level with the top of a piece, from a side
 * with no opening: over the rim and down into the groove (or a catcher's
 * bowl), then out of the exit. Extra points let it follow the surface.
 */
export function overTheRim(
  piece: Piece,
  from: Direction,
  to: Direction,
): { points: Point[]; turns: boolean } {
  const start = DIRECTION_VECTORS[from];
  const end = DIRECTION_VECTORS[to];
  if (hasBowl(piece.kind)) {
    return {
      points: densify([
        { x: start.x / 2, y: start.y / 2 },
        { x: 0, y: 0 },
        { x: end.x / 2, y: end.y / 2 },
      ]),
      turns: false,
    };
  }
  const route = routeBetween(from, to);
  return { points: densify(route.points), turns: route.turns };
}

/** Add points along each segment so heights can follow curved surfaces */
export function densify(points: Point[], spacing = 0.06): Point[] {
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing),
    );
    for (let k = 1; k <= steps; k++) {
      result.push({
        x: a.x + ((b.x - a.x) * k) / steps,
        y: a.y + ((b.y - a.y) * k) / steps,
      });
    }
  }
  return result;
}

/** Roll back the way it came */
export function turnAround(
  marble: Marble,
  rolling: Rolling,
  random: () => number,
) {
  const { piece } = rolling;

  if (rolling.entry) {
    const path = new Path(rolling.path.backFrom(rolling.distance));
    marble.motion = {
      mode: "rolling",
      piece,
      path,
      distance: 0,
      exit: rolling.entry,
      entry: rolling.exit,
    };
    return;
  }

  // It landed here, so head out the other way through the middle
  const exit = pick(
    pieceExits(piece.kind, piece.rotation, oppositeDirection(rolling.exit)),
    random,
  );
  const here = rolling.path.pointAt(rolling.distance);
  const v = DIRECTION_VECTORS[exit];
  const path = pathOnPiece(
    piece,
    densify([
      { x: here.x - piece.cell.x, y: here.y - piece.cell.y },
      { x: 0, y: 0 },
      { x: v.x / 2, y: v.y / 2 },
    ]),
  );
  marble.motion = {
    mode: "rolling",
    piece,
    path,
    distance: 0,
    exit,
    entry: null,
  };
}
