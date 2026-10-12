/**
 * Isometric grid utilities for positioning and rendering sprites.
 *
 * Grid coordinates map to the screen as a diamond: +x goes down-right and
 * +y goes down-left. Moving +1 in both x and y moves straight down the
 * screen by one block height, which is how "falling" works.
 */

export interface IsometricGridConfig {
  spriteSize: number; // The width/height of the square sprite
  gridCellWidth: number; // 1/2 sprite size
  gridCellHeight: number; // 1/4 sprite size
}

export interface GridPosition {
  x: number; // Grid column
  y: number; // Grid row
}

export interface ScreenPosition {
  x: number; // Screen X coordinate
  y: number; // Screen Y coordinate
}

/** Playable grid runs from GRID_MIN to GRID_MAX on both axes */
export const GRID_MIN = -10;
export const GRID_MAX = 10;

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

/** The grid used by the app: 100px sprites on 50px × 25px cells */
export const GRID_CONFIG = createIsometricGrid(100);

/**
 * Convert grid coordinates to screen coordinates
 */
export function gridToScreen(
  gridPos: GridPosition,
  config: IsometricGridConfig,
): ScreenPosition {
  const { gridCellWidth, gridCellHeight } = config;

  return {
    x: (gridPos.x - gridPos.y) * gridCellWidth,
    y: (gridPos.x + gridPos.y) * gridCellHeight,
  };
}

/**
 * Convert screen coordinates to the nearest grid cell
 */
export function screenToGrid(
  screenPos: ScreenPosition,
  config: IsometricGridConfig,
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
 * Calculate the top-left screen position for a sprite centred on a grid cell
 */
export function getSpritePlacement(
  gridPos: GridPosition,
  config: IsometricGridConfig,
): ScreenPosition {
  const screenPos = gridToScreen(gridPos, config);

  return {
    x: screenPos.x - config.spriteSize / 2,
    y: screenPos.y - config.spriteSize / 2,
  };
}

/**
 * Draw order for something sitting in a grid cell: cells lower on the
 * screen (higher x + y) are drawn in front.
 */
export function depthZIndex(gridPos: GridPosition): number {
  return 100 + gridPos.x + gridPos.y;
}

/** A string key for a grid position, handy for Maps and Sets */
export function positionKey(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}
