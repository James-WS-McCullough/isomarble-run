import { GridPosition } from './isometric';

interface ScreenPosition {
  x: number;
  y: number;
}

export interface MarbleState {
  id: string;
  position: GridPosition;
  screenPosition: ScreenPosition;
  velocity: ScreenPosition;
  state: 'falling' | 'rolling' | 'stopped';
  rollDirection?: 'up-right' | 'down-right' | 'down-left' | 'up-left';
  rotation: number; // Rotation angle for the base sprite
  fallTarget?: GridPosition; // Target landing position for falling marbles
  fallAcceleration?: number; // Current falling acceleration
}

export interface TrackPiece {
  position: GridPosition;
  type: string;
  spritePath: string;
}

/**
 * Physics constants for marble movement
 */
const PHYSICS = {
  GRAVITY: 3, // How fast marbles fall (pixels per frame)
  FALLING_VELOCITY_X: 0, // No horizontal drift while falling
  ROLLING_SPEED: 2, // How fast marbles roll along tracks
  ROTATION_SPEED: 3, // How fast the marble rotates while rolling
  // Isometric falling direction: down and left on screen
  ISOMETRIC_FALL_X: -1, // Move left while falling
  ISOMETRIC_FALL_Y: 2, // Move down more than left (2:1 ratio for isometric)
};

/**
 * Check if there's a track piece at the given grid position
 */
export function hasTrackAt(position: GridPosition, trackPieces: TrackPiece[]): boolean {
  return trackPieces.some(
    piece => piece.position.x === position.x && piece.position.y === position.y
  );
}

/**
 * Get the track piece at a specific position
 */
export function getTrackAt(position: GridPosition, trackPieces: TrackPiece[]): TrackPiece | null {
  return trackPieces.find(
    piece => piece.position.x === position.x && piece.position.y === position.y
  ) || null;
}

/**
 * Determine which direction a marble should roll based on track type
 */
function getrollDirection(trackType: string): string {
  switch (trackType) {
    case 'CrissCross':
      // Cross piece triggers falling behavior instead of rolling
      return 'fall'; // Special case - triggers falling
      
    case 'StrightDownLeft':
      // Can roll down-left or up-right (along the track)
      return Math.random() < 0.5 ? 'down-left' : 'up-right';
      
    case 'StrightDownRight':
      // Can roll down-right or up-left (along the track)
      return Math.random() < 0.5 ? 'down-right' : 'up-left';
      
    case 'landing':
    case 'LandingLowerLeft':
      // Only rolls down and left
      return Math.random() < 0.5 ? 'down-left' : 'down-right';
      
    default:
      // Default to random direction
      const defaultDirections = ['up-right', 'down-right', 'down-left', 'up-left'];
      return defaultDirections[Math.floor(Math.random() * defaultDirections.length)];
  }
}

/**
 * Find the next track piece below the marble in isometric downward direction (with wrapping)
 */
function findLandingPosition(position: GridPosition, trackPieces: TrackPiece[]): GridPosition | null {
  const gridWidth = 16; // Assuming 16x16 grid
  const gridHeight = 16;
  
  // In isometric view, "down" means increasing Y coordinate
  // Start searching from the position below the marble
  let searchY = Math.floor(position.y) + 1;
  const searchX = Math.floor(position.x);
  
  // Search downward in isometric space (increasing Y)
  for (let offset = 1; offset <= gridHeight; offset++) {
    const testY = (searchY + offset - 1) % gridHeight; // Handle vertical wrapping
    const testPos = { x: searchX, y: testY };
    
    const track = getTrackAt(testPos, trackPieces);
    if (track) {
      return testPos;
    }
  }
  
  return null; // No landing position found
}

/**
 * Calculate the screen distance between two grid positions
 */
