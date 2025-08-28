"use client";

import { useState, useEffect, useCallback } from "react";
import { IsometricGrid } from "@/components/IsometricGrid";
import { Marble } from "@/components/Marble";
import { Sidebar, Tool } from "@/components/Sidebar";
import { createIsometricGrid, GridPosition, screenToGrid } from "@/lib/isometric";
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
      height?: number; // Height of the block (number of wall layers below)
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

  // New state for tool management
  const [activeTool, setActiveTool] = useState<Tool>("place");
  const [selectedSprite, setSelectedSprite] = useState<string | null>(null);
  const [dragStartPosition, setDragStartPosition] =
    useState<GridPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSpriteData, setDraggedSpriteData] = useState<{
    id: string;
    originalPosition: GridPosition;
    spritePath: string;
    blockName: string;
    hue?: number;
    height?: number;
  } | null>(null);

  // Rectangle selection state for select tool (using screen coordinates)
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [selectedSprites, setSelectedSprites] = useState<string[]>([]);
  const [draggedSelectionData, setDraggedSelectionData] = useState<Array<{
    id: string;
    originalPosition: GridPosition;
    spritePath: string;
    blockName: string;
    hue?: number;
    height?: number;
  }> | null>(null);

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

  // Helper function to calculate which sprites are within screen selection rectangle
  const getSpritesInScreenSelection = useCallback(
    (start: {x: number, y: number}, end: {x: number, y: number}) => {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      return sprites
        .filter((sprite) => {
          // Convert sprite grid position to screen position
          const screenPos = {
            x: (sprite.position.x - sprite.position.y) * config.gridCellWidth,
            y: (sprite.position.x + sprite.position.y) * config.gridCellHeight,
          };

          // Check if sprite center is within selection rectangle
          return (
            screenPos.x >= minX &&
            screenPos.x <= maxX &&
            screenPos.y >= minY &&
            screenPos.y <= maxY
          );
        })
        .map((sprite) => sprite.id);
    },
    [sprites, config.gridCellWidth, config.gridCellHeight]
  );

  // Update selected sprites when selection rectangle changes
  useEffect(() => {
    if (isSelecting && selectionStart && selectionEnd) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);

      const spritesInSelection = sprites
        .filter((sprite) => {
          // Convert sprite grid position to screen position
          const screenPos = {
            x: (sprite.position.x - sprite.position.y) * config.gridCellWidth,
            y: (sprite.position.x + sprite.position.y) * config.gridCellHeight,
          };

          // Check if sprite center is within selection rectangle
          return (
            screenPos.x >= minX &&
            screenPos.x <= maxX &&
            screenPos.y >= minY &&
            screenPos.y <= maxY
          );
        })
        .map((sprite) => sprite.id);
      
      setSelectedSprites(spritesInSelection);
    }
  }, [isSelecting, selectionStart, selectionEnd, sprites, config.gridCellWidth, config.gridCellHeight]);

  // Global mouse up handler to ensure drag ends even if mouse is released outside the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && (draggedSpriteData || draggedSelectionData)) {
        setIsDragging(false);
        setSelectedSprite(null);
        setDraggedSpriteData(null);
        setDraggedSelectionData(null);
        setDragStartPosition(null);
      }
      if (isSelecting) {
        setIsSelecting(false);
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, draggedSpriteData, draggedSelectionData, isSelecting]);

  // Convert sprites to track pieces for state machine
  const trackPieces: TrackPiece[] = sprites.map((sprite) => ({
    position: sprite.position,
    blockName: sprite.blockName,
    spritePath: sprite.spritePath,
    hue: sprite.hue,
    height: sprite.height,
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
            const oldMarble = currentMarbles.find((m) => m.id === newMarble.id);
            if (!oldMarble || !newMarble.hue) return false;

            // Check if marble was on this tile and is now rolling
            const wasOnThisTile =
              oldMarble.gridPosition.x === sprite.position.x &&
              oldMarble.gridPosition.y === sprite.position.y;
            const isNowRolling = newMarble.state === "rolling";

            if (wasOnThisTile && isNowRolling) {
              console.log(
                `Marble ${newMarble.id} rolling from tile at (${sprite.position.x}, ${sprite.position.y}) with hue ${newMarble.hue}`
              );
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
    if (activeTool === "marble" || isPlacingMarble) {
      // Place a marble
      const newMarble = createMarble(gridPos);
      setMarbles([...marbles, newMarble]);
      setIsPlacingMarble(false);
      return;
    }

    if (activeTool === "place") {
      // Only place/remove track pieces if the click position matches the current preview position
      if (
        previewPosition &&
        gridPos.x === previewPosition.x &&
        gridPos.y === previewPosition.y
      ) {
        placeSprite(gridPos);
      }
      return;
    }

    // Move tool is handled by mouse events, not click
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
        height: 0, // Default height is 0 (no walls below)
      };
      setSprites([...sprites, newSprite]);
    }
  };

  const handleGridHover = (gridPos: GridPosition) => {
    if (activeTool === "place") {
      setPreviewPosition(gridPos);
    } else if (activeTool === "marble" || isPlacingMarble) {
      setPreviewPosition(gridPos);
    } else if (activeTool === "move") {
      // Handle individual sprite dragging
      if (isMouseDown && !isDragging && draggedSpriteData) {
        setIsDragging(true);
      }

      if (isDragging && draggedSpriteData) {
        // Update single sprite position directly
        setSprites((prevSprites) =>
          prevSprites.map((sprite) =>
            sprite.id === draggedSpriteData.id
              ? { ...sprite, position: gridPos }
              : sprite
          )
        );
      }
    } else if (activeTool === "select") {
      // Handle multi-sprite selection and dragging
      if (isMouseDown && !isDragging && draggedSelectionData) {
        setIsDragging(true);
      }

      if (isDragging && dragStartPosition && draggedSelectionData) {
        const deltaX = gridPos.x - dragStartPosition.x;
        const deltaY = gridPos.y - dragStartPosition.y;

        // Update all sprites in the selection
        setSprites((prevSprites) =>
          prevSprites.map((sprite) => {
            const draggedSprite = draggedSelectionData.find(
              (d) => d.id === sprite.id
            );
            if (draggedSprite) {
              return {
                ...sprite,
                position: {
                  x: draggedSprite.originalPosition.x + deltaX,
                  y: draggedSprite.originalPosition.y + deltaY,
                },
              };
            }
            return sprite;
          })
        );
      }
    } else {
      setPreviewPosition(null);
    }
  };

  const handleGridMouseDown = (gridPos: GridPosition) => {
    setIsMouseDown(true);
  };

  const handleScreenMouseDown = (screenPos: {x: number, y: number}) => {
    if (activeTool === "select") {
      // Check if clicking on a selected sprite (to start dragging instead of new selection)
      const gridPos = screenToGrid(screenPos, config);
      const clickedSprite = sprites.find(
        (sprite) => sprite.position.x === gridPos.x && sprite.position.y === gridPos.y
      );
      
      // If clicking on a selected sprite, don't start a new selection
      if (clickedSprite && selectedSprites.includes(clickedSprite.id)) {
        return; // Let the sprite drag handling take over
      }
      
      // Start selection rectangle only if not clicking on selected sprites
      if (!isDragging) {
        setIsSelecting(true);
        setSelectionStart(screenPos);
        setSelectionEnd(screenPos);
        setSelectedSprites([]);
      }
    }
  };

  const handleScreenMouseMove = (screenPos: {x: number, y: number}) => {
    if (isSelecting && selectionStart) {
      setSelectionEnd(screenPos);
    }
  };

  const handleGridMouseUp = () => {
    setIsMouseDown(false);

    // Stop dragging and commit the move
    if (isDragging && (draggedSpriteData || draggedSelectionData)) {
      setIsDragging(false);
      setSelectedSprite(null);
      setDraggedSpriteData(null);
      setDraggedSelectionData(null);
      setDragStartPosition(null);
    }

    // End selection
    if (isSelecting) {
      setIsSelecting(false);
      // Keep the selected sprites for potential dragging
    }
  };

  const handleGridMouseLeave = useCallback(() => {
    setPreviewPosition(null);
    setIsMouseDown(false);

    // If we're dragging and leave the grid, cancel the drag and restore original positions
    if (isDragging) {
      if (draggedSelectionData) {
        setSprites((prevSprites) =>
          prevSprites.map((sprite) => {
            const draggedSprite = draggedSelectionData.find(
              (d) => d.id === sprite.id
            );
            if (draggedSprite) {
              return { ...sprite, position: draggedSprite.originalPosition };
            }
            return sprite;
          })
        );
        setDraggedSelectionData(null);
      } else if (draggedSpriteData) {
        setSprites((prevSprites) =>
          prevSprites.map((sprite) =>
            sprite.id === draggedSpriteData.id
              ? { ...sprite, position: draggedSpriteData.originalPosition }
              : sprite
          )
        );
        setDraggedSpriteData(null);
      }
      setIsDragging(false);
      setSelectedSprite(null);
      setDragStartPosition(null);
    }
  }, [isDragging, draggedSelectionData, draggedSpriteData]);

  const handleSelectionChange = (gridPos: GridPosition) => {
    if (isSelecting && selectionStart) {
      setSelectionEnd(gridPos);
    }
  };

  // Tool management functions
  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    setIsPlacingMarble(tool === "marble");
    setSelectedSprite(null);
    setIsDragging(false);
    setDraggedSpriteData(null);
    setDraggedSelectionData(null);
    setDragStartPosition(null);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedSprites([]);
    setPreviewPosition(null);
  };

  const handleSpriteTypeChange = (spriteType: (typeof SPRITE_TYPES)[0]) => {
    setSelectedSpriteType(spriteType);
  };

  const handleMarblePlacementToggle = () => {
    setIsPlacingMarble(!isPlacingMarble);
    if (!isPlacingMarble) {
      setActiveTool("marble");
    }
  };

  const handleSpriteClick = (gridPos: GridPosition, spriteId: string) => {
    if (activeTool === "move") {
      // Find the sprite data
      const sprite = sprites.find((s) => s.id === spriteId);
      if (sprite) {
        setSelectedSprite(spriteId);
        setDragStartPosition(gridPos);
        setDraggedSpriteData({
          id: spriteId,
          originalPosition: sprite.position,
          spritePath: sprite.spritePath,
          blockName: sprite.blockName,
          hue: sprite.hue,
          height: sprite.height,
        });
        // We'll start dragging on mouse down, not on click
      }
    } else if (activeTool === "deepen") {
      // Increase or decrease the height of the clicked sprite
      const sprite = sprites.find((s) => s.id === spriteId);
      if (sprite) {
        setSprites((prev) =>
          prev.map((s) =>
            s.id === spriteId
              ? {
                  ...s,
                  height: s.height !== undefined ? s.height + 1 : 1,
                }
              : s
          )
        );
      }
    }
  };

  const handleSpriteMouseDown = (gridPos: GridPosition, spriteId: string) => {
    if (activeTool === "move") {
      // Single sprite dragging only
      const sprite = sprites.find((s) => s.id === spriteId);
      if (sprite) {
        setSelectedSprite(spriteId);
        setDragStartPosition(sprite.position);
        setDraggedSpriteData({
          id: spriteId,
          originalPosition: sprite.position,
          spritePath: sprite.spritePath,
          blockName: sprite.blockName,
          hue: sprite.hue,
          height: sprite.height,
        });
        // Clear any existing selection
        setSelectedSprites([]);
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    } else if (activeTool === "select") {
      // Multi-sprite selection and dragging
      if (selectedSprites.includes(spriteId) && selectedSprites.length > 1) {
        // Start dragging the entire selection
        const selectionData = selectedSprites
          .map((id) => {
            const sprite = sprites.find((s) => s.id === id);
            return sprite
              ? {
                  id: sprite.id,
                  originalPosition: sprite.position,
                  spritePath: sprite.spritePath,
                  blockName: sprite.blockName,
                  hue: sprite.hue,
                  height: sprite.height,
                }
              : null;
          })
          .filter(Boolean) as Array<{
          id: string;
          originalPosition: GridPosition;
          spritePath: string;
          blockName: string;
          hue?: number;
          height?: number;
        }>;

        setDraggedSelectionData(selectionData);
        setDragStartPosition(gridPos);
        setIsDragging(true);
      } else {
        // Single sprite in selection mode - clear selection and start fresh
        setSelectedSprites([]);
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    }
  };

  const handleSpriteContextMenu = (gridPos: GridPosition, spriteId: string) => {
    if (activeTool === "deepen") {
      // Decrease the height of the right-clicked sprite
      const sprite = sprites.find((s) => s.id === spriteId);
      if (sprite && sprite.height && sprite.height > 0) {
        setSprites((prev) =>
          prev.map((s) =>
            s.id === spriteId
              ? {
                  ...s,
                  height: s.height! - 1,
                }
              : s
          )
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        selectedSpriteType={selectedSpriteType}
        onSpriteTypeChange={handleSpriteTypeChange}
        isPlacingMarble={isPlacingMarble}
        onMarblePlacementToggle={handleMarblePlacementToggle}
        marbleCount={marbles.length}
        onClearMarbles={() => setMarbles([])}
        onResetColors={() => {
          setSprites((sprites) =>
            sprites.map((sprite) => ({ ...sprite, hue: undefined }))
          );
        }}
        spriteCount={sprites.length}
        autoMode={autoMode}
        onAutoModeChange={setAutoMode}
        soundEnabled={soundEnabled}
        onSoundEnabledChange={setSoundEnabled}
        onStepMarbles={stepMarbles}
      />

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Main Content - Grid */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
            <div className="border border-gray-600 rounded relative bg-gray-750 flex items-center justify-center w-fit mx-auto">
              <IsometricGrid
                config={config}
                width={800}
                height={600}
                sprites={sprites}
                marbles={marbles}
                isAutoMode={autoMode}
                activeTool={activeTool}
                selectedSpriteId={selectedSprite}
                isDragging={isDragging}
                previewSprite={
                  previewPosition && activeTool === "place" && !isPlacingMarble
                    ? {
                        position: previewPosition,
                        spritePath: selectedSpriteType.path,
                      }
                    : undefined
                }
                previewMarble={
                  previewPosition &&
                  (activeTool === "marble" || isPlacingMarble)
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
                onSelectionChange={handleSelectionChange}
                onScreenMouseDown={handleScreenMouseDown}
                onScreenMouseMove={handleScreenMouseMove}
                onSpriteClick={handleSpriteClick}
                onSpriteMouseDown={handleSpriteMouseDown}
                onSpriteContextMenu={handleSpriteContextMenu}
                isSelecting={isSelecting}
                selectionStart={selectionStart}
                selectionEnd={selectionEnd}
                selectedSprites={selectedSprites}
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
                    Falling:{" "}
                    {marbles.filter((m) => m.state === "falling").length}
                  </div>
                  <div>
                    Rolling:{" "}
                    {marbles.filter((m) => m.state === "rolling").length}
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
    </div>
  );
}
