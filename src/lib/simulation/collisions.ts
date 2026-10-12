import { MARBLE_RADIUS, type Vec3, visiblePart } from "../space";
import type { TrackIndex } from "../track";
import { type Marble, motionAs, type SimulationEvent } from "./marble";
import { PHYSICS } from "./physics";
import { turnAround } from "./routes";
import { add, dot, length, scale, subtract } from "./vector";

/**
 * Marbles bump into each other. Two marbles collide when they visibly
 * overlap and either really touch, or are rolling along track that is
 * visibly joined (even if the join hides a change in depth). Marbles that
 * only overlap because one is passing in front of the other don't.
 */
export function collideMarbles(
  marbles: Marble[],
  track: TrackIndex,
  random: () => number,
  events: SimulationEvent[],
) {
  const reach = 2 * MARBLE_RADIUS;
  for (let i = 0; i < marbles.length; i++) {
    for (let j = i + 1; j < marbles.length; j++) {
      const a = marbles[i];
      const b = marbles[j];
      const apart = subtract(a.position, b.position);
      const seen = visiblePart(apart);
      const seenDistance = length(seen);
      if (seenDistance >= reach) continue;

      const distance = length(apart);
      const touching = distance < reach;
      if (!touching && !onJoinedTrack(track, a, b)) continue;

      const normal = touching
        ? scale(apart, 1 / Math.max(distance, 1e-9))
        : scale(seen, 1 / Math.max(seenDistance, 1e-9));
      const va = velocityOf(a);
      const vb = velocityOf(b);
      const closing = dot(subtract(va, vb), normal);
      if (closing >= 0) continue;

      // Equal masses: swap the parts of their velocities along the normal
      const impulse = (-(1 + PHYSICS.MARBLE_BOUNCE) / 2) * closing;
      setVelocity(a, add(va, scale(normal, impulse)), random);
      setVelocity(b, subtract(vb, scale(normal, impulse)), random);
      events.push({ type: "hit", impact: -closing });
    }
  }
}

/** Both rolling on the same piece, or on pieces that visibly join */
function onJoinedTrack(track: TrackIndex, a: Marble, b: Marble): boolean {
  const ra = motionAs(a, "rolling");
  const rb = motionAs(b, "rolling");
  if (!ra || !rb) return false;
  return (
    ra.piece === rb.piece ||
    track.findConnection(ra.piece, ra.exit) === rb.piece ||
    track.findConnection(rb.piece, rb.exit) === ra.piece
  );
}

function velocityOf(marble: Marble): Vec3 {
  const { motion } = marble;
  switch (motion.mode) {
    case "flying":
      return marble.velocity;
    case "rolling":
      return scale(motion.path.tangentAt(motion.distance), marble.speed);
    case "tube":
      return { x: 0, y: 0, z: marble.velocity.z };
    case "held":
      return { x: 0, y: 0, z: 0 };
  }
}

/**
 * Give a marble a new velocity. A rolling marble keeps only the part along
 * its groove, turning round if that points backwards.
 */
function setVelocity(marble: Marble, velocity: Vec3, random: () => number) {
  const { motion } = marble;
  switch (motion.mode) {
    case "flying":
      marble.velocity = velocity;
      return;
    case "rolling": {
      const along = dot(velocity, motion.path.tangentAt(motion.distance));
      if (along >= 0) {
        marble.speed = along;
      } else {
        turnAround(marble, motion, random);
        marble.speed = -along;
      }
      return;
    }
    case "tube":
      // Tubes only let marbles move up and down
      marble.velocity = { x: 0, y: 0, z: velocity.z };
      return;
    case "held":
      // A marble sitting in a seesaw cup stays put
      return;
  }
}
