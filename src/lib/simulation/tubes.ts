import { DIRECTION_VECTORS } from "../directions";
import { FUNNEL, funnelRoom } from "../funnel";
import { isTube, isUpsideDown, piecePorts, portLevel } from "../pieces";
import { GROOVE_REST_HEIGHT, MARBLE_RADIUS, type Vec3 } from "../space";
import { type Piece, restHeight, type TrackIndex } from "../track";
import {
  FLYING,
  type InTube,
  type Landing,
  type Marble,
  rollTo,
  type SimulationEvent,
  snapTo,
} from "./marble";
import { PHYSICS } from "./physics";
import { pathOnPiece } from "./routes";
import { clamp } from "./vector";

/** Glass tubes, funnels, outlets and the fans that blow marbles up them */

/**
 * A marble rising towards the bottom of a tube is caught once its top
 * reaches the opening, a little before its centre does
 */
const TUBE_CATCH_REACH = MARBLE_RADIUS + 0.05;

/**
 * Which tube in a column a marble at height `z` is inside, or null.
 * Marbles enter and leave tubes level with the track, a little above the
 * top of the tube's cell, so that counts as inside the tube below.
 */
export function tubeCell(
  track: TrackIndex,
  column: { x: number; y: number },
  z: number,
): number | null {
  const cell = Math.round(z);
  const tubeAt = (level: number) =>
    track.isTubeAt({ x: column.x, y: column.y, z: level });
  if (tubeAt(cell)) return cell;
  if (tubeAt(cell - 1) && z < cell - 0.5 + 0.1) return cell - 1;
  // Just touching the bottom of a column counts as inside it
  if (tubeAt(cell + 1) && z >= cell + 0.5 - TUBE_CATCH_REACH) {
    return cell + 1;
  }
  return null;
}

/**
 * Start travelling inside the tube column a piece is part of. A marble
 * dropping in from above sinks to the bottom first; one coming in over a
 * funnel's rim starts where it came in (`from`) and circles down.
 */
export function enterTube(
  marble: Marble,
  piece: Piece,
  z: number,
  verticalSpeed: number,
  from?: Vec3,
) {
  const { x, y } = piece.cell;
  // Only coming in through a funnel's wide mouth does it start off-centre
  const throughMouth =
    piece.kind === "funnel" &&
    (isUpsideDown(piece) ? verticalSpeed > 0 : verticalSpeed <= 0);
  const offset =
    from && throughMouth ? { x: from.x - x, y: from.y - y } : { x: 0, y: 0 };
  // Circle the way it was already heading round the middle
  const v = marble.velocity;
  const spin = offset.x * v.y - offset.y * v.x < 0 ? -1 : 1;

  marble.motion = {
    mode: "tube",
    x,
    y,
    offset,
    spin,
    sinking: verticalSpeed < 0,
  };
  marble.velocity = { x: 0, y: 0, z: verticalSpeed };
  snapTo(marble, { x: x + offset.x, y: y + offset.y, z });
}

/** Circle round a funnel, closing in on the middle as the marble drops */
function swirl(
  track: TrackIndex,
  tube: InTube,
  cell: number,
  z: number,
  dt: number,
) {
  const piece = track.pieceAt({ x: tube.x, y: tube.y, z: cell });
  let room = 0;
  if (piece?.kind === "funnel") {
    room = funnelRoom(isUpsideDown(piece) ? cell - z : z - cell);
  }
  const { offset } = tube;
  const distance = Math.hypot(offset.x, offset.y);
  if (distance === 0) return;

  // Slide in off the rim, then keep against the cone as it narrows
  const target =
    distance > room
      ? Math.max(room, distance - FUNNEL.SLIDE_IN * dt)
      : distance;
  const angle =
    Math.atan2(offset.y, offset.x) +
    (tube.spin * FUNNEL.SWIRL_SPEED * dt) / Math.max(distance, 0.1);
  tube.offset =
    target < 0.005
      ? { x: 0, y: 0 }
      : { x: Math.cos(angle) * target, y: Math.sin(angle) * target };
}

/**
 * Move up or down a column of tubes: falling, or blown up by a fan at the
 * bottom. Marbles blown up to an outlet leave through its spout. Returns
 * where it lands if it drops out of the bottom onto a piece.
 */
