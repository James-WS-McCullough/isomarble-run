import {
  DIRECTION_VECTORS,
  type Direction,
  directionOfVelocity,
  oppositeDirection,
} from "./directions";
import { Path, routeBetween, routeFromLanding } from "./paths";
import { pieceExits } from "./pieces";
import {
  depthOf,
  fromScreen,
  SQRT2,
  SQRT6,
  screenOf,
  slideAlongView,
  type Vec3,
  visiblePart,
} from "./space";
import {
  frontmost,
  type Piece,
  REST_HEIGHTS,
  restHeight,
  TrackIndex,
} from "./track";

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
  /** Below this horizontal speed a landing marble counts as dropping straight down */
  DROP_SPEED: 0.6,
  /** How quickly small visual snaps are smoothed out */
  SMOOTHING: 14,
  STEP: 1 / 240,
  /** Grid area marbles live in, used for wrapping and removal */
  GRID_EXTENT: 10,
};

export interface Marble {
  id: string;
  /** Colour (0-360), painted onto pieces the marble rolls over */
  hue: number;
  position: Vec3;
  /** Velocity while in the air */
  velocity: Vec3;
  /** Set while rolling along a piece */
  rolling: {
    piece: Piece;
    path: Path;
    distance: number;
    exit: Direction;
  } | null;
  /** Speed along the track while rolling */
  speed: number;
  /** Visible offset left over from a snap, eased away to hide the jump */
  visualOffset: Vec3;
  /** Horizontal distance travelled since the renderer last spun the marble */
  rolled: { x: number; y: number };
}

export type SimulationEvent =
  | { type: "land"; marbleId: string; impact: number }
  | { type: "paint"; pieceId: string; hue: number }
  | { type: "removed"; marbleId: string };

/** How far from the middle of a face (0.5 is its corner) a marble can land */
const LANDING_MARGIN = 0.4;

interface Bounds {
  bottom: number;
  top: number;
  maxRight: number;
  frontDepth: number;
}

let marbleCounter = 0;

/**
 * Marbles rolling and falling over a track. Call `advance` every frame.
 */
