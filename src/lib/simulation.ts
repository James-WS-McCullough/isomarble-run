import {
  DIRECTION_VECTORS,
  type Direction,
  directionOfVelocity,
  oppositeDirection,
} from "./directions";
import { marbleHeightAt, nearestOnRoute, routeToExit } from "./grooves";
import { Path, routeBetween } from "./paths";
import { hasGroove, pieceExits, piecePorts } from "./pieces";
import {
  depthOf,
  fromScreen,
  MARBLE_RADIUS,
  SQRT2,
  SQRT6,
  screenOf,
  slideAlongView,
  type Vec3,
  visiblePart,
} from "./space";
import { type Piece, REST_HEIGHTS, restHeight, TrackIndex } from "./track";

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
  /**
   * Whether the marble set off towards the camera. On the way down it can
   * land on pieces that look below it, even ones really closer to the camera.
   */
  headingForward: boolean;
}

export type SimulationEvent =
  | { type: "land"; marbleId: string; impact: number }
  | { type: "paint"; pieceId: string; hue: number }
  | { type: "removed"; marbleId: string };

/** How far from the middle of a face (0.5 is its corner) a marble can land */
const LANDING_MARGIN = 0.4;
/**
 * How far a marble reaches down the screen past its contact point, in the
 * face's own units. A face in front of the marble catches it this far before
 * its back edge, so the face never hides part of the marble.
 */
