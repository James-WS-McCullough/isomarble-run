import { type Direction, rotateDirection } from "../directions";
import type { Piece } from "../track";
import type { Rolling } from "./marble";

/**
 * The flip-flop switches on the track, and which branch each one's T sends
 * the next marble down. Sides are the piece's own, before it's turned: -y
 * or +y.
 */
export class Switches {
  private readonly sides = new Map<string, Direction>();

  /** Which branch a switch sends the next marble down */
  side(pieceId: string): Direction {
    return this.sides.get(pieceId) ?? "-y";
  }

  /**
   * A marble rolling out down a branch pushes the T's arm on that side,
   * rocking it over so the next marble goes the other way
   */
  flip(pieceId: string) {
    this.sides.set(pieceId, this.side(pieceId) === "-y" ? "+y" : "-y");
  }

  /** Forget switches that are gone */
  keepOnly(pieces: Map<string, Piece>) {
    for (const id of this.sides.keys()) {
      if (pieces.get(id)?.kind !== "flipflop") this.sides.delete(id);
    }
  }
}

/**
 * Whether a marble rolling across a flip-flop is heading out down a branch
 * (rather than up one into the stem), so it pushes the T over as it goes
 */
export function pushesFlipFlop(rolling: Rolling): boolean {
  const { rotation } = rolling.piece;
  const exit = rotateDirection(rolling.exit, -rotation);
  const entry = rolling.entry && rotateDirection(rolling.entry, -rotation);
  const fromBranch = entry === "-y" || entry === "+y";
  return (exit === "-y" || exit === "+y") && !fromBranch;
}
