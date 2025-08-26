'use client';

import React from 'react';
import { GridPosition, IsometricGridConfig, getSpritePlacement } from '@/lib/isometric';

interface IsometricSpriteProps {
  gridPosition: GridPosition;
  spritePath: string;
  config: IsometricGridConfig;
  alt?: string;
  className?: string;
  onClick?: (gridPos: GridPosition) => void;
}

/**
 * Component for rendering an isometric sprite at a specific grid position
 */
export const IsometricSprite: React.FC<IsometricSpriteProps> = ({
  gridPosition,
  spritePath,
  config,
  alt = 'Isometric sprite',
  className = '',
  onClick,
}) => {
  const screenPos = getSpritePlacement(gridPosition, config);

  const handleClick = () => {
    if (onClick) {
      onClick(gridPosition);
    }
  };

  // Calculate z-index based on grid position
  // Higher y values (further back) and higher x values should have higher z-index (render in front)
  // This creates the proper isometric depth where "higher" objects appear in front
  const zIndex = 100 + (gridPosition.x + gridPosition.y);

  return (
    <img
      src={spritePath}
      alt={alt}
      className={`absolute pointer-events-auto block ${className}`}
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${config.spriteSize}px`,
        height: `${config.spriteSize}px`,
        minWidth: `${config.spriteSize}px`,
        minHeight: `${config.spriteSize}px`,
        imageRendering: 'pixelated',
        zIndex: zIndex,
        position: 'absolute',
        boxSizing: 'border-box',
      }}
      onClick={handleClick}
    />
  );
};
