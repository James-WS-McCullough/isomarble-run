import type { Simulation, SimulationEvent } from "./simulation";
import type { Piece } from "./track";

/** Helpers shared by the simulation tests */

/** Run the simulation for a while, a frame at a time, collecting its events */
export function run(sim: Simulation, seconds: number): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...sim.advance(1 / 60));
  return events;
}

/** Run the simulation a frame at a time until `done`, for at most 10s */
export function runUntil(sim: Simulation, done: () => boolean, seconds = 10) {
  for (let t = 0; t < seconds && !done(); t += 1 / 60) sim.advance(1 / 60);
}

/** Ids of the pieces marbles visited, in order */
export function visitedIds(events: SimulationEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === "visit" ? [event.pieceId] : [],
  );
}

/** The pieces marbles visited, in order, named like "straight@1,0,2" */
export function visited(events: SimulationEvent[], pieces: Piece[]): string[] {
  const names = new Map(
    pieces.map((p) => [p.id, `${p.kind}@${p.cell.x},${p.cell.y},${p.cell.z}`]),
  );
  return visitedIds(events).map((id) => names.get(id) ?? "?");
}

/** Random numbers from a list, then 0.5 forever */
export function sequence(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}
