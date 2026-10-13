/**
 * Shape of the vortex, shared by the physics and the 3D model: a cone over
 * 3 by 3 tiles, from its rim level with the top of the tiles down to a hole
 * in the middle. Heights are relative to the middle tile's centre.
 */
export const VORTEX = {
  /** Radius of the cone at the rim */
  RIM_RADIUS: 1.45,
  /** Height of the rim */
  RIM_HEIGHT: 0.5,
  /** Radius of the hole in the middle */
  HOLE_RADIUS: 0.2,
  /** Height of the hole */
  HOLE_HEIGHT: -0.25,
};

/** Height of the cone's surface at a distance from the middle */
export function vortexSurface(r: number): number {
  const f = (r - VORTEX.HOLE_RADIUS) / (VORTEX.RIM_RADIUS - VORTEX.HOLE_RADIUS);
  const t = Math.min(1, Math.max(0, f));
  return VORTEX.HOLE_HEIGHT + (VORTEX.RIM_HEIGHT - VORTEX.HOLE_HEIGHT) * t;
}
