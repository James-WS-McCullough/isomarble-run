import { cupPosition, SEESAW, seesawAxis } from "../seesaw";
import type { Piece } from "../track";
import {
  FLYING,
  type Held,
  type Marble,
  type SimulationEvent,
  snapTo,
} from "./marble";
import { clamp } from "./vector";

interface SeesawState {
  /** Which end is down (±1) */
  down: number;
  /** The marble waiting in the low cup */
  held: Marble | null;
  /** How far it's tipped (radians; positive lowers the +1 end) */
  tilt: number;
}

/**
 * The cup seesaws on the track. A marble waits in the low cup; one landing
 * in the high cup tips the seesaw over and flings the waiting marble.
 */
export class Seesaws {
  private readonly states = new Map<string, SeesawState>();

  /** How far a seesaw is tipped (radians; positive lowers its +1 end) */
  tilt(pieceId: string): number {
    return this.states.get(pieceId)?.tilt ?? SEESAW.TILT;
  }

  /** Forget seesaws that are gone, dropping anything they held */
  keepOnly(pieces: Map<string, Piece>) {
    for (const [id, state] of this.states) {
      if (pieces.get(id)?.kind !== "seesaw") {
        this.states.delete(id);
        if (state.held) state.held.motion = FLYING;
      }
    }
  }

  /** Empty every cup */
  clear() {
    for (const state of this.states.values()) state.held = null;
  }

  /** Tip each seesaw towards its low end */
  step(dt: number, marbles: Marble[]) {
    for (const state of this.states.values()) {
      const target = state.down * SEESAW.TILT;
      state.tilt += clamp(
        target - state.tilt,
        -SEESAW.TIP_SPEED * dt,
        SEESAW.TIP_SPEED * dt,
      );
      if (state.held && !marbles.includes(state.held)) state.held = null;
    }
  }

  /**
   * Land in one of a seesaw's cups. The low cup holds one marble. Landing
   * in the high cup tips the seesaw over: the marble waiting in the other
   * cup is flung into the air, and the new one waits in its place.
   */
  land(marble: Marble, piece: Piece, events: SimulationEvent[]) {
    const state = this.stateOf(piece);
    const axis = seesawAxis(piece);
    const along =
      (marble.position.x - piece.cell.x) * axis.x +
      (marble.position.y - piece.cell.y) * axis.y;
    // Right over the stand, it rolls down into the low cup
    const side = Math.abs(along) < 0.1 ? state.down : Math.sign(along);
    const impact = Math.abs(marble.velocity.z);
    events.push({ type: "land", marbleId: marble.id, impact });
    events.push({ type: "visit", pieceId: piece.id, marbleId: marble.id });

    if (side === state.down && state.held) {
      // That cup's full: bounce off it
      marble.motion = FLYING;
      marble.velocity = {
        x: axis.x * side * SEESAW.LAUNCH_OUT,
        y: axis.y * side * SEESAW.LAUNCH_OUT,
        z: SEESAW.BOUNCE_UP,
      };
      marble.headingForward = axis.x * side + axis.y * side > 0;
      return;
    }

    if (side !== state.down) {
      // Tip over and fling whatever was waiting in the other cup
      const waiting = state.held;
      state.down = side;
      if (waiting) {
        const out = -side;
        waiting.motion = FLYING;
        waiting.velocity = {
          x: axis.x * out * SEESAW.LAUNCH_OUT,
          y: axis.y * out * SEESAW.LAUNCH_OUT,
          z: SEESAW.LAUNCH_UP,
        };
        waiting.headingForward = axis.x * out + axis.y * out > 0;
      }
    }

    state.held = marble;
    marble.motion = { mode: "held", piece, side };
    marble.velocity = { x: 0, y: 0, z: 0 };
    snapTo(marble, cupPosition(piece, side, state.tilt));
  }

  /** Ride along in a seesaw cup as it tips */
  stepHeld(marble: Marble, held: Held) {
    const state = this.stateOf(held.piece);
    if (state.held !== marble) {
      marble.motion = FLYING;
      return;
    }
    marble.position = cupPosition(held.piece, held.side, state.tilt);
  }

  private stateOf(piece: Piece): SeesawState {
    let state = this.states.get(piece.id);
    if (!state) {
      state = { down: 1, held: null, tilt: SEESAW.TILT };
      this.states.set(piece.id, state);
    }
    return state;
  }
}
