import type { Direction } from "../directions";
import type { Path } from "../paths";
import { type Vec3, visiblePart } from "../space";
import type { Piece } from "../track";
import { add, subtract } from "./vector";

/**
 * What a marble is doing. It's always exactly one of these, and each carries
 * what that kind of movement needs.
 */
export type Motion = Flying | Rolling | InTube | Held | Vanishing;

/** Flying through the air, moving with its velocity */
export interface Flying {
  mode: "flying";
}

/** Rolling along a path across a piece */
export interface Rolling {
  mode: "rolling";
  piece: Piece;
  path: Path;
  distance: number;
  exit: Direction;
  /** Side it rolled in from, or null if it landed on the piece */
  entry: Direction | null;
}

/** Inside a column of tubes, moving up or down it */
export interface InTube {
  mode: "tube";
  /** The column it's in */
  x: number;
  y: number;
  /** How far it is from the middle of the column, circling a funnel */
  offset: { x: number; y: number };
  /** Which way it circles round a funnel (±1) */
  spin: number;
  /**
   * Dropped in from above: it sinks to the bottom before a fan can blow it
   * back up, so it reaches the outlets below where it came in
   */
  sinking: boolean;
}

/** Waiting in a seesaw's cup */
export interface Held {
  mode: "held";
  piece: Piece;
  /** Which end of the seesaw (±1) */
  side: number;
}

/** Dropping into a hole, never to be seen again */
export interface Vanishing {
  mode: "vanishing";
  /** The middle of the hole */
  x: number;
  y: number;
  /** Once it's below this, it's gone */
  bottom: number;
}

export const FLYING: Flying = { mode: "flying" };

/** The designs marbles come in */
export const MARBLE_PATTERNS = [
  "swirl",
  "catsEye",
  "beachBall",
  "galaxy",
  "twoTone",
  "polkaDot",
] as const;

export type MarblePattern = (typeof MARBLE_PATTERNS)[number];

/** How a marble looks. It keeps the same look all its life. */
export interface MarbleLook {
  /** Its main colour (0-360) */
  hue: number;
  pattern: MarblePattern;
}

export interface Marble {
  id: string;
  look: MarbleLook;
  position: Vec3;
  motion: Motion;
  /** Velocity while flying (only its upward part counts inside a tube) */
  velocity: Vec3;
  /** Speed along the track while rolling */
  speed: number;
  /** Visible offset left over from a snap, eased away to hide the jump */
  visualOffset: Vec3;
  /** Horizontal distance travelled since the renderer last spun the marble */
  rolled: { x: number; y: number };
  /**
   * Whether the marble set off towards the camera. On the way down it can
   * land on pieces that look below it, even ones really closer to the camera.
   */
  headingForward: boolean;
}

export type SimulationEvent =
  | { type: "land"; marbleId: string; impact: number }
  /** A marble arrived on a piece, rolling or dropping in */
  | { type: "visit"; pieceId: string; marbleId: string }
  | { type: "hit"; impact: number }
  /** A marble that left the board, or fell into a hole */
  | { type: "removed"; marbleId: string }
  /** A new marble, let out by a dispenser */
  | { type: "added"; marbleId: string };

/** Where a falling marble comes down on a piece */
export interface Landing {
  piece: Piece;
  point: Vec3;
}

/** A marble's motion if it's in the given mode, or null */
export function motionAs<M extends Motion["mode"]>(
  marble: Marble,
  mode: M,
): Extract<Motion, { mode: M }> | null {
  const { motion } = marble;
  return motion.mode === mode ? (motion as Extract<Motion, { mode: M }>) : null;
}

/** Move to a point, spinning the marble as it goes */
export function rollTo(marble: Marble, point: Vec3) {
  marble.rolled.x += point.x - marble.position.x;
  marble.rolled.y += point.y - marble.position.y;
  marble.position = point;
}

/**
 * Jump to a new position. Movement along the line of sight is invisible;
 * any visible part is eased out by the renderer.
 */
export function snapTo(marble: Marble, point: Vec3) {
  const jump = visiblePart(subtract(marble.position, point));
  marble.visualOffset = add(marble.visualOffset, jump);
  marble.position = point;
}
