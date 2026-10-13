import {
  DIRECTION_VECTORS,
  type Direction,
  directionOfVelocity,
  oppositeDirection,
} from "../directions";
import { nearestOnRoute, routeToExit } from "../grooves";
import { Path, routeBetween } from "../paths";
import { isFlatTopped, isTube, pieceExits, piecePorts } from "../pieces";
import {
  depthOf,
  fromScreen,
  SQRT2,
  SQRT6,
  screenOf,
  type Vec3,
} from "../space";
import { type Piece, restHeight, TrackIndex } from "../track";
import { BEHAVIOURS, type World } from "./behaviours";
import { collideMarbles } from "./collisions";
import { Dispensers } from "./dispensers";
import { stepVanishing } from "./holes";
import { findLanding } from "./landing";
import {
  FLYING,
  type Landing,
  MARBLE_PATTERNS,
  type Marble,
  motionAs,
  rollTo,
  type SimulationEvent,
  snapTo,
} from "./marble";
import { PHYSICS } from "./physics";
import { densify, overTheRim, pathOnPiece, pick } from "./routes";
import { Seesaws } from "./seesaws";
import { Switches } from "./switches";
import { catchFromBelow, stepInTube, tubeCell } from "./tubes";
import { clamp, scale } from "./vector";
import { bounceOffWalls } from "./walls";

export type {
  Flying,
  Held,
  InTube,
  Marble,
  MarbleLook,
  MarblePattern,
  Motion,
  Rolling,
  SimulationEvent,
} from "./marble";
export { MARBLE_PATTERNS, motionAs } from "./marble";
export { PHYSICS } from "./physics";

/** Where marbles can be on screen before they wrap round or are removed */
interface Bounds {
  bottom: number;
  top: number;
  maxRight: number;
  frontDepth: number;
}

let marbleCounter = 0;

/** Stepping round the colour wheel by this keeps colours far apart */
const GOLDEN_ANGLE = 137.508;

/**
 * Marbles rolling and falling over a track. Call `advance` every frame.
 *
 * This is the hub: it moves each marble according to its motion, and hands
 * landing on or rolling onto a piece over to that piece's behaviour. Tubes,
 * fans and funnels live in ./tubes, seesaws in ./seesaws, where falling
 * marbles land in ./landing, and marbles bumping into each other in
 * ./collisions.
 */
