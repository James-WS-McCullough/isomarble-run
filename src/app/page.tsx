'use client';

import { useState, useEffect, useCallback } from 'react';
import { IsometricGrid } from '@/components/IsometricGrid';
import { Marble } from '@/components/Marble';
import { createIsometricGrid, GridPosition } from '@/lib/isometric';
import { MarbleState, createMarble, updateMarble, TrackPiece } from '@/lib/marble-physics';

// Available sprite types
const SPRITE_TYPES = [
  { id: 'criss-cross', name: 'Criss Cross', path: '/sprites/isometric-cubes/CrissCross.png' },
  { id: 'landing-lower-left', name: 'Landing Lower Left', path: '/sprites/isometric-cubes/LandingLowerLeft.png' },
  { id: 'straight-down-left', name: 'Straight Down Left', path: '/sprites/isometric-cubes/StrightDownLeft.png' },
  { id: 'straight-down-right', name: 'Straight Down Right', path: '/sprites/isometric-cubes/StrightDownRight.png' },
];

export default function Home() {
  // Fixed sprite size: 100px with grid cells 50px × 25px
  const config = createIsometricGrid(100);
  
  const [sprites, setSprites] = useState([
    {
      id: 'test-cube-1',
      position: { x: 0, y: 0 },
      spritePath: '/sprites/isometric-cubes/CrissCross.png',
    },
    {
      id: 'test-cube-2',
      position: { x: 1, y: 0 },
      spritePath: '/sprites/isometric-cubes/LandingLowerLeft.png',
    },
    {
      id: 'test-cube-3',
      position: { x: 0, y: 1 },
      spritePath: '/sprites/isometric-cubes/StrightDownLeft.png',
    },
  ]);

  const [selectedSpriteType, setSelectedSpriteType] = useState(SPRITE_TYPES[0]);
  const [previewPosition, setPreviewPosition] = useState<GridPosition | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [marbles, setMarbles] = useState<MarbleState[]>([]);
  const [isPlacingMarble, setIsPlacingMarble] = useState(false);

  // Convert sprites to track pieces for physics
  const trackPieces: TrackPiece[] = sprites.map(sprite => ({
    position: sprite.position,
    type: sprite.id.split('-')[0],
    spritePath: sprite.spritePath,
  }));

  // Animation loop for marble physics
  useEffect(() => {
    if (marbles.length === 0) return;

    const animationFrame = requestAnimationFrame(() => {
      setMarbles(currentMarbles => 
        currentMarbles.map(marble => updateMarble(marble, trackPieces))
      );
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [marbles, trackPieces]);

  const handleGridClick = (gridPos: GridPosition) => {
    if (isPlacingMarble) {
      // Place a marble
      const newMarble = createMarble(gridPos);
      setMarbles([...marbles, newMarble]);
      setDebugInfo(`Placed marble at: (${gridPos.x}, ${gridPos.y})`);
      setIsPlacingMarble(false);
      return;
    }

    // Only place/remove track pieces if the click position matches the current preview position
    if (previewPosition && 
        gridPos.x === previewPosition.x && 
        gridPos.y === previewPosition.y) {
      setDebugInfo(`Placing at highlighted position: (${gridPos.x}, ${gridPos.y})`);
      placeSprite(gridPos);
    } else {
      setDebugInfo(`Click ignored - not on highlighted cell`);
    }
  };

  const placeSprite = (gridPos: GridPosition) => {
    // Check if there's already a sprite at this exact position
    const existingSprite = sprites.find(
      sprite => sprite.position.x === gridPos.x && sprite.position.y === gridPos.y
    );
    
    if (existingSprite) {
      // Remove existing sprite only if it's at the exact same position
      setDebugInfo(`Removing sprite at: (${gridPos.x}, ${gridPos.y})`);
      setSprites(sprites.filter(sprite => sprite.id !== existingSprite.id));
    } else {
      // Add new sprite of selected type
      setDebugInfo(`Adding new sprite at: (${gridPos.x}, ${gridPos.y})`);
      const newSprite = {
        id: `${selectedSpriteType.id}-${Date.now()}`,
        position: gridPos,
        spritePath: selectedSpriteType.path,
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
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Isometric Marble Run
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setIsPlacingMarble(!isPlacingMarble)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isPlacingMarble
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isPlacingMarble ? 'Cancel Marble Placement' : 'Place Marble'}
            </button>
            
            <button
              onClick={() => setMarbles([])}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
              disabled={marbles.length === 0}
            >
              Clear All Marbles ({marbles.length})
            </button>
          </div>

          <h3 className="text-lg font-semibold mb-4">Track Pieces</h3>
          <div className="grid grid-cols-4 gap-4">
            {SPRITE_TYPES.map((spriteType) => (
              <button
                key={spriteType.id}
                onClick={() => {
                  setSelectedSpriteType(spriteType);
                  setIsPlacingMarble(false);
                }}
                disabled={isPlacingMarble}
                className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                  selectedSpriteType.id === spriteType.id && !isPlacingMarble
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isPlacingMarble ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <img
                  src={spriteType.path}
                  alt={spriteType.name}
                  className="w-8 h-8"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-xs text-center">{spriteType.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Marble Run Builder</h2>
          <p className="text-gray-600 mb-4">
            {isPlacingMarble 
              ? 'Click on any grid position to place a marble that will start falling.'
              : `Hold down mouse to place ${selectedSpriteType.name} pieces. Click existing pieces to remove them.`
            }
            Grid dimensions: {config.gridCellWidth}px × {config.gridCellHeight}px per cell
          </p>
          
          {/* Debug info */}
          <div className="mb-4 p-2 bg-gray-100 rounded text-sm">
            <strong>Debug:</strong> {debugInfo}
          </div>
          
          <div className="border border-gray-300 rounded relative">
            <IsometricGrid
              config={config}
              width={800}
              height={600}
              sprites={sprites}
              previewSprite={previewPosition && !isPlacingMarble ? {
                position: previewPosition,
                spritePath: selectedSpriteType.path,
              } : undefined}
              onGridClick={handleGridClick}
              onGridHover={handleGridHover}
              onGridMouseDown={handleGridMouseDown}
              onGridMouseUp={handleGridMouseUp}
              onGridMouseLeave={handleGridMouseLeave}
              onSpriteClick={handleSpriteClick}
              showGrid={true}
              className="bg-gray-50"
            />
            
            {/* Render marbles on top of the grid */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute"
                style={{
                  left: `${800 / 2}px`,
                  top: `${600 / 2}px`,
                }}
              >
                {marbles.map((marble) => (
                  <Marble
                    key={marble.id}
                    position={marble.screenPosition}
                    rotation={marble.rotation}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Current Sprites:</h3>
          <div className="text-sm text-gray-600">
            {sprites.map(sprite => (
              <div key={sprite.id}>
                {sprite.id}: ({sprite.position.x}, {sprite.position.y})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
