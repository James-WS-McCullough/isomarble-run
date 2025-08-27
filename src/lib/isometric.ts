/**
 * Isometric grid utilities for positioning and rendering sprites
 */

export interface IsometricGridConfig {
  spriteSize: number; // The width/height of the square sprite
  gridCellWidth: number; // 1/2 sprite height
  gridCellHeight: number; // 1/4 sprite height
}

export interface GridPosition {
  x: number; // Grid column
  y: number; // Grid row
}

export interface ScreenPosition {
  x: number; // Screen X coordinate
  y: number; // Screen Y coordinate
}

/**
 * Create an isometric grid configuration based on sprite size
 */
export function createIsometricGrid(spriteSize: number): IsometricGridConfig {
  return {
    spriteSize,
    gridCellWidth: spriteSize / 2,
    gridCellHeight: spriteSize / 4,
  };
}

/**
 * Convert grid coordinates to screen coordinates
 */
export function gridToScreen(
  gridPos: GridPosition,
  config: IsometricGridConfig
): ScreenPosition {
  const { gridCellWidth, gridCellHeight } = config;

  return {
    x: (gridPos.x - gridPos.y) * gridCellWidth,
    y: (gridPos.x + gridPos.y) * gridCellHeight,
  };
}

/**
 * Convert screen coordinates to grid coordinates
 */
export function screenToGrid(
  screenPos: ScreenPosition,
  config: IsometricGridConfig
): GridPosition {
  const { gridCellWidth, gridCellHeight } = config;

  const x = (screenPos.x / gridCellWidth + screenPos.y / gridCellHeight) / 2;
  const y = (screenPos.y / gridCellHeight - screenPos.x / gridCellWidth) / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

/**
 * Get the sprite offset to center it on the grid cell
 */
export function getSpriteOffset(config: IsometricGridConfig): ScreenPosition {
  return {
    x: -config.spriteSize / 2,
    y: -config.spriteSize / 2,
  };
}

/**
 * Calculate the complete screen position for a sprite including offset
 */
export function getSpritePlacement(
  gridPos: GridPosition,
  config: IsometricGridConfig
): ScreenPosition {
  const screenPos = gridToScreen(gridPos, config);
  const offset = getSpriteOffset(config);

  return {
    x: screenPos.x + offset.x,
    y: screenPos.y + offset.y,
  };
}