export function stepInTube(
  track: TrackIndex,
  marble: Marble,
  tube: InTube,
  dt: number,
  events: SimulationEvent[],
): Landing | null {
  const z = marble.position.z;
  const cell = tubeCell(track, tube, z);
  const column =
    cell === null
      ? undefined
      : track.tubeColumn({ x: tube.x, y: tube.y, z: cell });
  if (cell === null || !column) {
    marble.motion = FLYING;
    return null;
  }
  const { bottom, top, base } = column;
  // A fan blows up the column from right below it, or sucks marbles up it
  // from across a gap
  const blown = column.fan !== undefined;

  const v = marble.velocity;
  if (blown && !tube.sinking) {
    const change = clamp(
      PHYSICS.AIR_SPEED - v.z,
      -PHYSICS.AIR_ACCELERATION * dt,
      PHYSICS.AIR_ACCELERATION * dt,
    );
    v.z += change;
  } else {
    v.z = Math.max(v.z - PHYSICS.GRAVITY * dt, -PHYSICS.MAX_SPEED);
  }
  // Rolling round the cone of a funnel holds it back
  const circling = tube.offset.x !== 0 || tube.offset.y !== 0;
  if (circling) {
    v.z = clamp(v.z, -FUNNEL.SWIRL_VERTICAL, FUNNEL.SWIRL_VERTICAL);
  }
  let after = z + v.z * dt;
  swirl(track, tube, cell, after, dt);

  const outlet = spoutPassed(track, tube, z, after);
  if (outlet) {
    leaveThroughSpout(marble, outlet, Math.abs(v.z), events);
    return null;
  }

  if (v.z > 0) {
    // Out of the open top of the column, to fall back in (an outlet at
    // the top is an elbow, so marbles leave through its spout instead)
    if (!column.cappedTop && after > top + 0.5) {
      marble.motion = FLYING;
      marble.headingForward = true;
    }
  } else if (base && !blown) {
    // Dropping out of the bottom onto the piece below
    const landing = bottom - 1 + restHeight(base.kind);
    if (after <= landing) {
      return { piece: base, point: { x: tube.x, y: tube.y, z: landing } };
    }
  } else if (base && blown) {
    // The fan keeps it from dropping into the fan itself, and blows it
    // back up once it gets there
    const floor = bottom - 0.5 + MARBLE_RADIUS;
    if (after <= floor) {
      after = floor;
      tube.sinking = false;
      v.z = Math.max(v.z, 0);
    }
  } else if (after < bottom - 0.5) {
    // Out of the bottom into thin air
    marble.motion = FLYING;
    marble.headingForward = false;
  }

  rollTo(marble, {
    x: tube.x + tube.offset.x,
    y: tube.y + tube.offset.y,
    z: after,
  });
  return null;
}

/**
 * The outlet whose spout a marble passes moving from `from` to `to` up or
 * down a column, if any: rising past the spout of one the right way up, or
 * dropping past the spout of one upside down
 */
function spoutPassed(
  track: TrackIndex,
  column: { x: number; y: number },
  from: number,
  to: number,
): Piece | undefined {
  const rising = to > from;
  // Spouts sit a little above or below the outlet's middle, so check the
  // cells either side too
  const low = Math.round(Math.min(from, to)) - 1;
  const high = Math.round(Math.max(from, to)) + 1;
  for (let level = low; level <= high; level++) {
    const piece = track.pieceAt({ x: column.x, y: column.y, z: level });
    if (piece?.kind !== "outlet" || isUpsideDown(piece) === rising) continue;
    const spout = level + GROOVE_REST_HEIGHT + portLevel(piece);
    const passed = rising
      ? from < spout && to >= spout
      : from > spout && to <= spout;
    if (passed) return piece;
  }
  return undefined;
}

/**
 * A fan blows a marble that rolls or drops onto it upwards: straight into
 * a tube or funnel stacked on it, or else up into the air
 */
export function blowUp(
  track: TrackIndex,
  marble: Marble,
  fan: Piece,
  from: Vec3,
  events: SimulationEvent[],
) {
  const { x, y, z } = fan.cell;
  events.push({ type: "paint", pieceId: fan.id, hue: marble.hue });
  const above = track.pieceAt({ x, y, z: z + 1 });
  if (above && isTube(above.kind)) {
    enterTube(marble, above, z + restHeight(fan.kind), PHYSICS.AIR_SPEED, from);
    return;
  }

  // A marble dropping straight onto the fan goes straight back up
  const v = marble.velocity;
  const sideways = Math.hypot(v.x, v.y);
  const hop = sideways < PHYSICS.DROP_SPEED ? 1 : PHYSICS.FAN_HOP / sideways;
  marble.motion = FLYING;
  marble.velocity = { x: v.x * hop, y: v.y * hop, z: PHYSICS.FAN_KICK };
  marble.headingForward = v.x + v.y > 0;
  snapTo(marble, from);
}

/**
 * Rising into the bottom of a tube, or the wide mouth of an upside-down
 * funnel, anywhere under it: caught, and carried up into the column
 */
export function catchFromBelow(
  track: TrackIndex,
  marble: Marble,
  before: Vec3,
  after: Vec3,
): boolean {
  if (after.z <= before.z) return false;
  const x = Math.round(after.x);
  const y = Math.round(after.y);
  const level = Math.round(after.z + 0.5 + TUBE_CATCH_REACH);
  const piece = track.pieceAt({ x, y, z: level });
  if (!piece || !isTube(piece.kind)) return false;
  // Already inside the column, rising through it
  if (track.isTubeAt({ x, y, z: level - 1 })) return false;
  const mouth = level - 0.5 - TUBE_CATCH_REACH;
  if (before.z >= mouth || after.z < mouth) return false;
  enterTube(marble, piece, mouth, marble.velocity.z, {
    ...after,
    z: mouth,
  });
  return true;
}

function leaveThroughSpout(
  marble: Marble,
  outlet: Piece,
  verticalSpeed: number,
  events: SimulationEvent[],
) {
  const exit = piecePorts(outlet.kind, outlet.rotation)[0];
  const v = DIRECTION_VECTORS[exit];
  const path = pathOnPiece(outlet, [
    { x: 0, y: 0 },
    { x: v.x / 2, y: v.y / 2 },
  ]);
  marble.velocity = { x: 0, y: 0, z: 0 };
  marble.speed = Math.max(PHYSICS.CRUISE_SPEED, verticalSpeed * 0.8);
  snapTo(marble, path.points[0]);
  marble.motion = {
    mode: "rolling",
    piece: outlet,
    path,
    distance: 0,
    exit,
    entry: null,
  };
  events.push({ type: "paint", pieceId: outlet.id, hue: marble.hue });
}