const FRONT_REACH = 0.45;

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
      headingForward: true,
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

    this.bounceOffWalls(marble, before);

    const landing = this.findLanding(marble, before, marble.position);
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
      marble.headingForward = true;
    }
    return true;
  }

  /**
   * Pieces are solid: a flying marble that runs into the side of one bounces
   * off it. Only the sides count; landing on top is handled separately.
   */
  private bounceOffWalls(marble: Marble, before: Vec3) {
    const r = MARBLE_RADIUS;
    const centre = roundCell(marble.position);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = { x: centre.x + dx, y: centre.y + dy, z: centre.z + dz };
          if (!this.track.isOccupied(cell)) continue;

          const p = marble.position;
          // Only below the top of the block, and not under it
          if (p.z >= cell.z + 0.5 || p.z < cell.z - 0.5 - r) continue;

          const offX = p.x - clamp(p.x, cell.x - 0.5, cell.x + 0.5);
          const offY = p.y - clamp(p.y, cell.y - 0.5, cell.y + 0.5);
          const distance = Math.hypot(offX, offY);
          if (distance >= r) continue;

          const v = marble.velocity;
          if (distance === 0) {
            // Got inside the block: step back out and turn round
            marble.position = { ...p, x: before.x, y: before.y };
            v.x = -v.x * PHYSICS.WALL_BOUNCE;
            v.y = -v.y * PHYSICS.WALL_BOUNCE;
            continue;
          }

          // Push out of the wall and bounce off it
          const nx = offX / distance;
          const ny = offY / distance;
          marble.position = {
            ...p,
            x: p.x + nx * (r - distance),
            y: p.y + ny * (r - distance),
          };
          const into = v.x * nx + v.y * ny;
          if (into < 0) {
            v.x -= (1 + PHYSICS.WALL_BOUNCE) * into * nx;
            v.y -= (1 + PHYSICS.WALL_BOUNCE) * into * ny;
          }
        }
      }
    }
  }

  /**
   * Find the piece a flying marble lands on between two positions.
   *
   * - A marble lands on a top face it actually touches.
   * - It also lands when it falls past the middle of a top face *on screen*,
   *   as long as that face isn't in front of it.
   * - A marble that set off towards the camera can also land on a face that
   *   is in front of it. It lands as soon as it reaches the back edge of that
   *   face on screen, before the face would hide any of it.
   */
  private findLanding(
    marble: Marble,
    from: Vec3,
    to: Vec3,
  ): { piece: Piece; point: Vec3 } | null {
    let best: { piece: Piece; point: Vec3; progress: number } | null = null;
    const consider = (piece: Piece, point: Vec3, progress: number) => {
      if (
        !best ||
        progress < best.progress - 1e-9 ||
        (Math.abs(progress - best.progress) <= 1e-9 &&
          depthOf(piece.cell) > depthOf(best.piece.cell))
      ) {
        best = { piece, point, progress };
      }
    };

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
          !this.track.isCovered(piece)
        ) {
          consider(piece, point, f);
        }
      }

      // Top faces on screen. (a, b) is where the marble's contact point
      // appears, in the grid coordinates of level 0: a face (A, B) covers
      // a, b within 0.5 of A, B.
      const a0 = from.x - from.z + rest;
      const b0 = from.y - from.z + rest;
      const a1 = to.x - to.z + rest;
      const b1 = to.y - to.z + rest;
      for (
        let A = Math.floor(Math.min(a0, a1)) - 1;
        A <= Math.ceil(Math.max(a0, a1)) + 1;
        A++
      ) {
        for (
          let B = Math.floor(Math.min(b0, b1)) - 1;
          B <= Math.ceil(Math.max(b0, b1)) + 1;
          B++
        ) {
          for (const piece of this.track.piecesInColumn({ a: A, b: B }, rest)) {
            const inFront = piece.cell.z + rest > to.z + 0.05;
            if (inFront && !marble.headingForward) continue;

            // Down the screen (d) and across it (c), relative to the face
            const d0 = a0 - A + (b0 - B);
            const d1 = a1 - A + (b1 - B);
            const c0 = a0 - A - (b0 - B);
            const c1 = a1 - A - (b1 - B);
            // Faces behind: land on passing the middle of the face.
            // Faces in front: land on reaching their back edge.
            const edge = (c: number) =>
              inFront ? -1 + Math.abs(c) - FRONT_REACH : 0;
            const g0 = d0 - edge(c0);
            const g1 = d1 - edge(c1);
            if (!(g0 < 0 && g1 >= 0)) continue;

            const f = g0 / (g0 - g1);
            const c = c0 + (c1 - c0) * f;
            if (Math.abs(c) > (inFront ? 1 : 2 * LANDING_MARGIN)) continue;

            const point = lerp(from, to, f);
            consider(
              piece,
              slideAlongView(point, piece.cell.z + rest - point.z),
              f,
            );
          }
        }
      }
    }

    const found = best as { piece: Piece; point: Vec3 } | null;
    return found && { piece: found.piece, point: found.point };
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

    // Settle from where it landed into the groove, then follow it out
    const local = {
      x: clamp(point.x - piece.cell.x, -0.5, 0.5),
      y: clamp(point.y - piece.cell.y, -0.5, 0.5),
    };
    const route = routeToExit(piece.kind, piece.rotation, exit);
    const { point: inGroove, next } = nearestOnRoute(route, local);
    const path = pathOnPiece(
      piece,
      [local, inGroove, ...route.slice(next)],
      false,
      piece.cell.z + marbleHeightAt(piece.kind, piece.rotation, local),
    );

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
    const entrySide = oppositeDirection(arriving);

    // A grooved piece with no opening on this side is a solid wall
    if (
      hasGroove(piece.kind) &&
      !piecePorts(piece.kind, piece.rotation).includes(entrySide)
    ) {
      const edge = pathOnPiece(
        piece,
        [DIRECTION_VECTORS[entrySide], DIRECTION_VECTORS[entrySide]].map(
          (v) => ({ x: v.x / 2, y: v.y / 2 }),
        ),
      );
      marble.speed *= PHYSICS.BOUNCE_KEEP;
      this.snapTo(marble, edge.points[0]);
      marble.rolling = { piece, path: edge, distance: 0, exit: entrySide };
      return;
    }

    const exit = this.pick(pieceExits(piece.kind, piece.rotation, arriving));
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

    // Heading towards the camera, it can land on anything that looks below
    // it. Heading away, it drops behind pieces that are in front of it.
    marble.headingForward = direction === "+x" || direction === "+y";

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

/**
 * A path across a piece through points relative to its centre, at resting
 * height. `startHeight` overrides the height of the first point, for a
 * marble that landed off the groove and rolls down into it.
 */
function pathOnPiece(
  piece: Piece,
  points: { x: number; y: number }[],
  turns = false,
  startHeight?: number,
): Path {
  const { x, y, z } = piece.cell;
  const height = z + restHeight(piece.kind);
  return new Path(
    points.map((p, index) => ({
      x: x + p.x,
      y: y + p.y,
      z: index === 0 && startHeight !== undefined ? startHeight : height,
    })),
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
