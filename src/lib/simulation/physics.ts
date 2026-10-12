/** Tuning for how marbles move. Distances are in grid cells. */
export const PHYSICS = {
  GRAVITY: 20,
  /** Marbles never roll slower than this on a track, as if it were tilted */
  CRUISE_SPEED: 2.5,
  CRUISE_ACCELERATION: 4,
  /** How quickly speed above cruising speed fades away on a track */
  FRICTION: 1.2,
  /** Top speed along a track, and top falling speed */
  MAX_SPEED: 9,
  /** Share of horizontal / vertical speed kept as rolling speed on landing */
  LANDING_KEEP_HORIZONTAL: 0.9,
  LANDING_KEEP_VERTICAL: 0.45,
  /** Share of speed kept going round a curve */
  TURN_KEEP: 0.93,
  /** Share of speed kept when bouncing back off the end of a catcher */
  BOUNCE_KEEP: 0.45,
  /** Share of speed kept bouncing off the side of a piece */
  WALL_BOUNCE: 0.4,
  /** How bouncy marbles are when they hit each other (1 is perfectly) */
  MARBLE_BOUNCE: 0.9,
  /** Speed marbles are blown up tubes by a fan */
  AIR_SPEED: 4,
  /** How quickly a fan gets a marble up to speed */
  AIR_ACCELERATION: 30,
  /**
   * Upward speed a fan gives a marble that rolls or drops onto it: enough to
   * clear two tiles up comfortably and drop onto them from above
   */
  FAN_KICK: 10,
  /**
   * Sideways speed of a marble that rolled onto a fan as it's kicked up:
   * always the same, so it lands about one tile on, two tiles up
   */
  FAN_HOP: 2,
  /** Below this horizontal speed a landing marble counts as dropping straight down */
  DROP_SPEED: 0.6,
  /** How quickly small visual snaps are smoothed out */
  SMOOTHING: 14,
  STEP: 1 / 240,
  /** Grid area marbles live in, used for wrapping and removal */
  GRID_EXTENT: 10,
};
