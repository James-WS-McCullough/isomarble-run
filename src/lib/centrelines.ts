import { DIRECTION_VECTORS, type Direction } from "./directions";

/**
 * Building blocks for the grooves carved into the top of a piece.
 *
 * Coordinates are relative to the piece centre, before rotation. A groove
 * runs along a centreline; a piece can also have a round bowl or a round
 * flat-bottomed well in its middle.
 */

export interface Point {
  x: number;
  y: number;
}

export type Centreline =
  | { type: "segment"; from: Point; to: Point }
  | { type: "arc"; corner: Point }
  | { type: "bowl"; radius: number }
  | { type: "well"; radius: number; depth: number };

export const CENTRE: Point = { x: 0, y: 0 };

/** The middle of one side of a piece */
export function portPoint(side: Direction): Point {
  const v = DIRECTION_VECTORS[side];
  return { x: v.x / 2, y: v.y / 2 };
}

/** A straight groove between two points */
export function segment(from: Point, to: Point): Centreline {
  return { type: "segment", from, to };
}

/** A straight groove from one side to another */
export function across(a: Direction, b: Direction): Centreline {
  return segment(portPoint(a), portPoint(b));
}

/** A straight groove from the middle out to a side */
export function fromCentre(side: Direction): Centreline {
  return segment(CENTRE, portPoint(side));
}

/** Quarter circle of radius 0.5 joining two adjacent sides */
export function arcBetween(a: Direction, b: Direction): Centreline {
  const pa = portPoint(a);
  const pb = portPoint(b);
  return { type: "arc", corner: { x: pa.x + pb.x, y: pa.y + pb.y } };
}

/** Rotate a point by quarter turns; one turn takes +x to +y */
export function rotatePoint(p: Point, turns: number): Point {
  let { x, y } = p;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x, y] = [-y, x];
  return { x, y };
}

/** Rotate a centreline by quarter turns */
export function rotateCentreline(line: Centreline, turns: number): Centreline {
  switch (line.type) {
    case "segment":
      return {
        type: "segment",
        from: rotatePoint(line.from, turns),
        to: rotatePoint(line.to, turns),
      };
    case "arc":
      return { type: "arc", corner: rotatePoint(line.corner, turns) };
    case "bowl":
    case "well":
      // Round, in the middle: the same however it's turned
      return line;
  }
}
