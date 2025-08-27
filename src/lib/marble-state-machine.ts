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
}

/**
 * Track piece interface for the state machine
 */
export interface TrackPiece {
  position: GridPosition;
  blockName: string;
  spritePath: string;
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

  // STATE MACHINE LOGIC:
  // 1. Check if marble is on top of a block
  const currentTrack = getTrackAt(marble.gridPosition, trackPieces);

  if (currentTrack) {
    // 1. Marble is on top of a block - change state to rolling
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
  } else {
    // 2. Marble is not on top of a block - set state to falling
    newMarble.state = "falling";
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
 * Wrap grid position to handle screen boundaries (16x16 grid)
 */
function wrapGridPosition(position: { x: number; y: number }): GridPosition {
  const gridSize = 16;

  let wrappedX = position.x % gridSize;
  let wrappedY = position.y % gridSize;

  // Handle negative wrapping
  if (wrappedX < 0) wrappedX += gridSize;
  if (wrappedY < 0) wrappedY += gridSize;

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