export class Simulation {
  marbles: Marble[] = [];
  private track = new TrackIndex([]);
  private bounds: Bounds = computeBounds([]);
  private leftoverTime = 0;
  private readonly random: () => number;
  private readonly seesaws: Seesaws;
  private readonly dispensers = new Dispensers();
  private readonly switches = new Switches();

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.seesaws = new Seesaws();
  }

  /** What special pieces' behaviours can reach */
  private get world(): World {
    return {
      track: this.track,
      seesaws: this.seesaws,
      switches: this.switches,
    };
  }

  /** Replace the track. Marbles on pieces that changed fall off. */
  setPieces(pieces: Piece[]) {
    this.track = new TrackIndex(pieces);
    this.bounds = computeBounds(pieces);

    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    this.seesaws.keepOnly(byId);
    this.dispensers.keepOnly(pieces);
    this.switches.keepOnly(byId);
    for (const marble of this.marbles) {
      const { motion } = marble;
      if (motion.mode === "rolling" || motion.mode === "held") {
        const piece = byId.get(motion.piece.id);
        if (piece && samePlacement(piece, motion.piece)) {
          motion.piece = piece;
        } else if (motion.mode === "rolling") {
          this.launch(marble, motion.exit);
        } else {
          marble.motion = FLYING;
        }
      } else if (
        motion.mode === "tube" &&
        tubeCell(this.track, motion, marble.position.z) === null
      ) {
        marble.motion = FLYING;
      }
    }
  }

  /**
   * Drop a marble at a point on screen. It starts in front of everything,
   * so it lands on whatever it appears to fall onto.
   */
  addMarble(pointOnScreen: Vec3): Marble {
    const { right, up } = screenOf(pointOnScreen);
    return this.createMarble(fromScreen(right, up, this.bounds.frontDepth));
  }

  /** A new marble at a point, in its own colour and design */
  private createMarble(position: Vec3): Marble {
    marbleCounter += 1;
    const marble: Marble = {
      id: `marble-${marbleCounter}`,
      look: {
        // Each marble a quite different colour from the last
        hue: (marbleCounter * GOLDEN_ANGLE) % 360,
        pattern: pick([...MARBLE_PATTERNS], this.random),
      },
      position,
      motion: FLYING,
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      visualOffset: { x: 0, y: 0, z: 0 },
      rolled: { x: 0, y: 0 },
      headingForward: true,
    };
    this.marbles.push(marble);
    return marble;
  }

  clearMarbles() {
    this.marbles = [];
    this.seesaws.clear();
  }

  /** Which branch a flip-flop sends the next marble down (its own -y or +y) */
  switchSide(pieceId: string): Direction {
    return this.switches.side(pieceId);
  }

  /** How far a seesaw is tipped (radians; positive lowers its +1 end) */
  seesawTilt(pieceId: string): number {
    return this.seesaws.tilt(pieceId);
  }

  /** Move the simulation forward by `seconds`, in small fixed steps */
  advance(seconds: number): SimulationEvent[] {
    const events: SimulationEvent[] = [];
    this.leftoverTime = Math.min(this.leftoverTime + seconds, 0.1);
    while (this.leftoverTime >= PHYSICS.STEP) {
      this.leftoverTime -= PHYSICS.STEP;
      this.step(PHYSICS.STEP, events);
    }
    return events;
  }

  private step(dt: number, events: SimulationEvent[]) {
    const decay = Math.exp(-PHYSICS.SMOOTHING * dt);
    const kept: Marble[] = [];

    for (const marble of this.marbles) {
      const { motion } = marble;
      if (motion.mode === "rolling") {
        this.stepRolling(marble, dt, events);
      } else if (motion.mode === "tube") {
        const landing = stepInTube(this.track, marble, motion, dt, events);
        if (landing) this.land(marble, landing, events);
      } else if (motion.mode === "held") {
        this.seesaws.stepHeld(marble, motion);
      } else if (
        motion.mode === "vanishing"
          ? !stepVanishing(marble, motion, dt)
          : !this.stepFlying(marble, dt, events)
      ) {
        events.push({ type: "removed", marbleId: marble.id });
        continue;
      }
      marble.visualOffset = scale(marble.visualOffset, decay);
      kept.push(marble);
    }

    this.marbles = kept;
    collideMarbles(this.marbles, this.track, this.random, events);
    this.seesaws.step(dt, this.marbles);

    for (const id of this.dispensers.step(dt, this.marbles.length)) {
      const dispenser = this.track.pieces.find((piece) => piece.id === id);
      if (dispenser) this.dispense(dispenser, events);
    }
  }

  /** Let a new marble out of a dispenser, rolling out of its side */
  private dispense(dispenser: Piece, events: SimulationEvent[]) {
    const exit = piecePorts(dispenser.kind, dispenser.rotation)[0];
    const v = DIRECTION_VECTORS[exit];
    const path = pathOnPiece(
      dispenser,
      densify([
        { x: 0, y: 0 },
        { x: v.x / 2, y: v.y / 2 },
      ]),
    );
    const marble = this.createMarble(path.points[0]);
    marble.speed = PHYSICS.CRUISE_SPEED;
    marble.motion = {
      mode: "rolling",
      piece: dispenser,
      path,
      distance: 0,
      exit,
      entry: null,
    };
    events.push({ type: "added", marbleId: marble.id });
  }

  private stepRolling(marble: Marble, dt: number, events: SimulationEvent[]) {
    if (marble.speed < PHYSICS.CRUISE_SPEED) {
      marble.speed = Math.min(
        PHYSICS.CRUISE_SPEED,
        marble.speed + PHYSICS.CRUISE_ACCELERATION * dt,
      );
    } else {
      marble.speed =
        PHYSICS.CRUISE_SPEED +
        (marble.speed - PHYSICS.CRUISE_SPEED) *
          Math.exp(-PHYSICS.FRICTION * dt);
    }

    let travel = marble.speed * dt;
    // A marble can cross a few short paths in one step
    for (let hops = 0; hops < 4; hops++) {
      const rolling = motionAs(marble, "rolling");
      if (!rolling) return;
      const remaining = rolling.path.length - rolling.distance;
      if (travel < remaining) {
        rolling.distance += travel;
        rollTo(marble, rolling.path.pointAt(rolling.distance));
        return;
      }

      travel -= remaining;
      rolling.distance = rolling.path.length;
      rollTo(marble, rolling.path.pointAt(rolling.distance));

      const next = this.track.findConnection(rolling.piece, rolling.exit);
      if (next) {
        this.enterPiece(
          marble,
          next,
          rolling.exit,
          isFlatTopped(rolling.piece.kind),
          events,
        );
      } else {
        this.launch(marble, rolling.exit);
      }
    }
  }

  /** Returns false if the marble left the play area */
  private stepFlying(
    marble: Marble,
    dt: number,
    events: SimulationEvent[],
  ): boolean {
    const before = marble.position;
    const v = marble.velocity;
    // Falling speed tops out, like air resistance would
    v.z = Math.max(v.z - PHYSICS.GRAVITY * dt, -PHYSICS.MAX_SPEED);
    rollTo(marble, {
      x: before.x + v.x * dt,
      y: before.y + v.y * dt,
      z: before.z + v.z * dt,
    });
    const after = marble.position;

    if (catchFromBelow(this.track, marble, before, after)) return true;

    // Landing on a face it visibly reaches wins over clipping the wall
    // underneath that face
    const landing = findLanding(this.track, marble, before, after);
    if (landing) {
      this.land(marble, landing, events);
      return true;
    }

    bounceOffWalls(this.track, marble, before);

    const { right, up } = screenOf(marble.position);
    if (Math.abs(right) > this.bounds.maxRight) return false;
    if (up < this.bounds.bottom) {
      // Fell off the bottom: come back in at the top, in front of everything
      marble.position = fromScreen(
        right,
        this.bounds.top,
        this.bounds.frontDepth,
      );
      marble.headingForward = true;
    }
    return true;
  }

  /** Come down on a piece from the air */
  private land(marble: Marble, landing: Landing, events: SimulationEvent[]) {
    const { piece, point } = landing;
    const special = BEHAVIOURS[piece.kind]?.land;
    if (special) {
      special(this.world, marble, landing, events);
      return;
    }

    // Settle into its groove, and roll out the way it was heading
    const v = marble.velocity;
    const horizontal = Math.hypot(v.x, v.y);
    const arriving = directionOfVelocity(v.x, v.y, PHYSICS.DROP_SPEED);
    const exit = this.chooseExit(piece, arriving);

    // Settle from where it landed into the groove, then follow it out
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

    marble.speed = Math.min(
      PHYSICS.MAX_SPEED,
      horizontal * PHYSICS.LANDING_KEEP_HORIZONTAL +
        Math.abs(v.z) * PHYSICS.LANDING_KEEP_VERTICAL,
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

    events.push({ type: "land", marbleId: marble.id, impact: Math.abs(v.z) });
    events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
  }

  /**
   * Roll onto a piece from a neighbour. `fromFlat` is true when coming off a
   * flat-topped block, level with the top of the piece rather than down in
   * a groove.
   */
  private enterPiece(
    marble: Marble,
    piece: Piece,
    arriving: Direction,
    fromFlat: boolean,
    events: SimulationEvent[],
  ) {
    const special = BEHAVIOURS[piece.kind]?.rollIn;
    if (special?.(this.world, marble, piece, arriving, events)) return;

    const entrySide = oppositeDirection(arriving);
    const intoOpening = piecePorts(piece.kind, piece.rotation).includes(
      entrySide,
    );
    const throughSide = !isFlatTopped(piece.kind) && !intoOpening;

    // From down in a groove, a side with no opening is a solid wall, and
    // the glass sides of a tube always are
    if (throughSide && (!fromFlat || isTube(piece.kind))) {
      // Touch the wall at groove height, then head back
      const side = DIRECTION_VECTORS[entrySide];
      const edge = {
        x: piece.cell.x + side.x / 2,
        y: piece.cell.y + side.y / 2,
        z: piece.cell.z + restHeight(piece.kind),
      };
      const wall = new Path([edge, edge]);
      marble.speed *= PHYSICS.BOUNCE_KEEP;
      snapTo(marble, wall.points[0]);
      marble.motion = {
        mode: "rolling",
        piece,
        path: wall,
        distance: 0,
        exit: entrySide,
        entry: null,
      };
      return;
    }

    const exit = this.chooseExit(piece, arriving);
    const route = throughSide
      ? overTheRim(piece, entrySide, exit)
      : routeBetween(entrySide, exit);
    const path = pathOnPiece(piece, route.points, route.turns);

    if (route.turns) marble.speed *= PHYSICS.TURN_KEEP;
    if (entrySide === exit) marble.speed *= PHYSICS.BOUNCE_KEEP;

    snapTo(marble, path.points[0]);
    marble.motion = {
      mode: "rolling",
      piece,
      path,
      distance: 0,
      exit,
      entry: entrySide,
    };
    events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
  }

  /** Which way a marble leaves a piece it lands or rolls on */
  private chooseExit(piece: Piece, arriving: Direction | null): Direction {
    const chosen = BEHAVIOURS[piece.kind]?.chooseExit?.(
      this.world,
      piece,
      arriving,
    );
    return (
      chosen ??
      pick(pieceExits(piece.kind, piece.rotation, arriving), this.random)
    );
  }

  /** Roll off the end of the track into the air */
  private launch(marble: Marble, direction: Direction) {
    const v = DIRECTION_VECTORS[direction];
    marble.velocity = { x: v.x * marble.speed, y: v.y * marble.speed, z: 0 };
    marble.motion = FLYING;

    // Heading towards the camera, it can land on anything that looks below
    // it. Heading away, it drops behind pieces that are in front of it.
    marble.headingForward = direction === "+x" || direction === "+y";
  }
}

function computeBounds(pieces: Piece[]): Bounds {
  const extent = PHYSICS.GRID_EXTENT;
  let bottom = (-2 * extent) / SQRT6;
  let top = (2 * extent) / SQRT6;
  let maxRight = (2 * extent) / SQRT2;
  let frontDepth = 0;

  for (const piece of pieces) {
    const { right, up } = screenOf(piece.cell);
    bottom = Math.min(bottom, up);
    top = Math.max(top, up);
    maxRight = Math.max(maxRight, Math.abs(right));
    frontDepth = Math.max(frontDepth, depthOf(piece.cell));
  }

  return {
    bottom: bottom - 2.5,
    top: top + 1.5,
    maxRight: maxRight + 2,
    frontDepth: frontDepth + 4,
  };
}

function samePlacement(a: Piece, b: Piece): boolean {
  return (
    a.kind === b.kind &&
    a.rotation === b.rotation &&
    a.cell.x === b.cell.x &&
    a.cell.y === b.cell.y &&
    a.cell.z === b.cell.z
  );
}
