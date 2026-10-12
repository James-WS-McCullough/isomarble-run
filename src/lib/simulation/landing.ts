import { depthOf, slideAlongView, type Vec3 } from "../space";
import {
  type Piece,
  REST_HEIGHTS,
  restHeight,
  type TrackIndex,
} from "../track";
import type { Landing, Marble } from "./marble";
import { lerp } from "./vector";

/** How far from the middle of a face (0.5 is its corner) a marble can land */
const LANDING_MARGIN = 0.4;
/**
 * How far a marble reaches down the screen past its contact point, in the
 * face's own units. A face in front of the marble catches it this far before
 * its back edge, so the face never hides part of the marble.
 */
const FRONT_REACH = 0.45;

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
export function findLanding(
  track: TrackIndex,
  marble: Marble,
  from: Vec3,
  to: Vec3,
): Landing | null {
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
      const piece = track.pieceAt({
        x: Math.round(point.x),
        y: Math.round(point.y),
        z: level,
      });
      if (piece && restHeight(piece.kind) === rest && !track.isCovered(piece)) {
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
        for (const piece of track.piecesInColumn({ a: A, b: B }, rest)) {
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

  // TypeScript can't see `consider` setting `best`
  const found = best as Landing | null;
  return found && { piece: found.piece, point: found.point };
}
