import {
  DIRECTION_VECTORS,
  type Direction,
  directionOfVelocity,
  oppositeDirection,
} from "./directions";
import { marbleHeightAt, nearestOnRoute, routeToExit } from "./grooves";
import { Path, routeBetween } from "./paths";
import { hasGroove, isTube, pieceExits, piecePorts } from "./pieces";
import {
  depthOf,
  fromScreen,
  GROOVE_REST_HEIGHT,
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
  /** How bouncy marbles are when they hit each other (1 is perfectly) */
  MARBLE_BOUNCE: 0.9,
  /** Speed marbles are blown up tubes by a fan */
  AIR_SPEED: 4,
  /** How quickly a fan gets a marble up to speed */
  AIR_ACCELERATION: 30,
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
    /** Side it rolled in from, or null if it landed on the piece */
    entry: Direction | null;
  } | null;
  /** Set while inside a glass tube: the column it's in */
  tube: { x: number; y: number } | null;
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
  | { type: "hit"; impact: number }
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
      if (
        marble.tube &&
        this.tubeCell(marble.tube, marble.position.z) === null
      ) {
        marble.tube = null;
      }
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
      tube: null,
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
      } else if (marble.tube) {
        this.stepInTube(marble, dt, events);
      } else if (!this.stepFlying(marble, dt, events)) {
        events.push({ type: "removed", marbleId: marble.id });
        continue;
      }
      marble.visualOffset = scale(marble.visualOffset, decay);
      kept.push(marble);
    }

    this.marbles = kept;
    this.collideMarbles(events);
  }

  /**
   * Marbles bump into each other. Two marbles collide when they visibly
   * overlap and either really touch, or are rolling along track that is
   * visibly joined (even if the join hides a change in depth). Marbles that
   * only overlap because one is passing in front of the other don't.
   */
  private collideMarbles(events: SimulationEvent[]) {
    const reach = 2 * MARBLE_RADIUS;
    for (let i = 0; i < this.marbles.length; i++) {
      for (let j = i + 1; j < this.marbles.length; j++) {
        const a = this.marbles[i];
        const b = this.marbles[j];
        const apart = subtract(a.position, b.position);
        const seen = visiblePart(apart);
        const seenDistance = length(seen);
        if (seenDistance >= reach) continue;

        const distance = length(apart);
        const touching = distance < reach;
        if (!touching && !this.onJoinedTrack(a, b)) continue;

        const normal = touching
          ? scale(apart, 1 / Math.max(distance, 1e-9))
          : scale(seen, 1 / Math.max(seenDistance, 1e-9));
        const va = this.velocityOf(a);
        const vb = this.velocityOf(b);
        const closing = dot(subtract(va, vb), normal);
        if (closing >= 0) continue;

        // Equal masses: swap the parts of their velocities along the normal
        const impulse = (-(1 + PHYSICS.MARBLE_BOUNCE) / 2) * closing;
        this.setVelocity(a, add(va, scale(normal, impulse)));
        this.setVelocity(b, subtract(vb, scale(normal, impulse)));
        events.push({ type: "hit", impact: -closing });
      }
    }
  }

  /** Both rolling on the same piece, or on pieces that visibly join */
  private onJoinedTrack(a: Marble, b: Marble): boolean {
    const ra = a.rolling;
    const rb = b.rolling;
    if (!ra || !rb) return false;
    return (
      ra.piece === rb.piece ||
      this.track.findConnection(ra.piece, ra.exit) === rb.piece ||
      this.track.findConnection(rb.piece, rb.exit) === ra.piece
    );
  }

  private velocityOf(marble: Marble): Vec3 {
    const rolling = marble.rolling;
    if (marble.tube) return { x: 0, y: 0, z: marble.velocity.z };
    if (!rolling) return marble.velocity;
    return scale(rolling.path.tangentAt(rolling.distance), marble.speed);
  }

  /**
   * Give a marble a new velocity. A rolling marble keeps only the part along
   * its groove, turning round if that points backwards.
   */
  private setVelocity(marble: Marble, velocity: Vec3) {
    const rolling = marble.rolling;
    if (marble.tube) {
      // Tubes only let marbles move up and down
      marble.velocity = { x: 0, y: 0, z: velocity.z };
      return;
    }
    if (!rolling) {
      marble.velocity = velocity;
      return;
    }
    const along = dot(velocity, rolling.path.tangentAt(rolling.distance));
    if (along >= 0) {
      marble.speed = along;
    } else {
      this.turnAround(marble);
      marble.speed = -along;
    }
  }

  /** Roll back the way it came */
  private turnAround(marble: Marble) {
    const rolling = marble.rolling;
    if (!rolling) return;
    const { piece } = rolling;

    if (rolling.entry) {
      const path = new Path(rolling.path.backFrom(rolling.distance));
      marble.rolling = {
        piece,
        path,
        distance: 0,
        exit: rolling.entry,
        entry: rolling.exit,
      };
      return;
    }

    // It landed here, so head out the other way through the middle
    const exit = this.pick(
      pieceExits(piece.kind, piece.rotation, oppositeDirection(rolling.exit)),
    );
    const here = rolling.path.pointAt(rolling.distance);
    const v = DIRECTION_VECTORS[exit];
    const path = pathOnPiece(
      piece,
      densify([
        { x: here.x - piece.cell.x, y: here.y - piece.cell.y },
        { x: 0, y: 0 },
        { x: v.x / 2, y: v.y / 2 },
      ]),
    );
    marble.rolling = { piece, path, distance: 0, exit, entry: null };
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
        this.enterPiece(
          marble,
          next,
          rolling.exit,
          !hasGroove(rolling.piece.kind),
          events,
        );
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

    // Landing on a face it visibly reaches wins over clipping the wall
    // underneath that face
    const landing = this.findLanding(marble, before, after);
    if (landing) {
      this.land(marble, landing, events);
      return true;
    }

    this.bounceOffWalls(marble, before);

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
            const faceHeight = piece.cell.z + rest - 0.05;
            const inFront = faceHeight > to.z;
            if (inFront && !marble.headingForward) continue;

            // Down the screen (d) and across it (c), relative to the face
            const d0 = a0 - A + (b0 - B);
            const d1 = a1 - A + (b1 - B);
            const c0 = a0 - A - (b0 - B);
            const c1 = a1 - A - (b1 - B);

            let f: number;
            if (!inFront) {
              // Faces behind: land on passing the middle of the face
              if (!(d0 < 0 && d1 >= 0)) continue;
              f = d0 / (d0 - d1);
            } else {
              // Faces in front: land on reaching their back edge
              const edge = (c: number) => -1 + Math.abs(c) - FRONT_REACH;
              const g0 = d0 - edge(c0);
              const g1 = d1 - edge(c1);
              if (g1 < 0) continue;
              if (g0 < 0) {
                f = g0 / (g0 - g1);
              } else if (faceHeight <= from.z) {
                // The face came in front of the marble just as it reached the
                // face's back edge (not once it was over the face already)
                f = (from.z - faceHeight) / (from.z - to.z);
                if (d0 + (d1 - d0) * f > 0) continue;
              } else {
                continue;
              }
            }

            const c = c0 + (c1 - c0) * f;
            const d = d0 + (d1 - d0) * f;
            if (Math.abs(c) > (inFront ? 1 : 2 * LANDING_MARGIN)) continue;
            // Already past the face on screen
            if (d > 1) continue;

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

  /** Whether there's a tube (or outlet) at this height in a column */
  private tubeAt(column: { x: number; y: number }, z: number): boolean {
    const piece = this.track.pieceAt({ x: column.x, y: column.y, z });
    return piece !== undefined && isTube(piece.kind);
  }

  /**
   * Which tube in a column a marble at height `z` is inside, or null.
   * Marbles enter and leave tubes level with the track, a little above the
   * top of the tube's cell, so that counts as inside the tube below.
   */
  private tubeCell(column: { x: number; y: number }, z: number): number | null {
    const cell = Math.round(z);
    if (this.tubeAt(column, cell)) return cell;
    if (this.tubeAt(column, cell - 1) && z < cell - 0.5 + 0.1) return cell - 1;
    return null;
  }

  /** Start travelling inside the tube column a piece is part of */
  private enterTube(
    marble: Marble,
    piece: Piece,
    z: number,
    verticalSpeed: number,
  ) {
    marble.rolling = null;
    marble.tube = { x: piece.cell.x, y: piece.cell.y };
    marble.velocity = { x: 0, y: 0, z: verticalSpeed };
    this.snapTo(marble, { x: piece.cell.x, y: piece.cell.y, z });
  }

  /**
   * Move up or down a column of tubes: falling, or blown up by a fan at the
   * bottom. Marbles blown up to an outlet leave through its spout.
   */
  private stepInTube(marble: Marble, dt: number, events: SimulationEvent[]) {
    const column = marble.tube;
    if (!column) return;
    const z = marble.position.z;
    const cell = this.tubeCell(column, z);
    if (cell === null) {
      marble.tube = null;
      return;
    }

    let bottom = cell;
    while (this.tubeAt(column, bottom - 1)) bottom--;
    let top = cell;
    while (this.tubeAt(column, top + 1)) top++;
    const base = this.track.pieceAt({
      x: column.x,
      y: column.y,
      z: bottom - 1,
    });
    const blown = base?.kind === "fan";

    const v = marble.velocity;
    if (blown) {
      const change = clamp(
        PHYSICS.AIR_SPEED - v.z,
        -PHYSICS.AIR_ACCELERATION * dt,
        PHYSICS.AIR_ACCELERATION * dt,
      );
      v.z += change;
    } else {
      v.z = Math.max(v.z - PHYSICS.GRAVITY * dt, -PHYSICS.MAX_SPEED);
    }
    let after = z + v.z * dt;

    if (v.z > 0) {
      // Out of the spout of an outlet it rises past
      for (let level = cell; level <= Math.round(after); level++) {
        const piece = this.track.pieceAt({
          x: column.x,
          y: column.y,
          z: level,
        });
        const spout = level + GROOVE_REST_HEIGHT;
        if (piece?.kind === "outlet" && z < spout && after >= spout) {
          this.leaveThroughSpout(marble, piece, v.z, events);
          return;
        }
      }
      // Out of the open top of the column, to fall back in (an outlet at
      // the top is an elbow, so marbles leave through its spout instead)
      const capped =
        this.track.pieceAt({ x: column.x, y: column.y, z: top })?.kind ===
        "outlet";
      if (!capped && after > top + 0.5) {
        marble.tube = null;
        marble.headingForward = true;
      }
    } else if (base && !blown) {
      // Dropping out of the bottom onto the piece below
      const landing = bottom - 1 + restHeight(base.kind);
      if (after <= landing) {
        marble.tube = null;
        this.land(
          marble,
          { piece: base, point: { x: column.x, y: column.y, z: landing } },
          events,
        );
        return;
      }
    } else if (blown) {
      // The fan keeps it from dropping into the fan itself
      after = Math.max(after, bottom - 0.5 + MARBLE_RADIUS);
    } else if (after < bottom - 0.5) {
      // Out of the bottom into thin air
      marble.tube = null;
      marble.headingForward = false;
    }

    marble.position = { x: column.x, y: column.y, z: after };
  }

  private leaveThroughSpout(
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
    marble.tube = null;
    marble.velocity = { x: 0, y: 0, z: 0 };
    marble.speed = Math.max(PHYSICS.CRUISE_SPEED, verticalSpeed * 0.8);
    this.snapTo(marble, path.points[0]);
    marble.rolling = { piece: outlet, path, distance: 0, exit, entry: null };
    events.push({ type: "paint", pieceId: outlet.id, hue: marble.hue });
  }

  private land(
    marble: Marble,
    landing: { piece: Piece; point: Vec3 },
    events: SimulationEvent[],
  ) {
    const { piece, point } = landing;
    const v = marble.velocity;

    // Falling into the top of a tube
    if (isTube(piece.kind)) {
      marble.position = point;
      this.enterTube(marble, piece, point.z, v.z);
      events.push({
        type: "land",
        marbleId: marble.id,
        impact: Math.abs(v.z) / 3,
      });
      return;
    }

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
    // Follow the shape of the wood as it rolls down into the groove
    const path = pathOnPiece(
      piece,
      densify([local, inGroove, ...route.slice(next)]),
    );

    marble.speed = Math.min(
      PHYSICS.MAX_SPEED,
      horizontal * PHYSICS.LANDING_KEEP_HORIZONTAL +
        Math.abs(v.z) * PHYSICS.LANDING_KEEP_VERTICAL,
    );
    marble.velocity = { x: 0, y: 0, z: 0 };
    marble.position = point;
    this.snapTo(marble, path.points[0]);
    marble.rolling = { piece, path, distance: 0, exit, entry: null };

    events.push({ type: "land", marbleId: marble.id, impact: Math.abs(v.z) });
    events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
  }

  /**
   * Roll onto a piece from a neighbour. `fromFlat` is true when coming off a
   * flat-topped block, level with the top of the piece rather than down in
   * a groove.
   */
  private enterPiece(
    marble: Marble,
    piece: Piece,
    arriving: Direction,
    fromFlat: boolean,
    events: SimulationEvent[],
  ) {
    const entrySide = oppositeDirection(arriving);
    const intoOpening = piecePorts(piece.kind, piece.rotation).includes(
      entrySide,
    );
    const throughSide = hasGroove(piece.kind) && !intoOpening;
    const { x, y, z } = piece.cell;

    // Rolling into an outlet's spout: drop down the tube
    if (piece.kind === "outlet" && intoOpening) {
      this.enterTube(marble, piece, z + restHeight(piece.kind), -0.5);
      events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
      return;
    }
    // Rolling into a fan's intake: blown up the tube above it
    if (piece.kind === "fan" && intoOpening && this.tubeAt({ x, y }, z + 1)) {
      this.enterTube(marble, piece, z + restHeight(piece.kind), 1);
      events.push({ type: "paint", pieceId: piece.id, hue: marble.hue });
      return;
    }

    // From down in a groove, a side with no opening is a solid wall, and
    // the glass sides of a tube always are. So is a fan with nothing to
    // blow the marble up into.
    const deadEnd = piece.kind === "fan" && intoOpening;
    if ((throughSide && (!fromFlat || isTube(piece.kind))) || deadEnd) {
      // Touch the wall at groove height, then head back
      const v = DIRECTION_VECTORS[entrySide];
      const wall = {
        x: piece.cell.x + v.x / 2,
        y: piece.cell.y + v.y / 2,
        z: piece.cell.z + restHeight(piece.kind),
      };
      const edge = new Path([wall, wall]);
      marble.speed *= PHYSICS.BOUNCE_KEEP;
      this.snapTo(marble, edge.points[0]);
      marble.rolling = {
        piece,
        path: edge,
        distance: 0,
        exit: entrySide,
        entry: null,
      };
      return;
    }

    const exit = this.pick(pieceExits(piece.kind, piece.rotation, arriving));
    const route = throughSide
      ? overTheRim(piece, entrySide, exit)
      : routeBetween(entrySide, exit);
    const path = pathOnPiece(piece, route.points, route.turns);

    if (route.turns) marble.speed *= PHYSICS.TURN_KEEP;
    if (entrySide === exit) marble.speed *= PHYSICS.BOUNCE_KEEP;

    this.snapTo(marble, path.points[0]);
    marble.rolling = { piece, path, distance: 0, exit, entry: entrySide };
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
 * A path across a piece through points relative to its centre, at the
 * height a marble sits at each point (resting in the groove, or higher up
 * the side of a bowl)
 */
function pathOnPiece(
  piece: Piece,
  points: { x: number; y: number }[],
  turns = false,
): Path {
  const { x, y, z } = piece.cell;
  return new Path(
    points.map((p) => ({
      x: x + p.x,
      y: y + p.y,
      z: z + marbleHeightAt(piece.kind, piece.rotation, p),
    })),
    turns,
  );
}

/**
 * Route for a marble rolling in level with the top of a piece, from a side
 * with no opening: over the rim and down into the groove (or a catcher's
 * bowl), then out of the exit. Extra points let it follow the surface.
 */
function overTheRim(
  piece: Piece,
  from: Direction,
  to: Direction,
): { points: { x: number; y: number }[]; turns: boolean } {
  const start = DIRECTION_VECTORS[from];
  const end = DIRECTION_VECTORS[to];
  if (piece.kind === "catcher") {
    return {
      points: densify([
        { x: start.x / 2, y: start.y / 2 },
        { x: 0, y: 0 },
        { x: end.x / 2, y: end.y / 2 },
      ]),
      turns: false,
    };
  }
  const route = routeBetween(from, to);
  return { points: densify(route.points), turns: route.turns };
}

/** Add points along each segment so heights can follow curved surfaces */
function densify(
  points: { x: number; y: number }[],
  spacing = 0.06,
): { x: number; y: number }[] {
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing),
    );
    for (let k = 1; k <= steps; k++) {
      result.push({
        x: a.x + ((b.x - a.x) * k) / steps,
        y: a.y + ((b.y - a.y) * k) / steps,
      });
    }
  }
  return result;
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

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
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
