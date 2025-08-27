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
  gridToScreenPosition,
} from "@/lib/marble-state-machine";
import { BLOCK_TYPES, getBlockBehavior } from "@/lib/block-types";

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

  const [sprites, setSprites] = useState([
    {
      id: "test-cube-1",
      position: { x: 0, y: 0 },
      spritePath: BLOCK_TYPES[0].blockPath, // CrissCross
      blockName: BLOCK_TYPES[0].blockName,
    },
    {
      id: "test-cube-2",
      position: { x: 1, y: 0 },
      spritePath: BLOCK_TYPES[3].blockPath, // LandingMinusY
      blockName: BLOCK_TYPES[3].blockName,
    },
    {
      id: "test-cube-3",
      position: { x: 0, y: 1 },
      spritePath: BLOCK_TYPES[1].blockPath, // StrightDownLeft
      blockName: BLOCK_TYPES[1].blockName,
    },
  ]);

  const [selectedSpriteType, setSelectedSpriteType] = useState(SPRITE_TYPES[0]);
  const [previewPosition, setPreviewPosition] = useState<GridPosition | null>(
    null
  );
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [marbles, setMarbles] = useState<MarbleStateMachine[]>([]);
  const [isPlacingMarble, setIsPlacingMarble] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  // Convert sprites to track pieces for state machine
  const trackPieces: TrackPiece[] = sprites.map((sprite) => ({
    position: sprite.position,
    blockName: sprite.blockName,
    spritePath: sprite.spritePath,
  }));

  // Auto mode timer
  useEffect(() => {
    if (!autoMode || marbles.length === 0) return;

    const interval = setInterval(() => {
      stepMarbles();
    }, 300);

    return () => clearInterval(interval);
  }, [autoMode, marbles]);

  // Step function to advance all marbles one step
  const stepMarbles = useCallback(() => {
    setMarbles((currentMarbles) =>
      currentMarbles.map((marble) =>
        updateMarbleStateMachine(marble, trackPieces)
      )
    );
  }, [trackPieces]);

  const handleGridClick = (gridPos: GridPosition) => {
    if (isPlacingMarble) {
      // Place a marble
      const newMarble = createMarble(gridPos);
      setMarbles([...marbles, newMarble]);
      setDebugInfo(
        `Placed marble at: (${gridPos.x}, ${gridPos.y}) - State: ${newMarble.state}, Momentum: ${newMarble.momentum}`
      );
      setIsPlacingMarble(false);
      return;
    }

    // Only place/remove track pieces if the click position matches the current preview position
    if (
      previewPosition &&
      gridPos.x === previewPosition.x &&
      gridPos.y === previewPosition.y
    ) {
      setDebugInfo(
        `Placing at highlighted position: (${gridPos.x}, ${gridPos.y})`
      );
      placeSprite(gridPos);
    } else {
      setDebugInfo(`Click ignored - not on highlighted cell`);
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
      setDebugInfo(`Removing sprite at: (${gridPos.x}, ${gridPos.y})`);
      setSprites(sprites.filter((sprite) => sprite.id !== existingSprite.id));
    } else {
      // Add new sprite of selected type
      setDebugInfo(`Adding new sprite at: (${gridPos.x}, ${gridPos.y})`);
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
    setDebugInfo(`Hovering: (${gridPos.x}, ${gridPos.y})`);
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
    setDebugInfo(`Direct sprite click disabled - use grid hover instead`);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
          Isometric Marble Run
        </h1>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">Controls</h2>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setIsPlacingMarble(!isPlacingMarble)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isPlacingMarble
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
            >
              {isPlacingMarble ? "Cancel Marble Placement" : "Place Marble"}
            </button>

            <button
              onClick={() => setMarbles([])}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={marbles.length === 0}
            >
              Clear All Marbles ({marbles.length})
            </button>
          </div>

          <h3 className="text-lg font-semibold mb-4 text-gray-100">
            Track Pieces
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {SPRITE_TYPES.map((spriteType) => {
              const blockBehavior = getBlockBehavior(spriteType.blockName);
              return (
                <button
                  key={spriteType.id}
                  onClick={() => {
                    setSelectedSpriteType(spriteType);
                    setIsPlacingMarble(false);
                  }}
                  disabled={isPlacingMarble}
                  className={`p-3 border-2 rounded-lg flex flex-col items-start gap-2 transition-all text-left ${
                    selectedSpriteType.id === spriteType.id && !isPlacingMarble
                      ? "border-blue-500 bg-blue-900/30 text-gray-100"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600 text-gray-200"
                  } ${isPlacingMarble ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={spriteType.path}
                      alt={spriteType.name}
                      className="w-8 h-8"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="text-sm font-medium text-gray-100">
                      {spriteType.name}
                    </span>
                  </div>
                  {blockBehavior && (
                    <div className="text-xs text-gray-400">
                      <div>
                        Default:{" "}
                        {formatMomentum(blockBehavior.defaultOutputMomentum)}
                      </div>
                      {blockBehavior.conditionalOutputs &&
                        blockBehavior.conditionalOutputs.length > 0 && (
                          <div>
                            Rules: {blockBehavior.conditionalOutputs.length}{" "}
                            conditions
                          </div>
                        )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected block behavior details */}
          {selectedSpriteType && (
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <h4 className="text-md font-semibold mb-2 text-blue-200">
                Selected: {selectedSpriteType.name}
              </h4>
              {(() => {
                const blockBehavior = getBlockBehavior(
                  selectedSpriteType.blockName
                );
                if (!blockBehavior)
                  return (
                    <p className="text-sm text-gray-400">
                      No behavior data available
                    </p>
                  );

                return (
                  <div className="text-sm space-y-2 text-gray-300">
                    <div>
                      <strong className="text-gray-200">Default Output:</strong>{" "}
                      {formatMomentum(blockBehavior.defaultOutputMomentum)}
                    </div>
                    {blockBehavior.conditionalOutputs &&
                      blockBehavior.conditionalOutputs.length > 0 && (
                        <div>
                          <strong className="text-gray-200">
                            Conditional Rules:
                          </strong>
                          <ul className="ml-4 mt-1 space-y-1">
                            {blockBehavior.conditionalOutputs.map(
                              (rule, index) => (
                                <li
                                  key={index}
                                  className="text-xs text-gray-400"
                                >
                                  If momentum = {rule.inputMomentum} → Output:{" "}
                                  {formatMomentum(rule.outputMomentum)}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">
            Marble Run Builder
          </h2>
          <p className="text-gray-300 mb-4">
            {isPlacingMarble
              ? "Click on any grid position to place a marble that will start falling."
              : `Hold down mouse to place ${selectedSpriteType.name} pieces. Click existing pieces to remove them.`}
            Grid dimensions: {config.gridCellWidth}px × {config.gridCellHeight}
            px per cell
          </p>

          {/* Debug info */}
          <div className="mb-4 p-2 bg-gray-700 border border-gray-600 rounded text-sm space-y-1">
            <div>
              <strong className="text-gray-200">Debug:</strong>{" "}
              <span className="text-gray-300">{debugInfo}</span>
            </div>
            {marbles.length > 0 && (
              <div>
                <strong className="text-gray-200">Marbles:</strong>
                {marbles.map((marble, index) => (
                  <div key={marble.id} className="ml-4 text-xs text-gray-400">
                    #{index + 1}: Pos(
                    {Math.round(marble.gridPosition.x * 10) / 10},{" "}
                    {Math.round(marble.gridPosition.y * 10) / 10}) | State:{" "}
                    {marble.state} | Momentum: {marble.momentum} | Rotation:{" "}
                    {Math.round(marble.rotation)}°
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-600 rounded relative bg-gray-750">
            <IsometricGrid
              config={config}
              width={800}
              height={600}
              sprites={sprites}
              marbles={marbles}
              previewSprite={
                previewPosition && !isPlacingMarble
                  ? {
                      position: previewPosition,
                      spritePath: selectedSpriteType.path,
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

          {/* Marble State Machine Controls - Moved below grid */}
          <div className="flex gap-4 mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <h4 className="text-md font-semibold text-gray-100">
              Marble State Machine:
            </h4>
            <button
              onClick={stepMarbles}
              disabled={marbles.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Step Forward
            </button>

            <label className="flex items-center gap-2 text-gray-200">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
              />
              <span className="text-sm">Auto (300ms)</span>
            </label>

            <div className="text-sm text-gray-400">
              {marbles.length > 0 && (
                <span>
                  Marbles: {marbles.filter((m) => m.state === "falling").length}{" "}
                  falling, {marbles.filter((m) => m.state === "rolling").length}{" "}
                  rolling, {marbles.filter((m) => m.state === "behind").length}{" "}
                  behind
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-2 text-gray-100">
            Current Sprites:
          </h3>
          <div className="text-sm text-gray-300">
            {sprites.length === 0 ? (
              <p className="text-gray-400 italic">No sprites placed yet</p>
            ) : (
              sprites.map((sprite) => (
                <div
                  key={sprite.id}
                  className="mb-1 p-2 bg-gray-700 rounded border border-gray-600"
                >
                  <span className="text-gray-200 font-medium">
                    {sprite.blockName}
                  </span>
                  <span className="text-gray-400 ml-2">
                    at ({sprite.position.x}, {sprite.position.y})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
