import type { Direction } from "../directions";
import type { Piece } from "../track";

/**
 * The flip-flop switches on the track, and which way each one's flipper
 * points. Sides are the piece's own, before it's turned: -y or +y.
 */
export class Switches {
  private readonly sides = new Map<string, Direction>();

  /** Which branch a switch sends the next marble down */
  side(pieceId: string): Direction {
    return this.sides.get(pieceId) ?? "-y";
  }

  /**
   * The branch a marble coming down the stem takes. It knocks the flipper
   * over, so the next marble goes the other way.
   */
  take(pieceId: string): Direction {
    const side = this.side(pieceId);
    this.sides.set(pieceId, side === "-y" ? "+y" : "-y");
    return side;
  }

  /** Forget switches that are gone */
  keepOnly(pieces: Map<string, Piece>) {
    for (const id of this.sides.keys()) {
      if (pieces.get(id)?.kind !== "flipflop") this.sides.delete(id);
    }
  }
}
