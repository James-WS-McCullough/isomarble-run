import {
  DIRECTION_VECTORS,
  type Direction,
  oppositeDirection,
} from "./directions";
import { hasGroove, isTube, type PieceKind, piecePorts } from "./pieces";
import {
  FLAT_REST_HEIGHT,
  GROOVE_DEPTH,
  GROOVE_HALF_WIDTH,
  GROOVE_PROFILE_RADIUS,
  GROOVE_REST_HEIGHT,
  MARBLE_RADIUS,
} from "./space";

/**
 * The shape of the grooves carved into each piece. The same shape is used
 * to build the 3D model and to work out how high a marble sits, so marbles
 * always sit snugly in the groove.
 *
 * Coordinates are relative to the piece centre, with the top of the piece
 * at height 0.5. A groove runs along a centreline and has a rounded
 * cross-section: part of a circle of radius GROOVE_PROFILE_RADIUS.
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Part of a groove: a straight segment or quarter circle along its
 * centreline, or a round bowl in the middle of the piece
 */
export type Centreline =
  | { type: "segment"; from: Point; to: Point }
  | { type: "arc"; corner: Point }
  | { type: "bowl"; radius: number };

/** Radius of the round dip in the middle of a catcher */
export const CATCHER_BOWL_RADIUS = 0.42;

const CENTRE: Point = { x: 0, y: 0 };

function portPoint(side: Direction): Point {
  const v = DIRECTION_VECTORS[side];
  return { x: v.x / 2, y: v.y / 2 };
}

/** Quarter circle of radius 0.5 joining two adjacent sides */
function arcBetween(a: Direction, b: Direction): Centreline {
  const pa = portPoint(a);
  const pb = portPoint(b);
  return { type: "arc", corner: { x: pa.x + pb.x, y: pa.y + pb.y } };
}

function segment(from: Point, to: Point): Centreline {
  return { type: "segment", from, to };
}

/** The centrelines of every groove on a rotated piece */
export function grooveCentrelines(
  kind: PieceKind,
  rotation: number,
): Centreline[] {
  const ports = piecePorts(kind, rotation);
  switch (kind) {
    case "straight":
      return [segment(portPoint(ports[0]), portPoint(ports[1]))];
    case "curve":
      return [arcBetween(ports[0], ports[1])];
    case "tee":
      // Straight through, plus curved branches out of the side opening
      return [
        segment(portPoint(ports[1]), portPoint(ports[2])),
        segment(CENTRE, portPoint(ports[0])),
        arcBetween(ports[0], ports[1]),
        arcBetween(ports[0], ports[2]),
      ];
    case "cross":
      return [
        segment(portPoint("+x"), portPoint("-x")),
        segment(portPoint("+y"), portPoint("-y")),
      ];
    case "catcher":
      // A wide bowl to catch marbles, with a groove leading out
      return [
        { type: "bowl", radius: CATCHER_BOWL_RADIUS },
        segment(CENTRE, portPoint(ports[0])),
      ];
    case "block":
    case "tube":
    case "outlet":
    case "fan":
      return [];
  }
}

function distanceToCentreline(p: Point, line: Centreline): number {
  if (line.type === "bowl") return Number.POSITIVE_INFINITY;
  if (line.type === "segment") {
    const dx = line.to.x - line.from.x;
    const dy = line.to.y - line.from.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - line.from.x) * dx + (p.y - line.from.y) * dy) /
          (dx * dx + dy * dy),
      ),
    );
    return Math.hypot(p.x - line.from.x - dx * t, p.y - line.from.y - dy * t);
  }

  // The quarter circle lies on the side of the corner facing the piece
  const { corner } = line;
  const towardsX = (p.x - corner.x) * -Math.sign(corner.x);
  const towardsY = (p.y - corner.y) * -Math.sign(corner.y);
  if (towardsX >= 0 && towardsY >= 0) {
    return Math.abs(Math.hypot(p.x - corner.x, p.y - corner.y) - 0.5);
  }
  const ends = [
    { x: corner.x, y: corner.y - Math.sign(corner.y) * 0.5 },
    { x: corner.x - Math.sign(corner.x) * 0.5, y: corner.y },
  ];
  return Math.min(...ends.map((end) => Math.hypot(p.x - end.x, p.y - end.y)));
}

