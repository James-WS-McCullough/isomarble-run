import {
  DIRECTION_VECTORS,
  type Direction,
  oppositeDirection,
  rotateDirection,
} from "../directions";
import {
  downhill,
  isSloped,
  isUpsideDown,
  type PieceKind,
  piecePorts,
} from "../pieces";
import type { Vec3 } from "../space";
import { type Piece, restHeight, type TrackIndex } from "../track";
import { fallIntoHole } from "./holes";
import {
  FLYING,
  type Landing,
  type Marble,
  motionAs,
  type Rolling,
  type SimulationEvent,
  snapTo,
} from "./marble";
import { PHYSICS } from "./physics";
import { densify, pathOnPiece, settle } from "./routes";
import type { Seesaws } from "./seesaws";
import { pushesFlipFlop, type Switches } from "./switches";
import { blowUp, enterTube } from "./tubes";
import { scale } from "./vector";
import { enterVortex } from "./vortex";

/** What a piece's behaviour can reach */
export interface World {
  track: TrackIndex;
  seesaws: Seesaws;
  switches: Switches;
}

/**
 * What a special piece does to a marble. Ordinary grooved and flat pieces
 * have no entry here: marbles land on them and roll along their grooves.
 */
export interface PieceBehaviour {
  /** A marble comes down on the piece from the air */
  land?(
    world: World,
    marble: Marble,
    landing: Landing,
    events: SimulationEvent[],
  ): void;
  /**
   * A marble rolls onto the piece from a neighbour, heading `arriving`.
   * Return false to let it roll on (or bounce off a wall) as normal.
   */
  rollIn?(
    world: World,
    marble: Marble,
    piece: Piece,
    arriving: Direction,
    events: SimulationEvent[],
  ): boolean;
  /**
   * A marble reaches the end of its path across the piece. Return true if
   * the piece sent it on somewhere itself; false to roll on to the next
   * piece as usual.
   */
  leave?(
    world: World,
    marble: Marble,
    rolling: Rolling,
    events: SimulationEvent[],
  ): boolean;
  /**
   * Which way a marble leaves, for a piece that decides for itself rather
   * than picking from its exits at random. Undefined to pick as usual.
   */
  chooseExit?(
    world: World,
    piece: Piece,
    arriving: Direction | null,
  ): Direction | undefined;
}

/** Falling into the top of a tube, or anywhere on a funnel */
const intoTheTop: PieceBehaviour["land"] = (
  _world,
  marble,
  landing,
  events,
) => {
  const v = marble.velocity;
  marble.position = landing.point;
  enterTube(
    marble,
    landing.piece,
    landing.point.z,
    Math.min(v.z, 0),
    landing.point,
  );
  events.push({ type: "land", marbleId: marble.id, impact: Math.abs(v.z) / 3 });
  events.push({
    type: "visit",
    pieceId: landing.piece.id,
    marbleId: marble.id,
  });
};

