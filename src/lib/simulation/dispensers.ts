import type { Piece } from "../track";

/** Seconds between marbles from a dispenser */
export const DISPENSE_EVERY = 2;
/** Seconds before a new dispenser lets out its first marble */
const FIRST_AFTER = 0.5;
/** Dispensers stop while there are this many marbles about */
export const MAX_MARBLES = 60;

/**
 * The dispensers on the track and when each next lets out a marble.
 * Each keeps its own timer, which starts when it's placed.
 */
export class Dispensers {
  private readonly next = new Map<string, number>();
  private time = 0;

  /** Follow the dispensers on a new track, keeping the timers of old ones */
  keepOnly(pieces: Piece[]) {
    const ids = new Set<string>();
    for (const piece of pieces) {
      if (piece.kind !== "dispenser") continue;
      ids.add(piece.id);
      if (!this.next.has(piece.id)) {
        this.next.set(piece.id, this.time + FIRST_AFTER);
      }
    }
    for (const id of this.next.keys()) {
      if (!ids.has(id)) this.next.delete(id);
    }
  }

  /**
   * Move time on, returning the ids of the dispensers due to let out a
   * marble. While the board is full they wait, and go again once there's
   * room.
   */
  step(dt: number, marbleCount: number): string[] {
    this.time += dt;
    const due: string[] = [];
    let count = marbleCount;
    for (const [id, at] of this.next) {
      if (this.time < at) continue;
      if (count >= MAX_MARBLES) {
        this.next.set(id, this.time + DISPENSE_EVERY);
        continue;
      }
      due.push(id);
      count++;
      this.next.set(id, at + DISPENSE_EVERY);
    }
    return due;
  }
}
