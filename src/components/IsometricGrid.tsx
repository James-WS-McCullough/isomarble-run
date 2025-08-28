"use client";

import React, { useRef, useCallback } from "react";
import {
  IsometricGridConfig,
  screenToGrid,
  GridPosition,
} from "@/lib/isometric";
import { IsometricSprite } from "./IsometricSprite";
import { Marble } from "./Marble";
import { gridToScreenPosition } from "@/lib/marble-state-machine";

interface IsometricGridProps {
  config: IsometricGridConfig;
  width: number;
  height: number;
  sprites?: Array<{
    position: GridPosition;
    spritePath: string;
    id: string;
    hue?: number; // Individual hue for each sprite
    height?: number; // Height of the block (number of wall layers below)
  }>;
  marbles?: Array<{
    id: string;
    gridPosition: GridPosition;
    state: "rolling" | "falling" | "behind";
    rotation: number;
    behindCoordinates?: GridPosition;
    momentum?: string;
  }>;
  previewSprite?: {
    position: GridPosition;
    spritePath: string;
  };
  previewMarble?: {
    position: GridPosition;
  };
  isAutoMode?: boolean;
  hueShift?: number; // Hue shift in degrees (0-360)
  activeTool?: "place" | "move" | "select" | "marble" | "deepen"; // Add select to activeTool prop
  selectedSpriteId?: string | null; // Add selectedSpriteId prop
  isDragging?: boolean; // Add isDragging prop
  onGridClick?: (gridPos: GridPosition) => void;
  onGridHover?: (gridPos: GridPosition) => void;
  onGridMouseDown?: (gridPos: GridPosition) => void;
  onGridMouseUp?: () => void;
  onGridMouseLeave?: () => void;
  onSelectionChange?: (gridPos: GridPosition) => void; // For selection rectangle during drag
  onScreenMouseDown?: (screenPos: {x: number, y: number}) => void; // For screen-space selection
  onScreenMouseMove?: (screenPos: {x: number, y: number}) => void; // For screen-space selection
  onSpriteClick?: (gridPos: GridPosition, spriteId: string) => void;
  onSpriteMouseDown?: (gridPos: GridPosition, spriteId: string) => void;
  onSpriteContextMenu?: (gridPos: GridPosition, spriteId: string) => void;
  showGrid?: boolean;
  className?: string;
  // Selection rectangle props (using screen coordinates)
  isSelecting?: boolean;
  selectionStart?: {x: number, y: number} | null;
  selectionEnd?: {x: number, y: number} | null;
  selectedSprites?: string[];
}

/**
 * Main isometric grid component that handles rendering and interactions
 */
