import {
  depthZIndex,
  type GridPosition,
  getSpritePlacement,
  type IsometricGridConfig,
} from "@/lib/isometric";

interface IsometricSpriteProps {
  gridPosition: GridPosition;
  spritePath: string;
  config: IsometricGridConfig;
  /** Hue rotation in degrees (0-360) */
  hue?: number;
  /** Override the default depth-based draw order */
  zIndex?: number;
  /** Block this sprite belongs to, so the board can tell what was clicked */
  blockId?: string;
  /** Whether the sprite responds to the pointer */
  interactive?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  className?: string;
}

/**
 * Renders a square sprite centred on an isometric grid cell
 */
export function IsometricSprite({
  gridPosition,
  spritePath,
  config,
  hue,
  zIndex,
  blockId,
  interactive = false,
  isDragging = false,
  isSelected = false,
  className = "",
}: IsometricSpriteProps) {
  const screenPos = getSpritePlacement(gridPosition, config);
  const filter = [
    hue ? `hue-rotate(${hue}deg)` : "",
    isDragging ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      src={spritePath}
      alt=""
      draggable={false}
      data-block-id={blockId}
      className={`absolute block ${interactive ? "cursor-pointer" : ""} ${
        isSelected ? "ring-2 ring-blue-400 ring-offset-2" : ""
      } ${className}`}
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width: config.spriteSize,
        height: config.spriteSize,
        maxWidth: "none", // The sprite layer has no width, so ignore Tailwind's max-width: 100%
        imageRendering: "pixelated",
        zIndex: isDragging ? 1000 : (zIndex ?? depthZIndex(gridPosition)),
        filter: filter || undefined,
        transition: isDragging ? "none" : "filter 0.8s ease-in-out",
        transform: isDragging ? "scale(1.1)" : undefined,
        pointerEvents: interactive ? "auto" : "none",
      }}
    />
  );
}
