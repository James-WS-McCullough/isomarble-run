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
  }>;
  marbles?: Array<{
    id: string;
    gridPosition: GridPosition;
    state: "rolling" | "falling" | "behind";
    rotation: number;
    behindCoordinates?: GridPosition;
  }>;
  previewSprite?: {
    position: GridPosition;
    spritePath: string;
  };
  previewMarble?: {
    position: GridPosition;
  };
  onGridClick?: (gridPos: GridPosition) => void;
  onGridHover?: (gridPos: GridPosition) => void;
  onGridMouseDown?: () => void;
  onGridMouseUp?: () => void;
  onGridMouseLeave?: () => void;
  onSpriteClick?: (gridPos: GridPosition, spriteId: string) => void;
  showGrid?: boolean;
  className?: string;
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
  onGridClick,
  onGridHover,
  onGridMouseDown,
  onGridMouseUp,
  onGridMouseLeave,
  onSpriteClick,
  showGrid = true,
  className = "",
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
      if (!containerRef.current || !onGridHover) return;

      const rect = containerRef.current.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left - width / 2,
        y: event.clientY - rect.top - height / 2,
      };

      const gridPos = screenToGrid(screenPos, config);
      onGridHover(gridPos);
    },
    [config, width, height, onGridHover]
  );

  const handleSpriteClick = useCallback(
    (gridPos: GridPosition, spriteId: string) => {
      if (onSpriteClick) {
        onSpriteClick(gridPos, spriteId);
      }
    },
    [onSpriteClick]
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

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
      onMouseMove={handleContainerMouseMove}
      onMouseDown={onGridMouseDown}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={onGridMouseLeave}
    >
      {/* Grid visualization */}
      {renderGridLines()}

      {/* Sprites container */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${width / 2}px`,
          top: `${height / 2}px`,
          zIndex: 5,
        }}
      >
        {sprites.map((sprite) => (
          <IsometricSprite
            key={sprite.id}
            gridPosition={sprite.position}
            spritePath={sprite.spritePath}
            config={config}
            onClick={(gridPos) => handleSpriteClick(gridPos, sprite.id)}
          />
        ))}

        {/* Render marbles in the same container as sprites for proper z-index layering */}
        {marbles.map((marble) => (
          <Marble
            key={marble.id}
            position={gridToScreenPosition(marble.gridPosition)}
            rotation={marble.rotation}
            state={marble.state}
            behindCoordinates={marble.behindCoordinates}
          />
        ))}

        {/* Preview sprite */}
        {previewSprite && (
          <IsometricSprite
            gridPosition={previewSprite.position}
            spritePath={previewSprite.spritePath}
            config={config}
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
