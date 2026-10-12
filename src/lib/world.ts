import type { Block } from "./block-types";
import { type GridPosition, positionKey } from "./isometric";
import {
  createMarble,
  isOffGrid,
  type MarbleState,
  stepMarble,
} from "./marble-state-machine";

/**
 * Everything on the board: the track and the marbles rolling on it
 */
export interface World {
  blocks: Block[];
  marbles: MarbleState[];
}

export type WorldAction =
  | { type: "step" }
  | { type: "addMarble"; position: GridPosition }
  | { type: "clearMarbles" }
  | { type: "resetColours" }
  | { type: "updateBlocks"; update: (blocks: Block[]) => Block[] };

export const EMPTY_WORLD: World = { blocks: [], marbles: [] };

export function worldReducer(world: World, action: WorldAction): World {
  switch (action.type) {
    case "step":
      return stepWorld(world);
    case "addMarble":
      return {
        ...world,
        marbles: [...world.marbles, createMarble(action.position)],
      };
    case "clearMarbles":
      return { ...world, marbles: [] };
    case "resetColours":
      return {
        ...world,
        blocks: world.blocks.map((block) => ({ ...block, hue: undefined })),
      };
    case "updateBlocks":
      return { ...world, blocks: action.update(world.blocks) };
  }
}

/**
 * Advance every marble one step. Marbles that roll off a block paint it
 * with their colour, and marbles that leave the grid are removed.
 */
export function stepWorld(world: World): World {
  if (world.marbles.length === 0) return world;

  const stepped = world.marbles.map((marble) =>
    stepMarble(marble, world.blocks),
  );

  const paint = new Map<string, number>();
  stepped.forEach((marble, index) => {
    if (marble.state === "rolling") {
      paint.set(positionKey(world.marbles[index].gridPosition), marble.hue);
    }
  });

  const blocks =
    paint.size === 0
      ? world.blocks
      : world.blocks.map((block) => {
          const hue = paint.get(positionKey(block.position));
          return hue === undefined || hue === block.hue
            ? block
            : { ...block, hue };
        });

  return {
    blocks,
    marbles: stepped.filter((marble) => !isOffGrid(marble.gridPosition)),
  };
}
