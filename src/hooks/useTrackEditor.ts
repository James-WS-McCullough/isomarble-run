"use client";

import { useState } from "react";
import { BLOCK_TYPES, type Block, getBlockBehavior } from "@/lib/block-types";
import {
  blocksInScreenRect,
  changeBlockHeight,
  moveBlocks,
  toggleBlockAt,
} from "@/lib/editing";
import {
  type GridPosition,
  type IsometricGridConfig,
  type ScreenPosition,
  samePosition,
} from "@/lib/isometric";

export type Tool = "place" | "move" | "select" | "marble" | "deepen";

/** Where the pointer is on the board, and which block (if any) it is over */
export interface BoardPointer {
  grid: GridPosition;
  screen: ScreenPosition;
  blockId: string | null;
}

interface Drag {
  start: GridPosition;
  origins: Map<string, GridPosition>;
}

export interface SelectionRect {
  start: ScreenPosition;
  end: ScreenPosition;
}

interface TrackEditorOptions {
  blocks: Block[];
  updateBlocks: (update: (blocks: Block[]) => Block[]) => void;
  addMarble: (position: GridPosition) => void;
  config: IsometricGridConfig;
}

/**
 * Editor state and pointer handling for each tool:
 * - place: click a cell to add the selected block, or remove an existing one
 * - move: drag a single block
 * - select: drag a rectangle to select blocks, then drag the selection
 * - marble: click to drop a marble
 * - deepen: left-click a block to add a wall layer, right-click to remove one
 */
export function useTrackEditor({
  blocks,
  updateBlocks,
  addMarble,
  config,
}: TrackEditorOptions) {
  const [tool, setToolState] = useState<Tool>("place");
  const [paletteBlock, setPaletteBlock] = useState(BLOCK_TYPES[0].blockName);
  const [hover, setHover] = useState<GridPosition | null>(null);
  const [pressedAt, setPressedAt] = useState<GridPosition | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const setTool = (nextTool: Tool) => {
    setToolState(nextTool);
    setHover(null);
    setPressedAt(null);
    setDrag(null);
    setSelectionRect(null);
    setSelectedIds([]);
  };

  const startDrag = (ids: string[], start: GridPosition) => {
    const origins = new Map(
      blocks
        .filter((block) => ids.includes(block.id))
        .map((block) => [block.id, block.position]),
    );
    setDrag({ start, origins });
  };

  const onPointerDown = (pointer: BoardPointer, button: number) => {
    const { grid, screen, blockId } = pointer;

    if (button === 2) {
      if (tool === "deepen" && blockId) {
        updateBlocks((current) => changeBlockHeight(current, blockId, -1));
      }
      return;
    }
    if (button !== 0) return;

    setPressedAt(grid);

    if (tool === "move" && blockId) {
      startDrag([blockId], grid);
    } else if (tool === "select") {
      if (blockId && selectedIds.includes(blockId)) {
        startDrag(selectedIds, grid);
      } else {
        setSelectedIds([]);
        setSelectionRect({ start: screen, end: screen });
      }
    } else if (tool === "deepen" && blockId) {
      updateBlocks((current) => changeBlockHeight(current, blockId, 1));
    }
  };

  const onPointerMove = ({ grid, screen }: BoardPointer) => {
    setHover(grid);

    if (drag) {
      const offset = { x: grid.x - drag.start.x, y: grid.y - drag.start.y };
      updateBlocks((current) => moveBlocks(current, drag.origins, offset));
    }

    if (selectionRect) {
      const rect = { ...selectionRect, end: screen };
      setSelectionRect(rect);
      setSelectedIds(blocksInScreenRect(blocks, rect.start, rect.end, config));
    }
  };

  const onPointerUp = ({ grid }: BoardPointer) => {
    const isClick = pressedAt !== null && samePosition(pressedAt, grid);
    setPressedAt(null);
    setDrag(null);
    setSelectionRect(null);

    if (!isClick) return;
    if (tool === "place") {
      updateBlocks((current) => toggleBlockAt(current, grid, paletteBlock));
    } else if (tool === "marble") {
      addMarble(grid);
    }
  };

  const onPointerLeave = () => {
    // Leaving the board cancels a drag and puts the blocks back
    if (drag) {
      updateBlocks((current) =>
        current.map((block) => {
          const origin = drag.origins.get(block.id);
          return origin ? { ...block, position: origin } : block;
        }),
      );
    }
    setHover(null);
    setPressedAt(null);
    setDrag(null);
    setSelectionRect(null);
  };

  const paletteSprite =
    getBlockBehavior(paletteBlock)?.blockPath ?? BLOCK_TYPES[0].blockPath;

  return {
    tool,
    setTool,
    paletteBlock,
    setPaletteBlock,
    selectedIds,
    selectionRect,
    draggingIds: drag ? [...drag.origins.keys()] : [],
    previewBlock:
      tool === "place" && hover
        ? { position: hover, spritePath: paletteSprite }
        : undefined,
    previewMarble: tool === "marble" && hover ? hover : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
}
