import { FAN_WELL } from "./pieces";
import { GROOVE_REST_HEIGHT } from "./space";
import type { TrackIndex } from "./track";

/** How far a fan's air rises in the open: about as high as it kicks a marble */
const OPEN_AIR_RISE = 2.5;

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
 * The air rising from each fan: up through open air, stopped by a solid
 * piece, or sucked all the way up a tube column within its reach, just as
 * marbles are
 */
export function airStreams(track: TrackIndex): AirStream[] {
  const streams: AirStream[] = [];
  for (const fan of track.pieces) {
    if (fan.kind !== "fan") continue;
    const { x, y, z } = fan.cell;
    const from = z + 0.5 - FAN_WELL.DEPTH;
    const reached = track.reachedByFan(fan);
    const column = reached && track.tubeColumn({ x, y, z: reached.cell.z });

    if (column) {
      // Up the column and out of its top, or its spout if an outlet caps it
      const to = column.top + (column.capped ? GROOVE_REST_HEIGHT : 0.5);
      streams.push({ x, y, from, to, tubeFrom: column.bottom - 0.5 });
    } else if (reached) {
      streams.push({ x, y, from, to: reached.cell.z - 0.5, tubeFrom: null });
    } else {
      streams.push({ x, y, from, to: z + 0.5 + OPEN_AIR_RISE, tubeFrom: null });
    }
  }
  return streams;
}
