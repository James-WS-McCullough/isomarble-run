import { assetPath } from "./assets";
import type { GridPosition } from "./isometric";

/**
 * Marble momentum directions for the state machine
 */
export type MomentumDirection = "+x" | "+y" | "-x" | "-y" | "0";

/**
 * Marble states for the state machine
 * - rolling: marble is moving on a track piece
 * - falling: marble is falling through empty space
 * - behind: marble is falling behind track pieces (low z-index)
 */
export type MarbleStateType = "rolling" | "falling" | "behind";

/**
 * Conditional output based on input momentum
 */
export interface ConditionalOutput {
  inputMomentum: MomentumDirection;
  outputMomentum: MomentumDirection | MomentumDirection[];
}

/**
 * Block behaviour definition. When an output lists several directions the
 * marble picks one at random.
 */
export interface BlockBehavior {
  blockName: string;
  /** Human-readable name, e.g. "Turn X Minus Y" */
  label: string;
  blockPath: string;
  defaultOutputMomentum: MomentumDirection | MomentumDirection[];
  conditionalOutputs: ConditionalOutput[];
}

/**
 * A block placed on the grid
 */
export interface Block {
  id: string;
  position: GridPosition;
  blockName: string;
  /** Colour painted by the last marble to roll over it (0-360) */
  hue?: number;
  /** Number of wall layers drawn below the block */
  height: number;
}

type BlockDefinition = Omit<BlockBehavior, "label" | "blockPath">;

const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    blockName: "CrissCross",
    defaultOutputMomentum: ["+x", "-x", "+y", "-y"],
    conditionalOutputs: [
      { inputMomentum: "+x", outputMomentum: "+x" },
      { inputMomentum: "-x", outputMomentum: "-x" },
      { inputMomentum: "+y", outputMomentum: "+y" },
      { inputMomentum: "-y", outputMomentum: "-y" },
    ],
  },
  {
    blockName: "StraightY",
    defaultOutputMomentum: ["-y", "+y"],
    conditionalOutputs: [
      { inputMomentum: "+y", outputMomentum: "+y" },
      { inputMomentum: "-y", outputMomentum: "-y" },
    ],
  },
  {
    blockName: "StraightX",
    defaultOutputMomentum: ["+x", "-x"],
    conditionalOutputs: [
      { inputMomentum: "-x", outputMomentum: "-x" },
      { inputMomentum: "+x", outputMomentum: "+x" },
    ],
  },
  {
    blockName: "LandingPlusY",
    defaultOutputMomentum: "+y",
    conditionalOutputs: [],
  },
  {
    blockName: "LandingMinusY",
    defaultOutputMomentum: "-y",
    conditionalOutputs: [],
  },
  {
    blockName: "LandingMinusX",
    defaultOutputMomentum: "-x",
    conditionalOutputs: [],
  },
  {
    blockName: "LandingPlusX",
    defaultOutputMomentum: "+x",
    conditionalOutputs: [],
  },
  {
    blockName: "TurnXY",
    defaultOutputMomentum: ["+x", "+y"],
    conditionalOutputs: [
      { inputMomentum: "-x", outputMomentum: "+y" },
      { inputMomentum: "-y", outputMomentum: "+x" },
    ],
  },
  {
    blockName: "TurnXMinusY",
    defaultOutputMomentum: ["+x", "-y"],
    conditionalOutputs: [
      { inputMomentum: "-x", outputMomentum: "-y" },
      { inputMomentum: "+y", outputMomentum: "+x" },
    ],
  },
  {
    blockName: "TurnYMinusX",
    defaultOutputMomentum: ["+y", "-x"],
    conditionalOutputs: [
      { inputMomentum: "-y", outputMomentum: "-x" },
      { inputMomentum: "+x", outputMomentum: "+y" },
    ],
  },
  {
    blockName: "TurnMinusXMinusY",
    defaultOutputMomentum: ["-x", "-y"],
    conditionalOutputs: [
      { inputMomentum: "+x", outputMomentum: "-y" },
      { inputMomentum: "+y", outputMomentum: "-x" },
    ],
  },
  {
    blockName: "TPlusX",
    defaultOutputMomentum: ["+x", "-y", "+y"],
    conditionalOutputs: [
      { inputMomentum: "-x", outputMomentum: ["-y", "+y"] },
      { inputMomentum: "-y", outputMomentum: "-y" },
      { inputMomentum: "+y", outputMomentum: "+y" },
    ],
  },
  {
    blockName: "TMinusX",
    defaultOutputMomentum: ["-x", "-y", "+y"],
    conditionalOutputs: [
      { inputMomentum: "+x", outputMomentum: ["-y", "+y"] },
      { inputMomentum: "-y", outputMomentum: "-y" },
      { inputMomentum: "+y", outputMomentum: "+y" },
    ],
  },
  {
    blockName: "TPlusY",
    defaultOutputMomentum: ["+y", "-x", "+x"],
    conditionalOutputs: [
      { inputMomentum: "-y", outputMomentum: ["-x", "+x"] },
      { inputMomentum: "-x", outputMomentum: "-x" },
      { inputMomentum: "+x", outputMomentum: "+x" },
    ],
  },
  {
    blockName: "TMinusY",
    defaultOutputMomentum: ["-y", "-x", "+x"],
    conditionalOutputs: [
      { inputMomentum: "+y", outputMomentum: ["-x", "+x"] },
      { inputMomentum: "-x", outputMomentum: "-x" },
      { inputMomentum: "+x", outputMomentum: "+x" },
    ],
  },
];

/**
 * Registry of all block types and their behaviours, in palette order.
 * Each block's sprite lives at public/sprites/isometric-cubes/<blockName>.png
 */
export const BLOCK_TYPES: BlockBehavior[] = BLOCK_DEFINITIONS.map(
  (definition) => ({
    ...definition,
    label: definition.blockName.replace(/([A-Z])/g, " $1").trim(),
    blockPath: assetPath(
      `/sprites/isometric-cubes/${definition.blockName}.png`,
    ),
  }),
);

export const WALL_SPRITE_PATH = assetPath("/sprites/isometric-cubes/Walls.png");

const BLOCKS_BY_NAME = new Map(
  BLOCK_TYPES.map((block) => [block.blockName, block]),
);

/**
 * Get block behaviour by block name
 */
export function getBlockBehavior(blockName: string): BlockBehavior | undefined {
  return BLOCKS_BY_NAME.get(blockName);
}

let blockCounter = 0;

/**
 * Create a new block of the given type
 */
export function createBlock(blockName: string, position: GridPosition): Block {
  blockCounter += 1;
  return {
    id: `block-${blockCounter}`,
    position,
    blockName,
    height: 0,
  };
}

/**
 * Convert momentum direction to a one-cell grid step
 */
export function momentumToVelocity(momentum: MomentumDirection): {
  x: number;
  y: number;
} {
  switch (momentum) {
    case "+x":
      return { x: 1, y: 0 };
    case "-x":
      return { x: -1, y: 0 };
    case "+y":
      return { x: 0, y: 1 };
    case "-y":
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 0 };
  }
}