export const IsometricGrid: React.FC<IsometricGridProps> = ({
  config,
  width,
  height,
  sprites = [],
  marbles = [],
  previewSprite,
  previewMarble,
  isAutoMode = false,
  hueShift = 0,
  activeTool = "place",
  selectedSpriteId = null,
  isDragging = false,
  onGridClick,
  onGridHover,
  onGridMouseDown,
  onGridMouseUp,
  onGridMouseLeave,
  onSelectionChange,
  onScreenMouseDown,
  onScreenMouseMove,
  onSpriteClick,
  onSpriteMouseDown,
  onSpriteContextMenu,
  showGrid = true,
  className = "",
  isSelecting = false,
  selectionStart,
  selectionEnd,
  selectedSprites = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContainerMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      // Call onGridMouseUp first
      if (onGridMouseUp) {
        onGridMouseUp();
      }

      // Then handle the click/placement
      if (onGridClick) {
        const rect = containerRef.current.getBoundingClientRect();
        const screenPos = {
          x: event.clientX - rect.left - width / 2,
          y: event.clientY - rect.top - height / 2,
        };

        const gridPos = screenToGrid(screenPos, config);
        onGridClick(gridPos);
      }
    },
    [config, width, height, onGridClick, onGridMouseUp]
  );

  const handleContainerMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left - width / 2,
        y: event.clientY - rect.top - height / 2,
      };

      const gridPos = screenToGrid(screenPos, config);

      if (onGridHover) {
        onGridHover(gridPos);
      }

      if (onSelectionChange) {
        onSelectionChange(gridPos);
      }

      if (onScreenMouseMove) {
        onScreenMouseMove(screenPos);
      }
    },
    [config, width, height, onGridHover, onSelectionChange, onScreenMouseMove]
  );

  const handleSpriteClick = useCallback(
    (gridPos: GridPosition, spriteId: string) => {
      if (onSpriteClick) {
        onSpriteClick(gridPos, spriteId);
      }
    },
    [onSpriteClick]
  );

  const handleSpriteMouseDown = useCallback(
    (gridPos: GridPosition, spriteId: string) => {
      if (onSpriteMouseDown) {
        onSpriteMouseDown(gridPos, spriteId);
      }
    },
    [onSpriteMouseDown]
  );

  const handleSpriteContextMenu = useCallback(
    (gridPos: GridPosition, spriteId: string) => {
      if (onSpriteContextMenu) {
        onSpriteContextMenu(gridPos, spriteId);
      }
    },
    [onSpriteContextMenu]
  );

  const handleContainerMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left - width / 2,
        y: event.clientY - rect.top - height / 2,
      };

      // Call screen coordinate handler if provided
      if (onScreenMouseDown) {
        onScreenMouseDown(screenPos);
      }

      // Call grid coordinate handler if provided
      if (onGridMouseDown) {
        const gridPos = screenToGrid(screenPos, config);
        onGridMouseDown(gridPos);
      }
    },
    [config, width, height, onGridMouseDown, onScreenMouseDown]
  );

  // Generate grid lines for visualization
  const renderGridLines = () => {
    if (!showGrid) return null;

    const lines = [];
    const gridRange = 10; // Show grid lines in a 10x10 area around center

    for (let x = -gridRange; x <= gridRange; x++) {
      for (let y = -gridRange; y <= gridRange; y++) {
        const screenPos = {
          x: (x - y) * config.gridCellWidth,
          y: (x + y) * config.gridCellHeight,
        };

        lines.push(
          <div
            key={`grid-${x}-${y}`}
            className="absolute w-1 h-1 bg-gray-300 opacity-30"
            style={{
              left: `${screenPos.x + width / 2}px`,
              top: `${screenPos.y + height / 2}px`,
              zIndex: 1,
            }}
          />
        );
      }
    }

    return lines;
  };

  // Render selection rectangle using screen coordinates
  const renderSelectionRectangle = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return null;

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const rectWidth = maxX - minX;
    const rectHeight = maxY - minY;

    // Render a visual selection rectangle (no background, just border)
    return (
      <div
        className="absolute border-2 border-blue-400 border-dashed pointer-events-none"
        style={{
          left: `${minX + width / 2}px`,
          top: `${minY + height / 2}px`,
          width: `${rectWidth}px`,
          height: `${rectHeight}px`,
          zIndex: 15,
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
      onMouseMove={handleContainerMouseMove}
      onMouseDown={handleContainerMouseDown}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={onGridMouseLeave}
    >
      {/* Grid visualization */}
      {renderGridLines()}

      {/* Selection rectangle */}
      {renderSelectionRectangle()}

      {/* Sprites container */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${width / 2}px`,
          top: `${height / 2}px`,
          zIndex: 5,
        }}
      >
        {/* Render all sprites and their walls */}
        {sprites.flatMap((sprite) => {
          const elements = [];

          // Calculate the z-index for the main sprite (will be used for walls too)
          const spriteZIndex = 100 + (sprite.position.x + sprite.position.y);

          // First, render walls based on height (from bottom to top)
          if (sprite.height && sprite.height > 0) {
            for (let layer = sprite.height; layer >= 1; layer--) {
              elements.push(
                <IsometricSprite
                  key={`${sprite.id}-wall-${layer}`}
                  gridPosition={{
                    x: sprite.position.x + layer,
                    y: sprite.position.y + layer,
                  }}
                  spritePath="/sprites/isometric-cubes/Walls.png"
                  config={config}
                  hueShift={sprite.hue !== undefined ? sprite.hue : hueShift}
                  zIndexOverride={spriteZIndex - layer} // Walls appear slightly behind the main sprite
                />
              );
            }
          }

          // Then render the main sprite on top
          elements.push(
            <IsometricSprite
              key={sprite.id}
              gridPosition={sprite.position}
              spritePath={sprite.spritePath}
              config={config}
              hueShift={sprite.hue !== undefined ? sprite.hue : hueShift}
              onClick={
                activeTool === "move" ||
                activeTool === "select" ||
                activeTool === "deepen"
                  ? (gridPos) => handleSpriteClick(gridPos, sprite.id)
                  : undefined
              }
              onMouseDown={
                activeTool === "move" || activeTool === "select"
                  ? (gridPos) => handleSpriteMouseDown(gridPos, sprite.id)
                  : undefined
              }
              onContextMenu={
                activeTool === "deepen"
                  ? (gridPos) => handleSpriteContextMenu(gridPos, sprite.id)
                  : undefined
              }
              isDragging={isDragging && selectedSpriteId === sprite.id}
              className={
                activeTool === "move" ||
                activeTool === "select" ||
                activeTool === "deepen"
                  ? `cursor-pointer hover:brightness-110 ${
                      selectedSprites.includes(sprite.id)
                        ? "ring-2 ring-blue-400 ring-offset-2"
                        : ""
                    }`
                  : ""
              }
            />
          );

          return elements;
        })}

        {/* Render marbles in the same container as sprites for proper z-index layering */}
        {marbles.map((marble) => (
          <Marble
            key={marble.id}
            position={gridToScreenPosition(marble.gridPosition)}
            rotation={marble.rotation}
            state={marble.state}
            behindCoordinates={marble.behindCoordinates}
            momentum={marble.momentum}
            isAutoMode={isAutoMode}
          />
        ))}

        {/* Preview sprite */}
        {previewSprite && (
          <IsometricSprite
            gridPosition={previewSprite.position}
            spritePath={previewSprite.spritePath}
            config={config}
            hueShift={hueShift}
            className="opacity-50"
          />
        )}

        {/* Preview marble */}
        {previewMarble && (
          <Marble
            position={gridToScreenPosition(previewMarble.position)}
            rotation={0}
            state="falling"
            className="opacity-50"
          />
        )}
      </div>
    </div>
  );
};
