import { GridPosition } from "./isometric";
import {
  MomentumDirection,
  MarbleStateType,
  BlockBehavior,
  getBlockBehavior,
  momentumToVelocity,
  velocityToMomentum,
} from "./block-types";

/**
 * Simplified marble state for the state machine
 */
export interface MarbleStateMachine {
  id: string;
  gridPosition: GridPosition;
  state: MarbleStateType;
  momentum: MomentumDirection;
  rotation: number;
  hue?: number; // Marble's assigned hue (0-360)
  behindCoordinates?: GridPosition; // Grid coordinates where marble entered 'behind' state
}

/**
 * Track piece interface for the state machine
 */
export interface TrackPiece {
  position: GridPosition;
  blockName: string;
  spritePath: string;
  hue?: number; // Track piece hue (0-360)
}

/**
 * Create a new marble at the specified position
 */
export function createMarble(position: GridPosition): MarbleStateMachine {
  return {
    id: `marble-${Date.now()}`,
    gridPosition: { x: position.x, y: position.y },
    state: "falling",
    momentum: "0", // Start with no momentum (falling)
    rotation: 0,
    hue: Math.floor(Math.random() * 360), // Assign random hue on creation
  };
}

/**
 * State machine update function - processes one step of marble logic
 */
export function updateMarbleStateMachine(
  marble: MarbleStateMachine,
  trackPieces: TrackPiece[]
): MarbleStateMachine {
  let newMarble = { ...marble };

  // Handle 'behind' state logic
  if ((marble.state as MarbleStateType) === "behind") {
    // Behind marbles behave exactly like falling marbles
    newMarble.state = "behind";
    newMarble.momentum = "0";

    // Move +1 in both X and Y directions (straight downwards in isometric)
    const newPosition = {
      x: marble.gridPosition.x + 1,
      y: marble.gridPosition.y + 1,
    };
    newMarble.gridPosition = wrapGridPosition(newPosition);

    // AFTER movement, check if marble should transition from 'behind' to 'falling'
    if (!isMarbleOccluded(newMarble.gridPosition, trackPieces)) {
      // No longer occluded, change to falling
      newMarble.state = "falling";
      // Add 30-140 degrees to current hue when entering falling state
      const hueIncrement = 30 + Math.floor(Math.random() * 111); // Random 30-140
      newMarble.hue = ((newMarble.hue || 0) + hueIncrement) % 360;
      newMarble.behindCoordinates = undefined; // Clear behind coordinates
    }

    return newMarble;
  }

  // STATE MACHINE LOGIC:
  // 1. Check if marble is on top of a block
  const currentTrack = getTrackAt(marble.gridPosition, trackPieces);

  if (currentTrack) {
    // 1. Marble is on top of a block - change state to rolling (unless behind)
    // Don't allow rolling if marble is in 'behind' state
    if ((marble.state as MarbleStateType) === "behind") {
      // Behind marbles can't start rolling even on track pieces
      newMarble.state = "behind";
      const newPosition = {
        x: marble.gridPosition.x + 1,
        y: marble.gridPosition.y + 1,
      };
      newMarble.gridPosition = wrapGridPosition(newPosition);
      newMarble.momentum = "0";
    } else {
      newMarble.state = "rolling";

      // Use block's information to calculate new momentum
      const blockBehavior = getBlockBehavior(currentTrack.blockName);
      if (blockBehavior) {
        const { outputState, outputMomentum } = applyBlockBehavior(
          marble.momentum,
          blockBehavior
        );
        newMarble.state = outputState;
        newMarble.momentum = outputMomentum;

        // Move marble in new momentum direction one space
        const newPosition = moveMarbleOneStep(newMarble, outputMomentum);
        newMarble.gridPosition = wrapGridPosition(newPosition);

        // Update rotation if rolling
        if (newMarble.state === "rolling") {
          newMarble.rotation += 15; // Rotate 15 degrees per step
          if (newMarble.rotation >= 360) newMarble.rotation -= 360;
        }
      }
    }
  } else {
    // 2. Marble is not on top of a block - set state to falling

    // Check if marble was rolling with negative momentum (fell backwards off a block)
    const wasRollingWithNegativeMomentum =
      marble.state === "rolling" &&
      (marble.momentum === "-x" || marble.momentum === "-y");

    if (wasRollingWithNegativeMomentum) {
      newMarble.state = "behind";
      // Store the coordinates where marble entered behind state
      // We'll use these coordinates with the same z-index formula as track pieces
      newMarble.behindCoordinates = {
        x: marble.gridPosition.x,
        y: marble.gridPosition.y,
      };
      console.log(
        "Marble entering behind state at",
        marble.gridPosition,
        "behind coordinates stored:",
        newMarble.behindCoordinates
      );
    } else {
      // Add 30-140 degrees to current hue when entering falling state
      if (marble.state !== "falling") {
        const hueIncrement = 30 + Math.floor(Math.random() * 111); // Random 30-140
        newMarble.hue = ((newMarble.hue || 0) + hueIncrement) % 360;
      }

      newMarble.state = "falling";
      newMarble.behindCoordinates = undefined; // Clear any previous behind coordinates
    }

    newMarble.momentum = "0";

    // Move +1 in both X and Y directions (straight downwards in isometric)
    const newPosition = {
      x: marble.gridPosition.x + 1,
      y: marble.gridPosition.y + 1,
    };
    newMarble.gridPosition = wrapGridPosition(newPosition);
  }

  return newMarble;
}

