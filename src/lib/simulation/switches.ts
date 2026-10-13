import type { Direction } from "../directions";
import type { Piece } from "../track";

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
