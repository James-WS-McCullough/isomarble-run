import { FAN_WELL } from "./grooves";
import { isTube } from "./pieces";
import { PHYSICS } from "./simulation";
import { GROOVE_REST_HEIGHT } from "./space";
import type { TrackIndex } from "./track";

/** How far a fan's air rises in the open: as high as it kicks a marble */
const OPEN_AIR_RISE = 2;

/** A column of air rising from a fan, for drawing */
export interface AirStream {
  x: number;
  y: number;
  /** Heights it rises between */
  from: number;
  to: number;
  /** Where it goes into a tube, or null if it rises through open air */
  tubeFrom: number | null;
}

/**
 * The air rising from each fan: up through open air, or sucked all the way
 * up a tube column within reach above it, as marbles are
 */
export function airStreams(track: TrackIndex): AirStream[] {
  const streams: AirStream[] = [];
  for (const fan of track.pieces) {
    if (fan.kind !== "fan") continue;
    const { x, y, z } = fan.cell;
    const tubeAt = (level: number) => {
      const piece = track.pieceAt({ x, y, z: level });
      return piece !== undefined && isTube(piece.kind);
    };

    let to = z + 0.5 + OPEN_AIR_RISE;
    let tubeFrom: number | null = null;
    for (let level = z + 1; level <= z + 1 + PHYSICS.FAN_REACH; level++) {
      const piece = track.pieceAt({ x, y, z: level });
      if (!piece) continue;
      if (isTube(piece.kind)) {
        let top = level;
        while (tubeAt(top + 1)) top++;
        // An outlet at the top is capped: the air leaves through its spout
        const capped = track.pieceAt({ x, y, z: top })?.kind === "outlet";
        to = top + (capped ? GROOVE_REST_HEIGHT : 0.5);
        tubeFrom = level - 0.5;
      } else {
        // Blocked by a solid piece
        to = level - 0.5;
      }
      break;
    }
    streams.push({ x, y, from: z + 0.5 - FAN_WELL.DEPTH, to, tubeFrom });
  }
  return streams;
}
