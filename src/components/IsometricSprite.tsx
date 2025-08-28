"use client";

import React from "react";
import {
  GridPosition,
  IsometricGridConfig,
  getSpritePlacement,
} from "@/lib/isometric";

interface IsometricSpriteProps {
  gridPosition: GridPosition;
  spritePath: string;
  config: IsometricGridConfig;
  alt?: string;
  className?: string;
  hueShift?: number; // Hue shift in degrees (0-360)
  onClick?: (gridPos: GridPosition) => void;
  onMouseDown?: (gridPos: GridPosition) => void;
  onContextMenu?: (gridPos: GridPosition) => void; // Right-click handler
  isDragging?: boolean; // New prop to indicate if this sprite is being dragged
  zIndexOverride?: number; // Optional override for z-index calculation
}

/**
 * Component for rendering an isometric sprite at a specific grid position
 */
export const IsometricSprite: React.FC<IsometricSpriteProps> = ({
  gridPosition,
  spritePath,
  config,
  alt = "Isometric sprite",
  className = "",
  hueShift = 0,
  onClick,
  onMouseDown,
  onContextMenu,
  isDragging = false,
  zIndexOverride,
}) => {
  const screenPos = getSpritePlacement(gridPosition, config);

  const handleClick = () => {
    if (onClick) {
      onClick(gridPosition);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    if (onMouseDown) {
      onMouseDown(gridPosition);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default context menu
    if (onContextMenu) {
      onContextMenu(gridPosition);
    }
  };

  // Calculate z-index based on grid position
  // Higher y values (further back) and higher x values should have higher z-index (render in front)
  // This creates the proper isometric depth where "higher" objects appear in front
  const zIndex =
    zIndexOverride !== undefined
      ? zIndexOverride
      : 100 + (gridPosition.x + gridPosition.y);

  return (
    <img
      src={spritePath}
      alt={alt}
      className={`absolute pointer-events-auto block ${className} ${
        isDragging ? "shadow-lg shadow-blue-500/50 brightness-110" : ""
      }`}
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${config.spriteSize}px`,
        height: `${config.spriteSize}px`,
        minWidth: `${config.spriteSize}px`,
        minHeight: `${config.spriteSize}px`,
        imageRendering: "pixelated",
        zIndex: isDragging ? 1000 : zIndex, // Higher z-index when dragging
        position: "absolute",
        boxSizing: "border-box",
        filter: `${hueShift !== 0 ? `hue-rotate(${hueShift}deg)` : ""} ${
          isDragging ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))" : ""
        }`.trim(),
        transition: isDragging ? "none" : "filter 0.8s ease-in-out", // No transition when dragging
        transform: isDragging ? "scale(1.1)" : "scale(1)", // Slightly larger when dragging
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    />
  );
};
