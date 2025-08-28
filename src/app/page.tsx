"use client";

import { useState, useEffect, useCallback } from "react";
import { IsometricGrid } from "@/components/IsometricGrid";
import { Marble } from "@/components/Marble";
import { createIsometricGrid, GridPosition } from "@/lib/isometric";
import {
  MarbleStateMachine,
  createMarble,
  updateMarbleStateMachine,
  TrackPiece,
} from "@/lib/marble-state-machine";
import { BLOCK_TYPES, getBlockBehavior } from "@/lib/block-types";
import { useSoundManager } from "@/hooks/useSoundManager";

// Convert block types to sprite types for the UI
const SPRITE_TYPES = BLOCK_TYPES.map((block, index) => ({
  id: `block-${index}`,
  name: block.blockName.replace(/([A-Z])/g, " $1").trim(), // Convert CamelCase to readable name
  path: block.blockPath,
  blockName: block.blockName,
}));

// Helper function to format momentum for display
const formatMomentum = (momentum: string | string[]): string => {
  if (Array.isArray(momentum)) {
    return momentum.join(", ");
  }
  return momentum;
};

export default function Home() {
  // Fixed sprite size: 100px with grid cells 50px × 25px
  const config = createIsometricGrid(100);

  const [sprites, setSprites] = useState<
    Array<{
      id: string;
      position: GridPosition;
      spritePath: string;
      blockName: string;
      hue?: number; // Individual hue for each sprite (0-360)
    }>
  >([]);

  const [selectedSpriteType, setSelectedSpriteType] = useState(SPRITE_TYPES[0]);
  const [previewPosition, setPreviewPosition] = useState<GridPosition | null>(
    null
  );
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [marbles, setMarbles] = useState<MarbleStateMachine[]>([]);
  const [isPlacingMarble, setIsPlacingMarble] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Sound manager
  const soundManager = useSoundManager(soundEnabled);

  // Update sound manager when soundEnabled changes
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled, soundManager]);

  // Update sound manager with current marble states
  useEffect(() => {
    const marbleStates = marbles.map((marble) => ({
      id: marble.id,
      state: marble.state,
    }));
    soundManager.updateMarbles(marbleStates);
  }, [marbles, soundManager]);

  // Convert sprites to track pieces for state machine
  const trackPieces: TrackPiece[] = sprites.map((sprite) => ({
    position: sprite.position,
    blockName: sprite.blockName,
    spritePath: sprite.spritePath,
    hue: sprite.hue,
  }));

  // Auto mode timer
  useEffect(() => {
    if (!autoMode || marbles.length === 0) return;

    const interval = setInterval(() => {
      stepMarbles();
    }, 150); // Reduced from 300ms to 150ms for smoother continuous motion

    return () => clearInterval(interval);
  }, [autoMode, marbles]);

  // Step function to advance all marbles one step
  const stepMarbles = useCallback(() => {
    setMarbles((currentMarbles) => {
      const newMarbles = currentMarbles.map((marble) =>
        updateMarbleStateMachine(marble, trackPieces)
      );
      
      // Update track piece hues based on marble positions
      setSprites((currentSprites) => {
        return currentSprites.map((sprite) => {
          // Find marbles that are rolling FROM this tile (previous position)
          const marbleRollingFrom = newMarbles.find((newMarble) => {
            const oldMarble = currentMarbles.find(m => m.id === newMarble.id);
            if (!oldMarble || !newMarble.hue) return false;
            
            // Check if marble was on this tile and is now rolling
            const wasOnThisTile = 
              oldMarble.gridPosition.x === sprite.position.x && 
              oldMarble.gridPosition.y === sprite.position.y;
            const isNowRolling = newMarble.state === "rolling";
            
            if (wasOnThisTile && isNowRolling) {
              console.log(`Marble ${newMarble.id} rolling from tile at (${sprite.position.x}, ${sprite.position.y}) with hue ${newMarble.hue}`);
              return true;
            }
            return false;
          });
          
          if (marbleRollingFrom && marbleRollingFrom.hue !== undefined) {
            // Update sprite hue to marble's hue
            return { ...sprite, hue: marbleRollingFrom.hue };
          }
          
          return sprite;
        });
      });
      
      return newMarbles;
    });
  }, [trackPieces]);

  const handleGridClick = (gridPos: GridPosition) => {
    if (isPlacingMarble) {
      // Place a marble
      const newMarble = createMarble(gridPos);
      setMarbles([...marbles, newMarble]);
      setIsPlacingMarble(false);
      return;
    }

    // Only place/remove track pieces if the click position matches the current preview position
    if (
      previewPosition &&
      gridPos.x === previewPosition.x &&
      gridPos.y === previewPosition.y
    ) {
      placeSprite(gridPos);
    }
  };

  const placeSprite = (gridPos: GridPosition) => {
    // Check if there's already a sprite at this exact position
    const existingSprite = sprites.find(
      (sprite) =>
        sprite.position.x === gridPos.x && sprite.position.y === gridPos.y
    );

    if (existingSprite) {
      // Remove existing sprite only if it's at the exact same position
      setSprites(sprites.filter((sprite) => sprite.id !== existingSprite.id));
    } else {
      // Add new sprite of selected type
      const newSprite = {
        id: `${selectedSpriteType.id}-${Date.now()}`,
        position: gridPos,
        spritePath: selectedSpriteType.path,
        blockName: selectedSpriteType.blockName,
      };
      setSprites([...sprites, newSprite]);
    }
  };

  const handleGridHover = (gridPos: GridPosition) => {
    setPreviewPosition(gridPos);
  };

  const handleGridMouseDown = () => {
    setIsMouseDown(true);
  };

  const handleGridMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleGridMouseLeave = () => {
    setPreviewPosition(null);
    setIsMouseDown(false);
  };

  const handleSpriteClick = (gridPos: GridPosition, spriteId: string) => {
    // Disable direct sprite clicking - only allow interaction through grid hover
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
          Isometric Marble Run
        </h1>

        {/* Horizontal Toolbar */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-4 mb-6 border border-gray-700">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Block Type Icons */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300 mr-2">
                Track Pieces:
              </span>
              {SPRITE_TYPES.map((spriteType) => (
                <button
                  key={spriteType.id}
                  onClick={() => {
                    setSelectedSpriteType(spriteType);
                    setIsPlacingMarble(false);
                  }}
                  disabled={isPlacingMarble}
                  className={`p-2 border-2 rounded-lg transition-all ${
                    selectedSpriteType.id === spriteType.id && !isPlacingMarble
                      ? "border-blue-500 bg-blue-900/30"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
                  } ${isPlacingMarble ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={spriteType.name}
                >
                  <img
                    src={spriteType.path}
                    alt={spriteType.name}
                    className="w-8 h-8"
                    style={{ imageRendering: "pixelated" }}
                  />
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-600"></div>

            {/* Marble Placement */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300 mr-2">
                Marble:
              </span>
              <button
                onClick={() => setIsPlacingMarble(!isPlacingMarble)}
                className={`p-2 border-2 rounded-lg transition-all ${
                  isPlacingMarble
                    ? "border-red-500 bg-red-900/30"
                    : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
                }`}
                title={
                  isPlacingMarble ? "Cancel marble placement" : "Place marble"
                }
              >
                <img
                  src="/sprites/marble/MarbleBase.png"
                  alt="Marble"
                  className="w-8 h-8"
                  style={{ imageRendering: "pixelated" }}
                />
              </button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-600"></div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMarbles([])}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={marbles.length === 0}
              >
                Clear Marbles ({marbles.length})
              </button>

              <button
                onClick={() => {
                  setSprites((sprites) =>
                    sprites.map((sprite) => ({ ...sprite, hue: undefined }))
                  );
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={sprites.length === 0}
              >
                Reset Colors
              </button>

              <button
                onClick={stepMarbles}
                disabled={marbles.length === 0}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Step
              </button>

              <label className="flex items-center gap-2 text-gray-200">
                <input
                  type="checkbox"
                  checked={autoMode}
                  onChange={(e) => setAutoMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                />
                <span className="text-sm">Auto</span>
              </label>

              <label className="flex items-center gap-2 text-gray-200">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                />
                <span className="text-sm">Sound</span>
              </label>
            </div>
          </div>
        </div>

        {/* Main Content - Grid */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">
            Marble Run Builder
          </h2>
          <p className="text-gray-300 mb-4">
            {isPlacingMarble
              ? "Click on any grid position to place a marble."
              : `Click and drag to place ${selectedSpriteType.name} pieces. Click existing pieces to remove them.`}
          </p>

          <div className="border border-gray-600 rounded relative bg-gray-750 flex items-center justify-center w-fit mx-auto">
            <IsometricGrid
              config={config}
              width={800}
              height={600}
              sprites={sprites}
              marbles={marbles}
              isAutoMode={autoMode}
              previewSprite={
                previewPosition && !isPlacingMarble
                  ? {
                      position: previewPosition,
                      spritePath: selectedSpriteType.path,
                    }
                  : undefined
              }
              previewMarble={
                previewPosition && isPlacingMarble
                  ? {
                      position: previewPosition,
                    }
                  : undefined
              }
              onGridClick={handleGridClick}
              onGridHover={handleGridHover}
              onGridMouseDown={handleGridMouseDown}
              onGridMouseUp={handleGridMouseUp}
              onGridMouseLeave={handleGridMouseLeave}
              onSpriteClick={handleSpriteClick}
              showGrid={true}
              className="bg-gray-800"
            />
          </div>

          {/* Marble Status */}
          {marbles.length > 0 && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="text-sm font-semibold mb-2 text-gray-200">
                Marble Status
              </h4>
              <div className="text-sm text-gray-300 flex gap-6">
                <div>
                  Falling: {marbles.filter((m) => m.state === "falling").length}
                </div>
                <div>
                  Rolling: {marbles.filter((m) => m.state === "rolling").length}
                </div>
                <div>
                  Behind: {marbles.filter((m) => m.state === "behind").length}
                </div>
                <div className="ml-auto">Total: {marbles.length}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