/** Distance from a point to the nearest groove centreline (bowls aside) */
export function grooveDistance(lines: Centreline[], p: Point): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    nearest = Math.min(nearest, distanceToCentreline(p, line));
  }
  return nearest;
}

/** Height of the wood surface at a point on a piece */
export function surfaceHeight(lines: Centreline[], p: Point): number {
  let height = 0.5;

  const d = grooveDistance(lines, p);
  if (d < GROOVE_HALF_WIDTH) {
    const r = GROOVE_PROFILE_RADIUS;
    height = 0.5 - GROOVE_DEPTH + (r - Math.sqrt(r * r - d * d));
  }

  // Bowls are a shallow spherical dish, as deep as a groove in the middle
  for (const line of lines) {
    if (line.type !== "bowl") continue;
    const distance = Math.hypot(p.x, p.y);
    if (distance >= line.radius) continue;
    const sphere = (line.radius ** 2 + GROOVE_DEPTH ** 2) / (2 * GROOVE_DEPTH);
    const bowl =
      0.5 - GROOVE_DEPTH + (sphere - Math.sqrt(sphere ** 2 - distance ** 2));
    height = Math.min(height, bowl);
  }

  return height;
}

/** Height of a marble's centre resting at a point on a piece */
export function marbleHeightAt(
  kind: PieceKind,
  rotation: number,
  p: Point,
): number {
  if (!hasGroove(kind)) return FLAT_REST_HEIGHT;
  // Marbles leave and enter tubes level with the track
  if (isTube(kind)) return GROOVE_REST_HEIGHT;
  const lines = grooveCentrelines(kind, rotation);
  return Math.min(FLAT_REST_HEIGHT, surfaceHeight(lines, p) + MARBLE_RADIUS);
}

/**
 * The route along the groove a marble follows to leave through `exit`,
 * used when it lands on a piece rather than rolling on from a neighbour
 */
export function routeToExit(
  kind: PieceKind,
  rotation: number,
  exit: Direction,
): Point[] {
  const ports = piecePorts(kind, rotation);
  const opposite = oppositeDirection(exit);
  if (ports.includes(opposite)) {
    return [portPoint(opposite), portPoint(exit)];
  }
  if (kind === "curve") {
    const other = ports.find((port) => port !== exit) ?? opposite;
    return quarterCircle(other, exit);
  }
  return [CENTRE, portPoint(exit)];
}

const ARC_SEGMENTS = 8;

/** Points along the quarter circle from one side opening to another */
export function quarterCircle(from: Direction, to: Direction): Point[] {
  const start = portPoint(from);
  const end = portPoint(to);
  const corner = { x: start.x + end.x, y: start.y + end.y };
  const startAngle = Math.atan2(start.y - corner.y, start.x - corner.x);
  let endAngle = Math.atan2(end.y - corner.y, end.x - corner.x);
  if (endAngle - startAngle > Math.PI) endAngle -= 2 * Math.PI;
  if (startAngle - endAngle > Math.PI) endAngle += 2 * Math.PI;

  const points: Point[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / ARC_SEGMENTS;
    points.push({
      x: corner.x + 0.5 * Math.cos(angle),
      y: corner.y + 0.5 * Math.sin(angle),
    });
  }
  return points;
}

/**
 * The nearest point on a polyline, and the index of the point after it, so
 * a marble can join the route part-way along
 */
export function nearestOnRoute(
  route: Point[],
  p: Point,
): { point: Point; next: number } {
  let best = { point: route[0], next: 1, distance: Number.POSITIVE_INFINITY };
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t =
      length === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
          );
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (distance < best.distance) best = { point, next: i, distance };
  }
  return { point: best.point, next: best.next };
}
