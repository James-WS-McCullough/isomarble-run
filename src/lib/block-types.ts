/**
 * Marble momentum directions for the state machine
 */
export type MomentumDirection = "+x" | "+y" | "-x" | "-y" | "0";

/**
 * Marble states for the state machine
 */
export type MarbleStateType = "rolling" | "falling";

/**
 * Conditional output based on input momentum
 */
export interface ConditionalOutput {
  inputMomentum: MomentumDirection;
  outputMomentum: MomentumDirection | MomentumDirection[];
}

/**
 * Block behavior definition
 */
export interface BlockBehavior {
  blockPath: string;
  blockName: string;
  defaultOutputMomentum: MomentumDirection | MomentumDirection[];
  conditionalOutputs?: ConditionalOutput[];
}

/**
 * Registry of all block types and their behaviors
 */
export const BLOCK_TYPES: BlockBehavior[] = [
  {
    blockPath: "/sprites/isometric-cubes/CrissCross.png",
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
    blockPath: "/sprites/isometric-cubes/StrightY.png",
    blockName: "StrightY",
    defaultOutputMomentum: ["-y", "+y"],
    conditionalOutputs: [
      { inputMomentum: "+y", outputMomentum: "+y" },
      { inputMomentum: "-y", outputMomentum: "-y" },
    ],
  },
  {
    blockPath: "/sprites/isometric-cubes/StrightX.png",
    blockName: "StrightX",
    defaultOutputMomentum: ["+x", "-x"],
    conditionalOutputs: [
      { inputMomentum: "-x", outputMomentum: "-x" },
      { inputMomentum: "+x", outputMomentum: "+x" },
    ],
  },
  {
    blockPath: "/sprites/isometric-cubes/LandingPlusY.png",
    blockName: "LandingPlusY",
    defaultOutputMomentum: "+y",
    conditionalOutputs: [],
  },
];

/**
 * Get block behavior by block name
 */
export function getBlockBehavior(blockName: string): BlockBehavior | undefined {
  return BLOCK_TYPES.find((block) => block.blockName === blockName);
}

/**
 * Get block behavior by sprite path
 */
export function getBlockBehaviorByPath(
  spritePath: string
): BlockBehavior | undefined {
  return BLOCK_TYPES.find((block) => block.blockPath === spritePath);
}

/**
 * Convert momentum direction to velocity vector
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
    case "0":
      return { x: 0, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Convert velocity vector to momentum direction
 */
export function velocityToMomentum(velocity: {
  x: number;
  y: number;
}): MomentumDirection {
  if (velocity.x > 0) return "+x";
  if (velocity.x < 0) return "-x";
  if (velocity.y > 0) return "+y";
  if (velocity.y < 0) return "-y";
  return "0";
}
