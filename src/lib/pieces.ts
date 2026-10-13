import {
  across,
  arcBetween,
  type Centreline,
  fromCentre,
  rotateCentreline,
} from "./centrelines";
import { type Direction, rotateDirection } from "./directions";

/**
 * Every kind of piece: what it's called, its shape and the rules that set
 * it apart. What special pieces do to marbles lives in
 * simulation/behaviours.ts, and their 3D models and icons are looked up by
 * kind in three/PieceMesh.tsx and components/PieceIcon.tsx.
 */

export type PieceKind =
  | "straight"
  | "curve"
  | "tee"
  | "cross"
  | "catcher"
  | "block"
  | "tube"
  | "outlet"
  | "funnel"
  | "fan"
  | "seesaw"
  | "dispenser"
  | "hole"
  | "flipflop";

interface PieceDefinition {
  kind: PieceKind;
  label: string;
  /** Sides with a groove opening, before rotation */
  ports: Direction[];
  /**
   * Directions a marble may leave in, given the direction it was moving
   * when it arrived (null if it dropped straight onto the piece).
   * Defined before rotation; several options means pick one at random.
   */
  exits: (arriving: Direction | null) => Direction[];
  /** The grooves carved into its top, before rotation */
  grooves: Centreline[];
  /**
   * A plain flat top: marbles rest on it and roll across it from any side.
   * Otherwise marbles sit down in its grooves, and its sides without an
   * opening are walls.
   */
  flatTop?: boolean;
  /** Part of a column of glass tubes, which marbles travel up and down */
  tube?: boolean;
  /** Blows marbles up a column of tubes stacked on top of it */
  blowsUp?: boolean;
  /** Mostly open space: flying marbles pass through rather than bounce off */
  open?: boolean;
  /** How many tiles long it is along its x axis, centred on its own tile */
  length?: number;
  /**
   * How many ways R can turn it: the four directions, unless it's round
   * (fewer) or can also be flipped upside down (the upside-down turns come
   * after the upright ones)
   */
  orientations?: number;
  /** Whether turning it can flip it upside down */
  flips?: boolean;
}

const ALL: Direction[] = ["+x", "+y", "-x", "-y"];
/** Any way it likes when it lands, otherwise straight on */
const ANY_WAY = (arriving: Direction | null) => (arriving ? [arriving] : ALL);

/** The well in the middle of a fan's crossroads that the fan sits in */
export const FAN_WELL = { RADIUS: 0.3, DEPTH: 0.3 };

/** The hole marbles vanish into */
export const HOLE = { RADIUS: 0.27, DEPTH: 0.46 };

/** Radius of the round dip in the middle of a catcher */
export const CATCHER_BOWL_RADIUS = 0.42;

const PIECE_DEFINITIONS: PieceDefinition[] = [
  {
    kind: "straight",
    label: "Straight",
    ports: ["+x", "-x"],
    exits: (arriving) =>
      arriving === "+x" || arriving === "-x" ? [arriving] : ["+x", "-x"],
    grooves: [across("+x", "-x")],
  },
  {
    kind: "curve",
    label: "Curve",
    ports: ["+x", "+y"],
    exits: (arriving) => {
      if (arriving === "-x") return ["+y"];
      if (arriving === "-y") return ["+x"];
      return ["+x", "+y"];
    },
    grooves: [arcBetween("+x", "+y")],
  },
  {
    kind: "tee",
    label: "Splitter",
    ports: ["+x", "-y", "+y"],
    exits: (arriving) => {
      if (arriving === "-x") return ["-y", "+y"];
      if (arriving === "-y" || arriving === "+y") return [arriving];
      return ["+x", "-y", "+y"];
    },
    // Straight through, plus curved branches out of the side opening
    grooves: [
      across("-y", "+y"),
      fromCentre("+x"),
      arcBetween("+x", "-y"),
      arcBetween("+x", "+y"),
    ],
  },
  {
    kind: "cross",
    label: "Crossing",
    ports: ALL,
    exits: ANY_WAY,
    grooves: [across("+x", "-x"), across("+y", "-y")],
  },
  {
    kind: "catcher",
    label: "Catcher",
    ports: ["+x"],
    exits: () => ["+x"],
    // A wide bowl to catch marbles, with a groove leading out
    grooves: [{ type: "bowl", radius: CATCHER_BOWL_RADIUS }, fromCentre("+x")],
  },
  {
    // A wide glass funnel on top of a tube: marbles that land anywhere on
    // it, or roll in over its rim, spiral down into the tube below. Turned
    // upside down, it catches marbles blown up from below.
    kind: "funnel",
    label: "Funnel",
    ports: [],
    exits: ANY_WAY,
    grooves: [],
    tube: true,
    // It's round, so turning it just flips it over
    orientations: 2,
    flips: true,
  },
  {
    kind: "block",
    label: "Block",
    ports: [],
    exits: ANY_WAY,
    grooves: [],
    flatTop: true,
  },
  {
    // A vertical glass tube: marbles fall down it, or get blown up it
    kind: "tube",
    label: "Tube",
    ports: [],
    exits: ANY_WAY,
    grooves: [],
    tube: true,
  },
  {
    // A tube with a spout at the top: marbles blown up it leave through the
    // spout, and marbles rolling into the spout drop down the tube. Upside
    // down, the spout is at the bottom: marbles dropping down the tube come
    // out of it onto the track one level down.
    kind: "outlet",
    label: "Outlet",
    ports: ["+x"],
    exits: () => ["+x"],
    grooves: [],
    tube: true,
    orientations: 8,
    flips: true,
  },
  {
    // A crossroads with a fan set into the middle: marbles that roll or
    // drop onto it are blown upwards, and up any tube above it
    kind: "fan",
    label: "Fan",
    ports: ALL,
    exits: ANY_WAY,
    grooves: [
      across("+x", "-x"),
      across("+y", "-y"),
      { type: "well", radius: FAN_WELL.RADIUS, depth: FAN_WELL.DEPTH },
    ],
    blowsUp: true,
  },
  {
    // A seesaw with a cup at each end along x. A marble waits in the low
    // cup; one landing in the high cup tips it over and flings the waiting
    // marble into the air.
    kind: "seesaw",
    label: "Seesaw",
    ports: [],
    exits: ANY_WAY,
    grooves: [],
    open: true,
    length: 3,
  },
  {
    // Shaped like a splitter, with a flipper where the branches meet.
    // Marbles coming down the stem go the way the flipper points and knock
    // it over, so they take turns down each branch. Marbles coming up a
    // branch join the stem.
    kind: "flipflop",
    label: "Flip-flop",
    ports: ["+x", "-y", "+y"],
    exits: (arriving) =>
      arriving === "-y" || arriving === "+y" ? ["+x"] : ["-y", "+y"],
    grooves: [
      across("-y", "+y"),
      fromCentre("+x"),
      arcBetween("+x", "-y"),
      arcBetween("+x", "+y"),
    ],
  },
  {
    // A hopper full of marbles that lets one roll out of its side every
    // couple of seconds
    kind: "dispenser",
    label: "Dispenser",
    ports: ["+x"],
    exits: () => ["+x"],
    grooves: [fromCentre("+x")],
  },
  {
    // A crossroads with a deep hole in the middle: marbles that roll or drop
    // onto it fall in and are gone
    kind: "hole",
    label: "Hole",
    ports: ALL,
    exits: ANY_WAY,
    grooves: [
      across("+x", "-x"),
      across("+y", "-y"),
      { type: "well", radius: HOLE.RADIUS, depth: HOLE.DEPTH },
    ],
  },
];

