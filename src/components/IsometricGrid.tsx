"use client";

import { type MouseEvent, useMemo } from "react";
import type { BoardPointer, SelectionRect } from "@/hooks/useTrackEditor";
import {
  type Block,
  getBlockBehavior,
  WALL_SPRITE_PATH,
} from "@/lib/block-types";
import {
  depthZIndex,
  GRID_MAX,
  GRID_MIN,
  type GridPosition,
  gridToScreen,
  type IsometricGridConfig,
  screenToGrid,
} from "@/lib/isometric";
import type { MarbleState } from "@/lib/marble-state-machine";
import { IsometricSprite } from "./IsometricSprite";
import { Marble } from "./Marble";

interface IsometricGridProps {
  config: IsometricGridConfig;
  width: number;
  height: number;
  blocks: Block[];
  marbles: MarbleState[];
  previewBlock?: { position: GridPosition; spritePath: string };
  previewMarble?: GridPosition;
  isAutoMode?: boolean;
  /** Whether blocks respond to the pointer (move, select and deepen tools) */
  blocksInteractive?: boolean;
  selectedIds?: string[];
  draggingIds?: string[];
  selectionRect?: SelectionRect | null;
  onPointerDown: (pointer: BoardPointer, button: number) => void;
  onPointerMove: (pointer: BoardPointer) => void;
  onPointerUp: (pointer: BoardPointer) => void;
  onPointerLeave: () => void;
}

/**
 * The board: renders blocks, walls and marbles, and reports pointer events
 * in grid and screen coordinates (relative to the board centre).
 */
export function IsometricGrid({
  config,
  width,
  height,
  blocks,
  marbles,
  previewBlock,
  previewMarble,
  isAutoMode = false,
  blocksInteractive = false,
  selectedIds = [],
  draggingIds = [],
  selectionRect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: IsometricGridProps) {
  const toPointer = (event: MouseEvent<HTMLDivElement>): BoardPointer => {
    const rect = event.currentTarget.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left - width / 2,
      y: event.clientY - rect.top - height / 2,
    };
    const blockElement = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-block-id]",
    );
    return {
      grid: screenToGrid(screen, config),
      screen,
      blockId: blockElement?.dataset.blockId ?? null,
    };
  };

  const gridDots = useMemo(() => {
    const dots = [];
    for (let x = GRID_MIN; x <= GRID_MAX; x++) {
      for (let y = GRID_MIN; y <= GRID_MAX; y++) {
        const screenPos = gridToScreen({ x, y }, config);
        dots.push(
          <div
            key={`${x},${y}`}
            className="absolute w-1 h-1 bg-gray-300 opacity-30"
            style={{
              left: screenPos.x + width / 2,
              top: screenPos.y + height / 2,
            }}
          />,
        );
      }
    }
    return dots;
  }, [config, width, height]);

  return (
    <div
      role="application"
      aria-label="Marble run board"
      className="relative overflow-hidden select-none bg-gray-800"
      style={{ width, height }}
      onMouseDown={(event) => {
        event.preventDefault(); // Don't start a text selection
        onPointerDown(toPointer(event), event.button);
      }}
      onMouseMove={(event) => onPointerMove(toPointer(event))}
      onMouseUp={(event) => onPointerUp(toPointer(event))}
      onMouseLeave={onPointerLeave}
      onContextMenu={(event) => event.preventDefault()}
    >
      {gridDots}

      {selectionRect && (
        <div
          className="absolute border-2 border-blue-400 border-dashed pointer-events-none"
          style={{
            left:
              Math.min(selectionRect.start.x, selectionRect.end.x) + width / 2,
            top:
              Math.min(selectionRect.start.y, selectionRect.end.y) + height / 2,
            width: Math.abs(selectionRect.end.x - selectionRect.start.x),
            height: Math.abs(selectionRect.end.y - selectionRect.start.y),
            zIndex: 1500,
          }}
        />
      )}

      {/* Everything is positioned relative to the board centre */}
      <div
        className="absolute pointer-events-none"
        style={{ left: width / 2, top: height / 2 }}
      >
        {blocks.flatMap((block) => {
          const spritePath = getBlockBehavior(block.blockName)?.blockPath;
          if (!spritePath) return [];

          const blockZIndex = depthZIndex(block.position);
          const isDragging = draggingIds.includes(block.id);

          // Walls stack straight down the screen below the block
          const walls = Array.from({ length: block.height }, (_, index) => {
            const layer = index + 1;
            return (
              <IsometricSprite
                key={`${block.id}-wall-${layer}`}
                gridPosition={{
                  x: block.position.x + layer,
                  y: block.position.y + layer,
                }}
                spritePath={WALL_SPRITE_PATH}
                config={config}
                hue={block.hue}
                zIndex={blockZIndex - layer}
                blockId={block.id}
                interactive={blocksInteractive}
              />
            );
          });

          return [
            ...walls,
            <IsometricSprite
              key={block.id}
              gridPosition={block.position}
              spritePath={spritePath}
              config={config}
              hue={block.hue}
              blockId={block.id}
              interactive={blocksInteractive}
              isDragging={isDragging}
              isSelected={selectedIds.includes(block.id)}
            />,
          ];
        })}

        {marbles.map((marble) => (
          <Marble
            key={marble.id}
            position={gridToScreen(marble.gridPosition, config)}
            state={marble.state}
            momentum={marble.momentum}
            behindCoordinates={marble.behindCoordinates}
            warped={marble.warped}
            isAutoMode={isAutoMode}
          />
        ))}

        {previewBlock && (
          <IsometricSprite
            gridPosition={previewBlock.position}
            spritePath={previewBlock.spritePath}
            config={config}
            className="opacity-50"
          />
        )}

        {previewMarble && (
          <Marble
            position={gridToScreen(previewMarble, config)}
            warped
            className="opacity-50"
          />
        )}
      </div>
    </div>
  );
}
