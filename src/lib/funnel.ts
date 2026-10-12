import { MARBLE_RADIUS } from "./space";

/**
 * Shape of the funnel, shared by the physics and the 3D model. Heights are
 * relative to the piece centre. It's a cone from a mouth filling the top of
 * the tile down to a neck as wide as a tube, then a straight pipe.
 */
export const FUNNEL = {
  /** Radius of the mouth, at the top of the piece */
  MOUTH_RADIUS: 0.48,
  /** Radius of the neck and the pipe below it: the same as a tube */
  NECK_RADIUS: 0.3,
  /** Height of the neck */
  NECK_HEIGHT: 0.05,
  /** Fastest a marble drops while circling round the funnel */
  SWIRL_DROP: 1.2,
  /** How fast it circles (speed round the funnel) */
  SWIRL_SPEED: 2.4,
  /** How fast a marble that landed out on the rim slides in to the cone */
  SLIDE_IN: 2.5,
};

/**
 * How far from the funnel's axis a marble's centre can be at a height
 * (relative to the piece centre): it's held off the cone by its radius,
 * and centred once it reaches the neck
 */
export function funnelRoom(height: number): number {
  const top = 0.5;
  const mouthRoom = FUNNEL.MOUTH_RADIUS - MARBLE_RADIUS;
  const f = (height - FUNNEL.NECK_HEIGHT) / (top - FUNNEL.NECK_HEIGHT);
  return mouthRoom * Math.min(1, Math.max(0, f));
}