export const PIECES = PIECE_DEFINITIONS;

const PIECES_BY_KIND = new Map(
  PIECE_DEFINITIONS.map((piece) => [piece.kind, piece]),
);

export function getPiece(kind: PieceKind): PieceDefinition {
  const piece = PIECES_BY_KIND.get(kind);
  if (!piece) throw new Error(`Unknown piece kind: ${kind}`);
  return piece;
}

/** Groove openings of a piece after rotating it by quarter turns */
export function piecePorts(kind: PieceKind, rotation: number): Direction[] {
  return getPiece(kind).ports.map((port) => rotateDirection(port, rotation));
}

/** Where a rotated piece can send a marble arriving in a given direction */
export function pieceExits(
  kind: PieceKind,
  rotation: number,
  arriving: Direction | null,
): Direction[] {
  const localArriving = arriving ? rotateDirection(arriving, -rotation) : null;
  return getPiece(kind)
    .exits(localArriving)
    .map((exit) => rotateDirection(exit, rotation));
}

/** The centrelines of every groove on a rotated piece */
export function grooveCentrelines(
  kind: PieceKind,
  rotation: number,
): Centreline[] {
  return getPiece(kind).grooves.map((line) => rotateCentreline(line, rotation));
}

/**
 * Whether a piece has a plain flat top that marbles roll across, rather
 * than grooves they sit down in, with walls between the openings
 */
export function isFlatTopped(kind: PieceKind): boolean {
  return getPiece(kind).flatTop === true;
}

/** Glass tubes, outlets and funnels, which marbles travel up and down inside */
export function isTube(kind: PieceKind): boolean {
  return getPiece(kind).tube === true;
}

/**
 * Whether a tube stacked on top of a piece is joined to it: tubes join each
 * other, and fans blow up into them. Other pieces under a tube are just
 * where marbles dropping out of its bottom land.
 */
export function joinsTubeAbove(kind: PieceKind): boolean {
  const piece = getPiece(kind);
  return piece.tube === true || piece.blowsUp === true;
}

/** Whether flying marbles bounce off a piece's sides */
export function isSolid(kind: PieceKind): boolean {
  return getPiece(kind).open !== true;
}

/** How many tiles long a piece is along its x axis */
export function pieceLength(kind: PieceKind): number {
  return getPiece(kind).length ?? 1;
}

/** How many ways R can turn a piece */
export function orientations(kind: PieceKind): number {
  return getPiece(kind).orientations ?? 4;
}

/** A rotation brought into range for a kind of piece */
export function normaliseRotation(kind: PieceKind, rotation: number): number {
  const count = orientations(kind);
  return ((rotation % count) + count) % count;
}

/** Whether a piece is turned upside down: its later turns, if it flips */
export function isUpsideDown(piece: {
  kind: PieceKind;
  rotation: number;
}): boolean {
  if (getPiece(piece.kind).flips !== true) return false;
  const turn = normaliseRotation(piece.kind, piece.rotation);
  return turn >= orientations(piece.kind) / 2;
}

/**
 * How many levels below a piece its side openings are. An upside-down
 * piece's are at its bottom, level with the track one level down. (A piece
 * with no openings, like a funnel, stays where it is.)
 */
export function portLevel(piece: {
  kind: PieceKind;
  rotation: number;
}): number {
  const hasOpenings = getPiece(piece.kind).ports.length > 0;
  return hasOpenings && isUpsideDown(piece) ? -1 : 0;
}