export class Simulation {
  marbles: Marble[] = [];
  private track = new TrackIndex([]);
  private bounds: Bounds = computeBounds([]);
  private leftoverTime = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** Replace the track. Marbles on pieces that changed fall off. */
  setPieces(pieces: Piece[]) {
    this.track = new TrackIndex(pieces);
    this.bounds = computeBounds(pieces);

    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    for (const marble of this.marbles) {
      const rolling = marble.rolling;
      if (!rolling) continue;
      const piece = byId.get(rolling.piece.id);
      if (piece && samePlacement(piece, rolling.piece)) {
        rolling.piece = piece;
      } else {
        this.launch(marble, rolling.exit);
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
      velocity: { x: 0, y: 0, z: 0 },
      rolling: null,
      speed: 0,
      visualOffset: { x: 0, y: 0, z: 0 },
      rolled: { x: 0, y: 0 },
    };
    this.marbles.push(marble);
    return marble;
  }

  clearMarbles() {
    this.marbles = [];
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
      if (marble.rolling) {
        this.stepRolling(marble, dt, events);
      } else if (!this.stepFlying(marble, dt, events)) {
        events.push({ type: "removed", marbleId: marble.id });
        continue;
      }
      marble.visualOffset = scale(marble.visualOffset, decay);
      kept.push(marble);
    }

    this.marbles = kept;
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
    for (let hops = 0; hops < 4 && marble.rolling; hops++) {
      const rolling = marble.rolling;
      const remaining = rolling.path.length - rolling.distance;
      if (travel < remaining) {
        rolling.distance += travel;
        this.rollTo(marble, rolling.path.pointAt(rolling.distance));
        return;
      }

      travel -= remaining;
      rolling.distance = rolling.path.length;
      this.rollTo(marble, rolling.path.pointAt(rolling.distance));

      const next = this.track.findConnection(rolling.piece, rolling.exit);
      if (next) {
        this.enterPiece(marble, next, rolling.exit, events);
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

    const after = add(before, scale(marble.velocity, dt));
    marble.rolled.x += after.x - before.x;
    marble.rolled.y += after.y - before.y;
    marble.position = after;

    this.bounceOffSides(marble, before);

    const landing = this.findLanding(before, marble.position);
    if (landing) {
      this.land(marble, landing, events);
      return true;
    }

    const { right, up } = screenOf(marble.position);
    if (Math.abs(right) > this.bounds.maxRight) return false;
    if (up < this.bounds.bottom) {
      // Fell off the bottom: come back in at the top, in front of everything
      marble.position = fromScreen(
        right,
        this.bounds.top,
        this.bounds.frontDepth,
      );
    }
    return true;
  }

  /** Bounce a flying marble back if it moved into the side of a piece */
  private bounceOffSides(marble: Marble, before: Vec3) {
    const cell = roundCell(marble.position);
    if (!this.track.isOccupied(cell)) return;

    const previous = roundCell(before);
    const v = marble.velocity;
    if (cell.x !== previous.x) {
      v.x = -v.x * PHYSICS.WALL_BOUNCE;
      marble.position = { ...marble.position, x: before.x };
    }
    if (cell.y !== previous.y) {
      v.y = -v.y * PHYSICS.WALL_BOUNCE;
      marble.position = { ...marble.position, y: before.y };
    }
  }

  /**
   * Find the piece a flying marble lands on between two positions.
   *
   * A marble lands when it falls past the middle of a top face *on screen*,
   * as long as that face isn't in front of the marble (then the marble just
   * drops behind it). It also lands on a top face it actually touches.
   */
  private findLanding(
    from: Vec3,
    to: Vec3,
  ): { piece: Piece; point: Vec3 } | null {
    let best: { piece: Piece; point: Vec3; progress: number } | null = null;

    for (const rest of REST_HEIGHTS) {
      // Touching a top face for real
      const fromLevel = from.z - rest;
      const toLevel = to.z - rest;
      for (
        let level = Math.floor(fromLevel);
        level >= Math.ceil(toLevel);
        level--
      ) {
        if (level === fromLevel) continue;
        const f = (fromLevel - level) / (fromLevel - toLevel);
        const point = lerp(from, to, f);
        const piece = this.track.pieceAt({
          x: Math.round(point.x),
          y: Math.round(point.y),
          z: level,
        });
        if (
          piece &&
          restHeight(piece.kind) === rest &&
          !this.track.isCovered(piece) &&
          (!best || f < best.progress)
        ) {
          best = { piece, point, progress: f };
        }
      }

      // Passing the middle of a top face on screen. `a` and `b` say which
      // on-screen column the marble is in; their sum grows as it falls.
      const g0 = from.x + from.y - 2 * from.z + 2 * rest;
      const g1 = to.x + to.y - 2 * to.z + 2 * rest;
      for (let n = Math.floor(g0) + 1; n <= g1; n++) {
        const f = (n - g0) / (g1 - g0);
        if (best && f >= best.progress) break;
        const point = lerp(from, to, f);
        const across = point.x - point.z + rest;
        const a = Math.round(across);
        // Too close to the corner of a face to land on it
        if (Math.abs(across - a) > LANDING_MARGIN) continue;
        const candidates = this.track
          .piecesInColumn({ a, b: n - a }, rest)
          .filter((piece) => piece.cell.z + rest <= point.z + 0.05);
        const piece = frontmost(candidates);
        if (piece) {
          const shifted = slideAlongView(point, piece.cell.z + rest - point.z);
          best = { piece, point: shifted, progress: f };
        }
      }
    }

    return best && { piece: best.piece, point: best.point };
  }

  private land(
    marble: Marble,
    landing: { piece: Piece; point: Vec3 },
    events: SimulationEvent[],
  ) {
    const { piece, point } = landing;
    const v = marble.velocity;
    const horizontal = Math.hypot(v.x, v.y);
    const arriving = directionOfVelocity(v.x, v.y, PHYSICS.DROP_SPEED);
    const exit = this.pick(pieceExits(piece.kind, piece.rotation, arriving));

    const local = {
      x: clamp(point.x - piece.cell.x, -0.5, 0.5),
      y: clamp(point.y - piece.cell.y, -0.5, 0.5),
    };
    const path = pathOnPiece(piece, routeFromLanding(local, exit));

    marble.speed = Math.min(
      PHYSICS.MAX_SPEED,
      horizontal * PHYSICS.LANDING_KEEP_HORIZONTAL +
        Math.abs(v.z) * PHYSICS.LANDING_KEEP_VERTICAL,
    );
    marble.velocity = { x: 0, y: 0, z: 0 };
    marble.position = point;
    this.snapTo(marble, path.points[0]);
    marble.rolling = { piece, path, distance: 0, exit };

    events.push({ type: "land", marbleId: marble.id, impact: Math.abs(v.z) });
    events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
  }

  private enterPiece(
    marble: Marble,
    piece: Piece,
    arriving: Direction,
    events: SimulationEvent[],
  ) {
    const exit = this.pick(pieceExits(piece.kind, piece.rotation, arriving));
    const entrySide = oppositeDirection(arriving);
    const route = routeBetween(entrySide, exit);
    const path = pathOnPiece(piece, route.points, route.turns);

    if (route.turns) marble.speed *= PHYSICS.TURN_KEEP;
    if (entrySide === exit) marble.speed *= PHYSICS.BOUNCE_KEEP;

    this.snapTo(marble, path.points[0]);
    marble.rolling = { piece, path, distance: 0, exit };
    events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
  }

  /** Roll off the end of the track into the air */
  private launch(marble: Marble, direction: Direction) {
    const v = DIRECTION_VECTORS[direction];
    marble.velocity = { x: v.x * marble.speed, y: v.y * marble.speed, z: 0 };
    marble.rolling = null;
    // Marbles change colour each time they set off on a new fall
    marble.hue = (marble.hue + 30 + Math.floor(this.random() * 111)) % 360;
  }

  private rollTo(marble: Marble, point: Vec3) {
    marble.rolled.x += point.x - marble.position.x;
    marble.rolled.y += point.y - marble.position.y;
    marble.position = point;
  }

  /**
   * Jump to a new position. Movement along the line of sight is invisible;
   * any visible part is eased out by the renderer.
   */
  private snapTo(marble: Marble, point: Vec3) {
    const jump = visiblePart(subtract(marble.position, point));
    marble.visualOffset = add(marble.visualOffset, jump);
    marble.position = point;
  }

  private pick<T>(options: T[]): T {
    return options[Math.floor(this.random() * options.length)];
  }
}

function pathOnPiece(
  piece: Piece,
  points: { x: number; y: number }[],
  turns = false,
): Path {
  const { x, y, z } = piece.cell;
  const height = z + restHeight(piece.kind);
  return new Path(
    points.map((p) => ({ x: x + p.x, y: y + p.y, z: height })),
    turns,
  );
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

function roundCell(p: Vec3) {
  return { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
