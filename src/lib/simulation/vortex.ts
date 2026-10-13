import { MARBLE_RADIUS, slideAlongView, type Vec3 } from "../space";
import type { Piece } from "../track";
import { VORTEX, vortexSurface } from "../vortex";
import {
  FLYING,
  type Marble,
  rollTo,
  type SimulationEvent,
  type Swirling,
  snapTo,
} from "./marble";

/** How marbles move round a vortex */
const SWIRL = {
  /** How strongly the slope pulls a marble in towards the hole */
  PULL: 3,
  /** How quickly circling slows: a marble spirals in as it does */
  FRICTION: 0.35,
  /** How quickly moving in or out settles down */
  RADIAL_DAMPING: 2,
  /** Marbles start off going round at least this fast */
  MIN_AROUND: 2,
  /** Fastest a marble can go round */
  MAX_SPEED: 9,
};

/** Furthest out a marble's centre can be, against the rim */
const OUTERMOST = VORTEX.RIM_RADIUS - MARBLE_RADIUS;

/**
 * Start circling round a vortex from a point over it, keeping the speed it
 * came in with: round the vortex, and in or out
 */
export function enterVortex(
  marble: Marble,
  vortex: Piece,
  from: Vec3,
  events: SimulationEvent[],
) {
  const { x, y, z } = vortex.cell;
  // Over the vortex on screen, at the height of its rim
  const p = slideAlongView(from, z + VORTEX.RIM_HEIGHT - from.z);
  const r = Math.min(OUTERMOST, Math.hypot(p.x - x, p.y - y));
  const angle = Math.atan2(p.y - y, p.x - x);
  const v = marble.velocity;
  const around = -v.x * Math.sin(angle) + v.y * Math.cos(angle);
  const outwards = v.x * Math.cos(angle) + v.y * Math.sin(angle);
  // It's sent round the way it was already heading, at least so fast
  const sent =
    Math.abs(around) < SWIRL.MIN_AROUND
      ? SWIRL.MIN_AROUND * (around < 0 ? -1 : 1)
      : around;

  marble.motion = {
    mode: "swirling",
    piece: vortex,
    r,
    angle,
    spin: sent * Math.max(r, 0.1),
    radialSpeed: outwards,
  };
  marble.velocity = { x: 0, y: 0, z: 0 };
  snapTo(marble, pointOn(vortex, r, angle));
  events.push({ type: "visit", pieceId: vortex.id, marbleId: marble.id });
}

/**
 * Circle round the vortex. Friction slows the marble's circling, so it
 * spirals in, going round faster as it gets closer to the middle, and drops
 * through the hole.
 */
export function stepSwirling(marble: Marble, swirl: Swirling, dt: number) {
  swirl.spin *= Math.exp(-SWIRL.FRICTION * dt);
  const r = Math.max(swirl.r, 0.05);
  const around = Math.max(
    -SWIRL.MAX_SPEED,
    Math.min(SWIRL.MAX_SPEED, swirl.spin / r),
  );

  // Flung outwards by going round, pulled in by the slope
  swirl.radialSpeed += (around ** 2 / r - SWIRL.PULL) * dt;
  swirl.radialSpeed *= Math.exp(-SWIRL.RADIAL_DAMPING * dt);
  swirl.r += swirl.radialSpeed * dt;
  swirl.angle += (around / r) * dt;

  // The rim keeps it in
  if (swirl.r > OUTERMOST) {
    swirl.r = OUTERMOST;
    swirl.radialSpeed = Math.min(0, -swirl.radialSpeed * 0.3);
  }

  const { piece } = swirl;
  if (swirl.r < VORTEX.HOLE_RADIUS) {
    // Down through the hole, onto whatever's below
    const { x, y, z } = piece.cell;
    marble.motion = FLYING;
    marble.velocity = { x: 0, y: 0, z: -1 };
    marble.headingForward = false;
    rollTo(marble, { x, y, z: z + VORTEX.HOLE_HEIGHT });
    return;
  }
  rollTo(marble, pointOn(piece, swirl.r, swirl.angle));
}

/** Where a marble sits on the cone */
function pointOn(vortex: Piece, r: number, angle: number): Vec3 {
  const { x, y, z } = vortex.cell;
  return {
    x: x + r * Math.cos(angle),
    y: y + r * Math.sin(angle),
    z: z + vortexSurface(r) + MARBLE_RADIUS * 1.1,
  };
}

/** A swirling marble's velocity, round and in or out */
export function swirlingVelocity(swirl: Swirling): Vec3 {
  const around = swirl.spin / Math.max(swirl.r, 0.05);
  const c = Math.cos(swirl.angle);
  const s = Math.sin(swirl.angle);
  return {
    x: -around * s + swirl.radialSpeed * c,
    y: around * c + swirl.radialSpeed * s,
    z: 0,
  };
}

/** Knocked by another marble: take on a new velocity round and in or out */
export function setSwirlingVelocity(swirl: Swirling, velocity: Vec3) {
  const c = Math.cos(swirl.angle);
  const s = Math.sin(swirl.angle);
  const around = -velocity.x * s + velocity.y * c;
  swirl.spin = around * Math.max(swirl.r, 0.05);
  swirl.radialSpeed = velocity.x * c + velocity.y * s;
}
