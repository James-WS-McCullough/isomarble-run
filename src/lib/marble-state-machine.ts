import {
  type Block,
  type BlockBehavior,
  getBlockBehavior,
  type MarbleStateType,
  type MomentumDirection,
  momentumToVelocity,
} from "./block-types";
import {
  GRID_MAX,
  GRID_MIN,
  type GridPosition,
  samePosition,
} from "./isometric";

/**
 * A marble in the simulation. Each step moves it exactly one grid cell.
 */
export interface MarbleState {
  id: string;
  gridPosition: GridPosition;
  state: MarbleStateType;
  momentum: MomentumDirection;
  /** Marble's colour (0-360), painted onto blocks it rolls over */
  hue: number;
  /** Grid cell where the marble fell behind the track, used for draw order */
  behindCoordinates?: GridPosition;
  /** True when the last step wrapped the marble back to the top of the grid */
  warped?: boolean;
}

let marbleCounter = 0;

/**
 * Create a new marble at the specified position
 */
export function createMarble(position: GridPosition): MarbleState {
  marbleCounter += 1;
  return {
    id: `marble-${marbleCounter}`,
    gridPosition: { x: position.x, y: position.y },
    state: "falling",
    momentum: "0", // Start with no momentum (falling)
    hue: Math.floor(Math.random() * 360),
  };
}

/**
 * Advance a marble by one step:
 * 1. A marble that fell behind the track keeps falling until it is no
 *    longer hidden by a block.
 * 2. A marble on top of a block rolls one cell in the direction the block
 *    sends it.
 * 3. Otherwise the marble falls one cell (+1x, +1y is straight down).
 */
export function stepMarble(marble: MarbleState, blocks: Block[]): MarbleState {
  if (marble.state === "behind") {
    return stepBehind(marble, blocks);
  }

  const block = getBlockAt(marble.gridPosition, blocks);
  const behavior = block ? getBlockBehavior(block.blockName) : undefined;
  if (behavior) {
    return rollOver(marble, behavior);
  }

  return fall(marble);
}

/**
 * True once a marble has left the grid sideways. Wrapping only handles the
 * bottom edges, so these marbles would otherwise fall forever off-screen.
 */
export function isOffGrid(position: GridPosition): boolean {
  return position.x < GRID_MIN || position.y < GRID_MIN;
}

function stepBehind(marble: MarbleState, blocks: Block[]): MarbleState {
  const { position, warped } = wrapGridPosition(below(marble.gridPosition));

  if (isMarbleOccluded(position, blocks)) {
    return { ...marble, gridPosition: position, momentum: "0", warped };
  }

  return {
    ...marble,
    gridPosition: position,
    state: "falling",
    momentum: "0",
    hue: shiftHue(marble.hue),
    behindCoordinates: undefined,
    warped,
  };
}

function rollOver(marble: MarbleState, behavior: BlockBehavior): MarbleState {
  const momentum = chooseOutputMomentum(marble.momentum, behavior);
  const step = momentumToVelocity(momentum);
  const { position, warped } = wrapGridPosition({
    x: marble.gridPosition.x + step.x,
    y: marble.gridPosition.y + step.y,
  });

  return {
    ...marble,
    gridPosition: position,
    state: "rolling",
    momentum,
    warped,
  };
}

function fall(marble: MarbleState): MarbleState {
  const { position, warped } = wrapGridPosition(below(marble.gridPosition));

  // Rolling off a block towards the back of the scene means the marble
  // falls behind the track rather than in front of it
  const fellBackwards =
    marble.state === "rolling" &&
    (marble.momentum === "-x" || marble.momentum === "-y");

  if (fellBackwards) {
    return {
      ...marble,
      gridPosition: position,
      state: "behind",
      momentum: "0",
      behindCoordinates: marble.gridPosition,
      warped,
    };
  }

  return {
    ...marble,
    gridPosition: position,
    state: "falling",
    momentum: "0",
    // Marbles change colour each time they start a new fall
    hue: marble.state === "falling" ? marble.hue : shiftHue(marble.hue),
    behindCoordinates: undefined,
    warped,
  };
}

function below(position: GridPosition): GridPosition {
  return { x: position.x + 1, y: position.y + 1 };
}

/** Rotate a hue by a random 30-140 degrees */
function shiftHue(hue: number): number {
  return (hue + 30 + Math.floor(Math.random() * 111)) % 360;
}

/**
 * Wrap marbles near the bottom edge of the grid back to the top of their
 * diagonal column. This is predictive: it wraps when the NEXT downward step
 * would leave the grid.
 */
export function wrapGridPosition(position: GridPosition): {
  position: GridPosition;
  warped: boolean;
} {
  if (position.x + 1 <= GRID_MAX && position.y + 1 <= GRID_MAX) {
    return { position, warped: false };
  }

  // Move back up the diagonal (-1x, -1y) as far as the top boundary allows
  const stepsUp = Math.max(
    0,
    Math.min(position.x - GRID_MIN, position.y - GRID_MIN),
  );
  return {
    position: { x: position.x - stepsUp, y: position.y - stepsUp },
    warped: stepsUp > 0,
  };
}

function getBlockAt(position: GridPosition, blocks: Block[]): Block | null {
  return blocks.find((block) => samePosition(block.position, position)) ?? null;
}

/**
 * Relative positions of blocks that hide a marble from view. The marble's
 * own cell is excluded so that it can land on blocks.
 */
const OCCLUSION_OFFSETS: GridPosition[] = [
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: -2, y: -1 },
  { x: -1, y: -2 },
  { x: -2, y: -2 },
];

function isMarbleOccluded(position: GridPosition, blocks: Block[]): boolean {
  return OCCLUSION_OFFSETS.some((offset) =>
    getBlockAt({ x: position.x + offset.x, y: position.y + offset.y }, blocks),
  );
}

/**
 * Pick the direction a block sends a marble, based on how it arrived
 */
function chooseOutputMomentum(
  inputMomentum: MomentumDirection,
  behavior: BlockBehavior,
): MomentumDirection {
  const conditional = behavior.conditionalOutputs.find(
    (output) => output.inputMomentum === inputMomentum,
  );
  return pickOne(
    conditional ? conditional.outputMomentum : behavior.defaultOutputMomentum,
  );
}

function pickOne(
  options: MomentumDirection | MomentumDirection[],
): MomentumDirection {
  if (!Array.isArray(options)) return options;
  return options[Math.floor(Math.random() * options.length)];
}
