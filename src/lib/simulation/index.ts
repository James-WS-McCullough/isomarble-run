import {
  DIRECTION_VECTORS,
  type Direction,
  directionOfVelocity,
  oppositeDirection,
} from "../directions";
import { isUpsideDown } from "../funnel";
import { nearestOnRoute, routeToExit } from "../grooves";
import { Path, routeBetween } from "../paths";
import { hasGroove, isTube, pieceExits, piecePorts } from "../pieces";
import {
  depthOf,
  fromScreen,
  SQRT2,
  SQRT6,
  screenOf,
  type Vec3,
} from "../space";
import { type Piece, restHeight, TrackIndex } from "../track";
import { collideMarbles } from "./collisions";
import { findLanding } from "./landing";
import {
  changeColour,
  FLYING,
  type Landing,
  type Marble,
  motionAs,
  rollTo,
  type SimulationEvent,
  snapTo,
} from "./marble";
import { PHYSICS } from "./physics";
import { densify, overTheRim, pathOnPiece, pick } from "./routes";
import { Seesaws } from "./seesaws";
import {
  blowUp,
  catchFromBelow,
  enterTube,
  stepInTube,
  tubeCell,
} from "./tubes";
import { clamp, scale } from "./vector";
import { bounceOffWalls } from "./walls";

export type {
  Flying,
  Held,
  InTube,
  Marble,
  Motion,
  Rolling,
  SimulationEvent,
} from "./marble";
export { motionAs } from "./marble";
export { PHYSICS } from "./physics";

/** Where marbles can be on screen before they wrap round or are removed */
interface Bounds {
  bottom: number;
  top: number;
  maxRight: number;
  frontDepth: number;
}

let marbleCounter = 0;

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

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.seesaws = new Seesaws(random);
  }

  /** Replace the track. Marbles on pieces that changed fall off. */
  setPieces(pieces: Piece[]) {
    this.track = new TrackIndex(pieces);
    this.bounds = computeBounds(pieces);

    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    this.seesaws.keepOnly(byId);
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
    marbleCounter += 1;
    const marble: Marble = {
      id: `marble-${marbleCounter}`,
      hue: Math.floor(this.random() * 360),
      position: fromScreen(right, up, this.bounds.frontDepth),
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
      } else if (!this.stepFlying(marble, dt, events)) {
        events.push({ type: "removed", marbleId: marble.id });
        continue;
      }
      marble.visualOffset = scale(marble.visualOffset, decay);
      kept.push(marble);
    }

    this.marbles = kept;
    collideMarbles(this.marbles, this.track, this.random, events);
    this.seesaws.step(dt, this.marbles);
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
          !hasGroove(rolling.piece.kind),
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
    const v = marble.velocity;

    if (piece.kind === "seesaw") {
      marble.position = point;
      this.seesaws.land(marble, piece, events);
      return;
    }

    // Dropping onto a fan: blown back up
    if (piece.kind === "fan") {
      events.push({
        type: "land",
        marbleId: marble.id,
        impact: Math.abs(v.z),
      });
      blowUp(this.track, marble, piece, point, events);
      return;
    }

    // Falling into the top of a tube, or anywhere on a funnel
    if (isTube(piece.kind)) {
      marble.position = point;
      enterTube(marble, piece, point.z, Math.min(v.z, 0), point);
      events.push({
        type: "land",
        marbleId: marble.id,
        impact: Math.abs(v.z) / 3,
      });
      return;
    }

    const horizontal = Math.hypot(v.x, v.y);
    const arriving = directionOfVelocity(v.x, v.y, PHYSICS.DROP_SPEED);
    const exit = pick(
      pieceExits(piece.kind, piece.rotation, arriving),
      this.random,
    );

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
    events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
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
    const entrySide = oppositeDirection(arriving);
    const intoOpening = piecePorts(piece.kind, piece.rotation).includes(
      entrySide,
    );
    const throughSide = hasGroove(piece.kind) && !intoOpening;
    const { x, y, z } = piece.cell;
    const heading = DIRECTION_VECTORS[arriving];
    const side = DIRECTION_VECTORS[entrySide];
    // Where it comes in, level with the track
    const edge = {
      x: x + side.x / 2,
      y: y + side.y / 2,
      z: z + restHeight(piece.kind),
    };
    const goOnFlying = () => {
      marble.motion = FLYING;
      marble.velocity = {
        x: heading.x * marble.speed,
        y: heading.y * marble.speed,
        z: 0,
      };
    };

    // Rolling off the track into a seesaw: drop into the cup there
    if (piece.kind === "seesaw") {
      goOnFlying();
      this.seesaws.land(marble, piece, events);
      return;
    }

    // Rolling in over a funnel's rim: circle down into it
    if (piece.kind === "funnel" && !isUpsideDown(piece)) {
      goOnFlying();
      enterTube(marble, piece, edge.z, -0.01, edge);
      events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
      return;
    }

    // Rolling into an outlet's spout: drop down the tube
    if (piece.kind === "outlet" && intoOpening) {
      enterTube(marble, piece, z + restHeight(piece.kind), -0.5);
      events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
      return;
    }

    // Rolling onto a fan, from any side: blown upwards
    if (piece.kind === "fan") {
      goOnFlying();
      blowUp(this.track, marble, piece, edge, events);
      return;
    }

    // From down in a groove, a side with no opening is a solid wall, and
    // the glass sides of a tube always are
    if (throughSide && (!fromFlat || isTube(piece.kind))) {
      // Touch the wall at groove height, then head back
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

    const exit = pick(
      pieceExits(piece.kind, piece.rotation, arriving),
      this.random,
    );
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
    events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
  }

  /** Roll off the end of the track into the air */
  private launch(marble: Marble, direction: Direction) {
    const v = DIRECTION_VECTORS[direction];
    marble.velocity = { x: v.x * marble.speed, y: v.y * marble.speed, z: 0 };
    marble.motion = FLYING;

    // Heading towards the camera, it can land on anything that looks below
    // it. Heading away, it drops behind pieces that are in front of it.
    marble.headingForward = direction === "+x" || direction === "+y";

    changeColour(marble, this.random);
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
