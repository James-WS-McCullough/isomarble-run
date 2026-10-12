import { type Block, createBlock } from "./block-types";
import {
  type GridPosition,
  gridToScreen,
  type IsometricGridConfig,
  positionKey,
  type ScreenPosition,
  samePosition,
} from "./isometric";

/**
 * Remove the block at a position, or add a new one if the cell is empty
 */
export function toggleBlockAt(
  blocks: Block[],
  position: GridPosition,
  blockName: string,
): Block[] {
  const existing = blocks.find((block) =>
    samePosition(block.position, position),
  );
  if (existing) {
    return blocks.filter((block) => block.id !== existing.id);
  }
  return [...blocks, createBlock(blockName, position)];
}

/**
 * Move a group of blocks by an offset from their original positions.
 * If any block would land on a cell occupied by a block outside the group,
 * nothing moves, so blocks never stack on the same cell.
 */
export function moveBlocks(
  blocks: Block[],
  origins: Map<string, GridPosition>,
  offset: GridPosition,
): Block[] {
  const occupied = new Set(
    blocks
      .filter((block) => !origins.has(block.id))
      .map((block) => positionKey(block.position)),
  );

  const targets = new Map<string, GridPosition>();
  for (const [id, origin] of origins) {
    const target = { x: origin.x + offset.x, y: origin.y + offset.y };
    if (occupied.has(positionKey(target))) return blocks;
    targets.set(id, target);
  }

  let changed = false;
  const moved = blocks.map((block) => {
    const target = targets.get(block.id);
    if (!target || samePosition(target, block.position)) return block;
    changed = true;
    return { ...block, position: target };
  });
  return changed ? moved : blocks;
}

/**
 * Change a block's wall height, never going below zero
 */
export function changeBlockHeight(
  blocks: Block[],
  blockId: string,
  delta: number,
): Block[] {
  return blocks.map((block) =>
    block.id === blockId
      ? { ...block, height: Math.max(0, block.height + delta) }
      : block,
  );
}

/**
 * IDs of blocks whose centre lies inside a screen-space rectangle
 */
export function blocksInScreenRect(
  blocks: Block[],
  corner1: ScreenPosition,
  corner2: ScreenPosition,
  config: IsometricGridConfig,
): string[] {
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxY = Math.max(corner1.y, corner2.y);

  return blocks
    .filter((block) => {
      const centre = gridToScreen(block.position, config);
      return (
        centre.x >= minX &&
        centre.x <= maxX &&
        centre.y >= minY &&
        centre.y <= maxY
      );
    })
    .map((block) => block.id);
}