function getScreenDistance(from: GridPosition, to: GridPosition): number {
  const fromScreen = {
    x: (from.x - from.y) * 50,
    y: (from.x + from.y) * 25
  };
  const toScreen = {
    x: (to.x - to.y) * 50,
    y: (to.x + to.y) * 25
  };
  
  return Math.sqrt(
    Math.pow(toScreen.x - fromScreen.x, 2) + 
    Math.pow(toScreen.y - fromScreen.y, 2)
  );
}
function getTrackDirections(trackType: string): ('up-right' | 'down-right' | 'down-left' | 'up-left')[] {
  switch (trackType) {
    case 'CrissCross':
      return ['up-right', 'down-right', 'down-left', 'up-left'];
    case 'StrightDownRight':
      return ['up-left', 'down-right'];
    case 'StrightDownLeft':
      return ['up-right', 'down-left'];
    case 'LandingLowerLeft':
      return ['down-left', 'up-left'];
    default:
      return [];
  }
}

/**
 * Get the velocity vector for a roll direction
 */
function getRollVelocity(direction: string): { x: number; y: number } {
  switch (direction) {
    case 'up-right':
      return { x: PHYSICS.ROLLING_SPEED * 0.5, y: -PHYSICS.ROLLING_SPEED * 0.5 };
    case 'down-right':
      return { x: PHYSICS.ROLLING_SPEED * 0.5, y: PHYSICS.ROLLING_SPEED * 0.5 };
    case 'down-left':
      return { x: -PHYSICS.ROLLING_SPEED * 0.5, y: PHYSICS.ROLLING_SPEED * 0.5 };
    case 'up-left':
      return { x: -PHYSICS.ROLLING_SPEED * 0.5, y: -PHYSICS.ROLLING_SPEED * 0.5 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Update marble physics for one frame
 */
export function updateMarble(marble: MarbleState, trackPieces: TrackPiece[]): MarbleState {
  const newMarble = { ...marble };
  
  switch (marble.state) {
    case 'falling':
      // If we don't have a fall target, calculate one
      if (!newMarble.fallTarget) {
        const landingPos = findLandingPosition(marble.position, trackPieces);
        if (landingPos) {
          newMarble.fallTarget = landingPos;
          newMarble.fallAcceleration = 0.5; // Start with small acceleration
        } else {
          // No landing position found - continue falling in isometric direction with wrapping
          const fallDistance = 8; // Fall 8 grid positions
          newMarble.fallTarget = {
            x: Math.floor(marble.position.x),
            y: (Math.floor(marble.position.y) + fallDistance) % 16 // Wrap around grid
          };
          newMarble.fallAcceleration = 0.5;
        }
      }
      
      // Calculate target screen position
      const targetScreen = {
        x: (newMarble.fallTarget.x - newMarble.fallTarget.y) * 50,
        y: (newMarble.fallTarget.x + newMarble.fallTarget.y) * 25
      };
      
      // For falling, move in isometric "down" direction (down and right on screen)
      // Instead of moving directly to target, fall in isometric gravity direction
      if (newMarble.fallAcceleration) {
        newMarble.fallAcceleration += 0.1; // Gradual acceleration
        newMarble.fallAcceleration = Math.min(newMarble.fallAcceleration, 4); // Cap acceleration
      }
      
      const speed = newMarble.fallAcceleration || 1;
      newMarble.screenPosition.x += PHYSICS.ISOMETRIC_FALL_X * speed;
      newMarble.screenPosition.y += PHYSICS.ISOMETRIC_FALL_Y * speed;
      
      // Update grid position
      newMarble.position.x = (newMarble.screenPosition.x / 50 + newMarble.screenPosition.y / 25) / 2;
      newMarble.position.y = (newMarble.screenPosition.y / 25 - newMarble.screenPosition.x / 50) / 2;
      
      // Check if we're close enough to the target or found a track
      const currentGridPos = {
        x: Math.round(newMarble.position.x),
        y: Math.round(newMarble.position.y)
      };
      
      const foundTrack = getTrackAt(currentGridPos, trackPieces);
      if (foundTrack) {
        // Found a track - snap to it and start rolling
        newMarble.screenPosition = {
          x: (currentGridPos.x - currentGridPos.y) * 50,
          y: (currentGridPos.x + currentGridPos.y) * 25
        };
        newMarble.position = { ...currentGridPos };
        
        const rollDirection = getrollDirection(foundTrack.type);
        if (rollDirection === 'fall') {
          // Cross piece - continue falling to find next landing spot
          newMarble.fallTarget = undefined;
          newMarble.fallAcceleration = 0.5; // Reset acceleration for continued fall
        } else {
          // Regular track - start rolling
          newMarble.state = 'rolling';
          newMarble.rollDirection = rollDirection as any;
          newMarble.velocity = getRollVelocity(rollDirection);
          newMarble.fallTarget = undefined;
          newMarble.fallAcceleration = undefined;
        }
      }
      
      // Handle screen wrapping
      const gridScreenWidth = 16 * 50; // 16 grid cells * 50px width
      const gridScreenHeight = 16 * 25; // 16 grid cells * 25px height
      
      if (newMarble.screenPosition.y > gridScreenHeight * 2) {
        // Wrap to top
        newMarble.screenPosition.y = -50;
        newMarble.fallTarget = undefined;
        newMarble.fallAcceleration = 0.5;
      }
      
      if (newMarble.screenPosition.x > gridScreenWidth) {
        // Wrap to left side
        newMarble.screenPosition.x = -50;
      } else if (newMarble.screenPosition.x < -50) {
        // Wrap to right side
        newMarble.screenPosition.x = gridScreenWidth;
      }
      break;
      
    case 'rolling':
      // Move marble in the roll direction
      newMarble.screenPosition.x += marble.velocity.x;
      newMarble.screenPosition.y += marble.velocity.y;
      
      // Update rotation while rolling
      newMarble.rotation += PHYSICS.ROTATION_SPEED;
      if (newMarble.rotation >= 360) newMarble.rotation -= 360;
      
      // Update grid position based on screen position
      newMarble.position.x = (newMarble.screenPosition.x / 50 + newMarble.screenPosition.y / 25) / 2;
      newMarble.position.y = (newMarble.screenPosition.y / 25 - newMarble.screenPosition.x / 50) / 2;
      
      // Check if marble has moved to a new grid cell
      const currentPos = {
        x: Math.round(newMarble.position.x),
        y: Math.round(newMarble.position.y),
      };
      
      // Check if there's a track at the current position
      const currentTrack = getTrackAt(currentPos, trackPieces);
      
      if (!currentTrack) {
        // No track piece below - start falling
        newMarble.state = 'falling';
        newMarble.velocity = { x: 0, y: 0 };
        newMarble.rollDirection = undefined;
        newMarble.fallTarget = undefined;
        newMarble.fallAcceleration = undefined;
      } else {
        // Check if we've moved to a new track piece and need to change direction
        const lastPos = {
          x: Math.round((newMarble.screenPosition.x - marble.velocity.x) / 50 + (newMarble.screenPosition.y - marble.velocity.y) / 25) / 2,
          y: Math.round((newMarble.screenPosition.y - marble.velocity.y) / 25 - (newMarble.screenPosition.x - marble.velocity.x) / 50) / 2,
        };
        
        if (currentPos.x !== lastPos.x || currentPos.y !== lastPos.y) {
          // We've moved to a new grid cell - check if we need new direction
          const newDirections = getTrackDirections(currentTrack.type);
          
          // Try to continue in a compatible direction, or pick a random one
          let newDirection = marble.rollDirection;
          if (!newDirection || !newDirections.includes(newDirection)) {
            // Pick a random direction from available directions
            if (newDirections.length > 0) {
              newDirection = newDirections[Math.floor(Math.random() * newDirections.length)];
            }
          }
          
          if (newDirection) {
            newMarble.rollDirection = newDirection;
            const newVelocity = getRollVelocity(newDirection);
            newMarble.velocity = newVelocity;
          }
        }
      }
      break;
      
    case 'stopped':
      // Marble is at rest
      break;
  }
  
  return newMarble;
}

/**
 * Create a new marble at the specified position
 */
export function createMarble(position: GridPosition): MarbleState {
  // Convert grid position to screen position for physics
  const screenX = (position.x - position.y) * 50; // gridCellWidth = 50
  const screenY = (position.x + position.y) * 25; // gridCellHeight = 25
  
  return {
    id: `marble-${Date.now()}`,
    position: { x: position.x, y: position.y },
    screenPosition: { x: screenX, y: screenY },
    velocity: { x: 0, y: 0 },
    state: 'falling',
    rotation: 0,
    fallTarget: undefined,
    fallAcceleration: undefined,
  };
}
