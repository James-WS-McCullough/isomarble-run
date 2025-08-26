'use client';

import React from 'react';

interface ScreenPosition {
  x: number;
  y: number;
}

interface MarbleProps {
  position: ScreenPosition;
  rotation?: number;
}

/**
 * Component for rendering a marble with base and highlight sprites
 */
export const Marble: React.FC<MarbleProps> = ({
  position,
  rotation = 0,
}) => {
  // Use screen coordinates directly for positioning - no grid conversion needed
  const finalScreenPos = {
    x: position.x,
    y: position.y - 50, // Raise marble 50px above the surface
  };

  // Calculate z-index based on screen position
  const zIndex = 200; // High z-index to appear above track pieces

  const marbleSize = 50; // Marble size (half of 100px sprite size)

  // Rotation transform
  const transform = rotation !== 0 ? `rotate(${rotation}deg)` : 'none';

  return (
    <>
      {/* Marble base */}
      <img
        src="/sprites/marble/MarbleBase.png"
        alt="Marble base"
        className="absolute pointer-events-none"
        style={{
          left: `${finalScreenPos.x - marbleSize / 2}px`,
          top: `${finalScreenPos.y - marbleSize / 2}px`,
          width: `${marbleSize}px`,
          height: `${marbleSize}px`,
          minWidth: `${marbleSize}px`,
          minHeight: `${marbleSize}px`,
          imageRendering: 'pixelated',
          zIndex: zIndex,
          position: 'absolute',
          boxSizing: 'border-box',
          transform: transform,
        }}
      />
      
      {/* Marble highlight - doesn't rotate */}
      <img
        src="/sprites/marble/MarbleHilight.png"
        alt="Marble highlight"
        className="absolute pointer-events-none"
        style={{
          left: `${finalScreenPos.x - marbleSize / 2}px`,
          top: `${finalScreenPos.y - marbleSize / 2}px`,
          width: `${marbleSize}px`,
          height: `${marbleSize}px`,
          minWidth: `${marbleSize}px`,
          minHeight: `${marbleSize}px`,
          imageRendering: 'pixelated',
          zIndex: zIndex + 1,
          position: 'absolute',
          boxSizing: 'border-box',
          transform: 'none', // Highlight doesn't rotate
        }}
      />
    </>
  );
};
