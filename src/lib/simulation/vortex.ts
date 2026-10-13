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
import { PHYSICS } from "./physics";

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
  /** How quickly the sides of the hole guide a dropping marble to the middle */
  CENTRING: 20,
  /** Fastest a marble dropping into the hole can turn (radians a second) */
  MAX_TURN: 30,
};

/** How steep the cone is: how far it drops for each step in towards the hole */
const CONE_SLOPE =
  (VORTEX.RIM_HEIGHT - VORTEX.HOLE_HEIGHT) /
  (VORTEX.RIM_RADIUS - VORTEX.HOLE_RADIUS);

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
    drop: null,
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
  if (swirl.drop) {
    stepDropping(marble, swirl, swirl.drop, dt);
    return;
  }
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

  if (swirl.r < VORTEX.HOLE_RADIUS) {
    // Over the edge of the hole: it starts to drop, still going round,
    // and as fast as it was coming down the cone
    swirl.drop = {
      z: marble.position.z,
      speed: Math.max(0, -swirl.radialSpeed * CONE_SLOPE),
    };
    stepDropping(marble, swirl, swirl.drop, dt);
    return;
  }
  rollTo(marble, pointOn(swirl.piece, swirl.r, swirl.angle));
}

/**
 * Drop into the hole: falling, and still going round as the sides of the
 * hole guide it in to the middle, until it falls out of the bottom onto
 * whatever's below
 */
function stepDropping(
  marble: Marble,
  swirl: Swirling,
  drop: { z: number; speed: number },
  dt: number,
) {
  drop.speed = Math.min(PHYSICS.MAX_SPEED, drop.speed + PHYSICS.GRAVITY * dt);
  drop.z -= drop.speed * dt;
  swirl.r *= Math.exp(-SWIRL.CENTRING * dt);
  const r = Math.max(swirl.r, 0.01);
  const around = Math.min(SWIRL.MAX_SPEED, Math.abs(swirl.spin) / r);
  swirl.angle +=
    Math.sign(swirl.spin) * Math.min(SWIRL.MAX_TURN, around / r) * dt;

  const { x, y, z } = swirl.piece.cell;
  rollTo(marble, {
    x: x + swirl.r * Math.cos(swirl.angle),
    y: y + swirl.r * Math.sin(swirl.angle),
    z: drop.z,
  });

  // Out of the hole: falling onto whatever's below, which it lands on from
  // above, so it goes behind anything in front
  if (drop.z < z + VORTEX.HOLE_HEIGHT - 0.05) {
    marble.motion = FLYING;
    marble.velocity = { x: 0, y: 0, z: -drop.speed };
    marble.headingForward = false;
  }
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
