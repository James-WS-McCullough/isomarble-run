import {
  DIRECTION_VECTORS,
  type Direction,
  oppositeDirection,
} from "../directions";
import { isUpsideDown, type PieceKind, piecePorts } from "../pieces";
import type { Vec3 } from "../space";
import { type Piece, restHeight, type TrackIndex } from "../track";
import { fallIntoHole } from "./holes";
import {
  FLYING,
  type Landing,
  type Marble,
  type SimulationEvent,
} from "./marble";
import type { Seesaws } from "./seesaws";
import { blowUp, enterTube } from "./tubes";

/** What a piece's behaviour can reach */
export interface World {
  track: TrackIndex;
  seesaws: Seesaws;
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

/** Keep going the way it was rolling, now in the air */
function carryOn(marble: Marble, arriving: Direction) {
  const heading = DIRECTION_VECTORS[arriving];
  marble.motion = FLYING;
  marble.velocity = {
    x: heading.x * marble.speed,
    y: heading.y * marble.speed,
    z: 0,
  };
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