export const BEHAVIOURS: Partial<Record<PieceKind, PieceBehaviour>> = {
  ramp: {
    // Coming down on a ramp: it keeps the part of its speed along the
    // slope, and rolls whichever way that takes it
    land(_world, marble, landing, events) {
      const { piece, point } = landing;
      const down = downhill(piece.rotation);
      const d = DIRECTION_VECTORS[down];
      const v = marble.velocity;
      const across = v.x * d.x + v.y * d.y;
      const along = (across - v.z) * Math.SQRT1_2;
      const impact = Math.abs(across + v.z) * Math.SQRT1_2;
      settle(marble, piece, point, along >= 0 ? down : oppositeDirection(down));
      marble.speed = Math.min(PHYSICS.MAX_SPEED, Math.abs(along));
      events.push({ type: "land", marbleId: marble.id, impact });
      events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
    },
    // Rolling fast off level track over the top of a ramp: off the lip and
    // into the air. Coming down another ramp, the slope just carries on.
    rollIn(_world, marble, piece, arriving) {
      if (arriving !== downhill(piece.rotation)) return false;
      if (marble.speed <= PHYSICS.LIP_JUMP_SPEED) return false;
      const before = motionAs(marble, "rolling");
      const level =
        !before || isLevel(before.path.tangentAt(before.path.length));
      if (!level) return false;
      carryOn(marble, arriving);
      return true;
    },
    // Off either end with no track to roll on to, or fast over the top onto
    // level track: into the air the way the slope sends it
    leave(world, marble, rolling) {
      const { path, piece, exit } = rolling;
      const heading = path.tangentAt(path.length);
      const next = world.track.findConnection(piece, exit);
      // Up onto another ramp, the slope just carries on
      const climbing =
        next !== undefined &&
        isSloped(next.kind) &&
        downhill(next.rotation) === oppositeDirection(exit);
      const skiJump =
        heading.z > 0 && marble.speed > PHYSICS.SKI_JUMP_SPEED && !climbing;
      if (next && !skiJump) return false;
      takeOff(marble, scale(heading, marble.speed), exit);
      return true;
    },
  },

  // Landing on a vortex, or rolling in over its rim: round and round it goes
  vortex: {
    land(_world, marble, landing, events) {
      const impact = Math.abs(marble.velocity.z) / 2;
      events.push({ type: "land", marbleId: marble.id, impact });
      enterVortex(marble, landing.piece, landing.point, events);
    },
    rollIn(_world, marble, piece, arriving, events) {
      carryOn(marble, arriving);
      enterVortex(marble, piece, marble.position, events);
      return true;
    },
  },

  portal: {
    // Rolling in through one end: into the ring in the middle
    rollIn(world, marble, piece, arriving, events) {
      const entrySide = oppositeDirection(arriving);
      if (!world.track.twinOf(piece)) return false;
      if (!piecePorts(piece.kind, piece.rotation).includes(entrySide)) {
        return false;
      }
      const v = DIRECTION_VECTORS[entrySide];
      const path = pathOnPiece(
        piece,
        densify([
          { x: v.x / 2, y: v.y / 2 },
          { x: 0, y: 0 },
        ]),
      );
      snapTo(marble, path.points[0]);
      marble.motion = {
        mode: "rolling",
        piece,
        path,
        distance: 0,
        exit: arriving,
        entry: entrySide,
      };
      events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
      return true;
    },
    // Reaching the ring: out of the twin's ring, heading the same way
    // relative to the twin
    leave(world, marble, rolling, events) {
      const { piece } = rolling;
      const end = rolling.path.pointAt(rolling.path.length);
      const atRing =
        Math.hypot(end.x - piece.cell.x, end.y - piece.cell.y) < 0.01;
      const twin = world.track.twinOf(piece);
      if (!atRing || !twin) return false;

      const heading = rotateDirection(rolling.exit, -piece.rotation);
      const exit = rotateDirection(heading, twin.rotation);
      const v = DIRECTION_VECTORS[exit];
      const path = pathOnPiece(
        twin,
        densify([
          { x: 0, y: 0 },
          { x: v.x / 2, y: v.y / 2 },
        ]),
      );
      // Straight there, with no easing across the screen
      marble.position = path.points[0];
      marble.motion = {
        mode: "rolling",
        piece: twin,
        path,
        distance: 0,
        exit,
        entry: oppositeDirection(exit),
      };
      events.push({ type: "visit", pieceId: twin.id, marbleId: marble.id });
      return true;
    },
  },

  // Down the stem, or dropped on: steered by the T's leg down the branch
  // it's tilted away from
  flipflop: {
    chooseExit(world, piece, arriving) {
      const local = arriving && rotateDirection(arriving, -piece.rotation);
      if (local === "-y" || local === "+y") return undefined;
      return rotateDirection(world.switches.side(piece.id), piece.rotation);
    },
    // Rolling out down a branch, it pushes the T's arm on that side and
    // rocks it over for the next marble
    leave(world, _marble, rolling, _events) {
      if (pushesFlipFlop(rolling)) world.switches.flip(rolling.piece.id);
      return false;
    },
  },

  // Rolling or dropping onto a hole: in it goes, never to be seen again
  hole: {
    land(_world, marble, landing, events) {
      const impact = Math.abs(marble.velocity.z) / 2;
      events.push({ type: "land", marbleId: marble.id, impact });
      fallIntoHole(marble, landing.piece, landing.point, events);
    },
    rollIn(_world, marble, piece, arriving, events) {
      fallIntoHole(marble, piece, entryPoint(piece, arriving), events);
      return true;
    },
  },

  seesaw: {
    land(world, marble, landing, events) {
      marble.position = landing.point;
      world.seesaws.land(marble, landing.piece, events);
    },
    // Rolling off the track into a seesaw: drop into the cup there
    rollIn(world, marble, piece, arriving, events) {
      carryOn(marble, arriving);
      world.seesaws.land(marble, piece, events);
      return true;
    },
  },

  fan: {
    // Dropping onto a fan: blown back up
    land(world, marble, landing, events) {
      const impact = Math.abs(marble.velocity.z);
      events.push({ type: "land", marbleId: marble.id, impact });
      blowUp(world.track, marble, landing.piece, landing.point, events);
    },
    // Rolling onto a fan, from any side: blown upwards
    rollIn(world, marble, piece, arriving, events) {
      carryOn(marble, arriving);
      blowUp(world.track, marble, piece, entryPoint(piece, arriving), events);
      return true;
    },
  },

  tube: { land: intoTheTop },

  outlet: {
    land: intoTheTop,
    // Rolling into an outlet's spout: drop down the tube. Its other sides
    // are glass walls. Upside down, the spout's at the capped bottom, so
    // the marble just rolls in and back out.
    rollIn(_world, marble, piece, arriving, events) {
      if (isUpsideDown(piece)) return false;
      const entrySide = oppositeDirection(arriving);
      if (!piecePorts(piece.kind, piece.rotation).includes(entrySide)) {
        return false;
      }
      enterTube(marble, piece, piece.cell.z + restHeight(piece.kind), -0.5);
      events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
      return true;
    },
  },

  funnel: {
    land: intoTheTop,
    // Rolling in over a funnel's rim: circle down into it. Upside down,
    // its sides are glass walls.
    rollIn(_world, marble, piece, arriving, events) {
      if (isUpsideDown(piece)) return false;
      carryOn(marble, arriving);
      const rim = entryPoint(piece, arriving);
      enterTube(marble, piece, rim.z, -0.01, rim);
      events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });
      return true;
    },
  },
};

/** Whether a direction of travel along a track is about level */
function isLevel(heading: Vec3): boolean {
  return Math.abs(heading.z) < 0.3;
}

/** Keep going the way it was rolling, now in the air */
function carryOn(marble: Marble, arriving: Direction) {
  const heading = DIRECTION_VECTORS[arriving];
  takeOff(
    marble,
    { x: heading.x * marble.speed, y: heading.y * marble.speed, z: 0 },
    arriving,
  );
}

/**
 * Fly off with a velocity. Heading towards the camera, it can land on
 * anything that looks below it; heading away, it drops behind pieces that
 * are in front of it.
 */
export function takeOff(marble: Marble, velocity: Vec3, heading: Direction) {
  marble.motion = FLYING;
  marble.velocity = velocity;
  marble.headingForward = heading === "+x" || heading === "+y";
}

/** Where a marble rolling onto a piece comes in, level with the track */
function entryPoint(piece: Piece, arriving: Direction): Vec3 {
  const side = DIRECTION_VECTORS[oppositeDirection(arriving)];
  const { x, y, z } = piece.cell;
  return {
    x: x + side.x / 2,
    y: y + side.y / 2,
    z: z + restHeight(piece.kind),
  };
}
