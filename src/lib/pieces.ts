import { type Direction, rotateDirection } from "./directions";

export type PieceKind =
  | "straight"
  | "curve"
  | "tee"
  | "cross"
  | "catcher"
  | "block";

interface PieceDefinition {
  kind: PieceKind;
  label: string;
  /** Keyboard shortcut for picking this piece */
  hotkey: string;
  /** Sides with a groove opening, before rotation */
  ports: Direction[];
  /**
   * Directions a marble may leave in, given the direction it was moving
   * when it arrived (null if it dropped straight onto the piece).
   * Defined before rotation; several options means pick one at random.
   */
  exits: (arriving: Direction | null) => Direction[];
}

const ALL: Direction[] = ["+x", "+y", "-x", "-y"];

const PIECE_DEFINITIONS: PieceDefinition[] = [
  {
    kind: "straight",
    label: "Straight",
    hotkey: "1",
    ports: ["+x", "-x"],
    exits: (arriving) =>
      arriving === "+x" || arriving === "-x" ? [arriving] : ["+x", "-x"],
  },
  {
    kind: "curve",
    label: "Curve",
    hotkey: "2",
    ports: ["+x", "+y"],
    exits: (arriving) => {
      if (arriving === "-x") return ["+y"];
      if (arriving === "-y") return ["+x"];
      return ["+x", "+y"];
    },
  },
  {
    kind: "tee",
    label: "Splitter",
    hotkey: "3",
    ports: ["+x", "-y", "+y"],
    exits: (arriving) => {
      if (arriving === "-x") return ["-y", "+y"];
      if (arriving === "-y" || arriving === "+y") return [arriving];
      return ["+x", "-y", "+y"];
    },
  },
  {
    kind: "cross",
    label: "Crossing",
    hotkey: "4",
    ports: ALL,
    exits: (arriving) => (arriving ? [arriving] : ALL),
  },
  {
    kind: "catcher",
    label: "Catcher",
    hotkey: "5",
    ports: ["+x"],
    exits: () => ["+x"],
  },
  {
    kind: "block",
    label: "Block",
    hotkey: "6",
    ports: [],
    exits: (arriving) => (arriving ? [arriving] : ALL),
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

/** Pieces with a groove hold the marble lower than a flat-topped block */
export function hasGroove(kind: PieceKind): boolean {
  return kind !== "block";
}