/**
 * Apply block behavior to determine output state and momentum
 */

/**
 * Process marble in rolling state
 */
function processRollingState(
  marble: MarbleStateMachine,
  trackPieces: TrackPiece[]
): MarbleStateMachine {
  const newMarble = { ...marble };

  // TODO: Implement step-by-step rolling logic
  // 1. Move marble one step in momentum direction
  // 2. Check if marble is still on a track piece
  // 3. If yes, check if block behavior changes momentum/state
  // 4. If no track, change to falling state
  // 5. Update rotation

  console.log(
    "Processing rolling state for marble:",
    marble.id,
    "momentum:",
    marble.momentum
  );

  return newMarble;
}

/**
 * Convert grid position to screen position
 */
export function gridToScreenPosition(gridPosition: GridPosition): {
  x: number;
  y: number;
} {
  const screenX = (gridPosition.x - gridPosition.y) * 50;
  const screenY = (gridPosition.x + gridPosition.y) * 25;
  return { x: screenX, y: screenY };
}

/**
 * Wrap grid position to handle screen boundaries (-10 to +10 grid)
 */
function wrapGridPosition(position: { x: number; y: number }): GridPosition {
  const minBound = -10;
  const maxBound = 10;
  const gridSize = maxBound - minBound + 1; // 21 total positions

  let wrappedX = position.x;
  let wrappedY = position.y;

  // Wrap X coordinate
  if (wrappedX > maxBound) {
    wrappedX = minBound + ((wrappedX - minBound) % gridSize);
  } else if (wrappedX < minBound) {
    wrappedX = maxBound - ((minBound - wrappedX - 1) % gridSize);
  }

  // Wrap Y coordinate
  if (wrappedY > maxBound) {
    wrappedY = minBound + ((wrappedY - minBound) % gridSize);
  } else if (wrappedY < minBound) {
    wrappedY = maxBound - ((minBound - wrappedY - 1) % gridSize);
  }

  return { x: wrappedX, y: wrappedY };
}

/**
 * Check if there's a track piece at the given grid position
 */
function getTrackAt(
  position: GridPosition,
  trackPieces: TrackPiece[]
): TrackPiece | null {
  return (
    trackPieces.find(
      (piece) =>
        piece.position.x === position.x && piece.position.y === position.y
    ) || null
  );
}

/**
 * Check if a marble is occluded by track pieces
 * A marble is occluded if there's a track piece at any of these relative positions:
 * -1x, -1y, -1x-1y, -2x-1y, -2y-1x, -2x-2y
 * (Note: Same position (0,0) is excluded - marble can land on blocks)
 */
function isMarbleOccluded(
  marblePosition: GridPosition,
  trackPieces: TrackPiece[]
): boolean {
  const occlusionOffsets = [
    { x: -1, y: 0 }, // -1x
    { x: 0, y: -1 }, // -1y
    { x: -1, y: -1 }, // -1x-1y
    { x: -2, y: -1 }, // -2x-1y
    { x: -1, y: -2 }, // -2y-1x (interpreted as -1x-2y)
    { x: -2, y: -2 }, // -2x-2y
  ];

  for (const offset of occlusionOffsets) {
    const checkPosition = {
      x: marblePosition.x + offset.x,
      y: marblePosition.y + offset.y,
    };

    if (getTrackAt(checkPosition, trackPieces)) {
      return true;
    }
  }

  return false;
}

/**
 * Apply block behavior to determine output state and momentum
 */
function applyBlockBehavior(
  inputMomentum: MomentumDirection,
  blockBehavior: BlockBehavior
): { outputState: MarbleStateType; outputMomentum: MomentumDirection } {
  // Check conditional outputs first
  if (blockBehavior.conditionalOutputs) {
    for (const conditional of blockBehavior.conditionalOutputs) {
      if (conditional.inputMomentum === inputMomentum) {
        let outputMomentum: MomentumDirection;

        if (Array.isArray(conditional.outputMomentum)) {
          // Pick random from array
          const randomIndex = Math.floor(
            Math.random() * conditional.outputMomentum.length
          );
          outputMomentum = conditional.outputMomentum[randomIndex];
        } else {
          outputMomentum = conditional.outputMomentum;
        }

        return {
          outputState: "rolling", // Default to rolling when on a block
          outputMomentum,
        };
      }
    }
  }

  // Use default behavior
  let outputMomentum: MomentumDirection;
  if (Array.isArray(blockBehavior.defaultOutputMomentum)) {
    const randomIndex = Math.floor(
      Math.random() * blockBehavior.defaultOutputMomentum.length
    );
    outputMomentum = blockBehavior.defaultOutputMomentum[randomIndex];
  } else {
    outputMomentum = blockBehavior.defaultOutputMomentum;
  }

  return {
    outputState: "rolling", // Default to rolling when on a block
    outputMomentum,
  };
}

/**
 * Move marble one grid step in the given momentum direction
 */
function moveMarbleOneStep(
  marble: MarbleStateMachine,
  momentum: MomentumDirection
): { x: number; y: number } {
  const velocity = momentumToVelocity(momentum);
  return {
    x: marble.gridPosition.x + velocity.x,
    y: marble.gridPosition.y + velocity.y,
  };
}
