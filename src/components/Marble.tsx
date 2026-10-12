import { assetPath } from "@/lib/assets";
import type { MarbleStateType, MomentumDirection } from "@/lib/block-types";
import { depthZIndex, type ScreenPosition } from "@/lib/isometric";

interface MarbleProps {
  /** Screen position of the grid cell the marble is on */
  position: ScreenPosition;
  state?: MarbleStateType;
  momentum?: MomentumDirection;
  behindCoordinates?: { x: number; y: number };
  /** Skip the movement animation, e.g. when wrapping to the top of the grid */
  warped?: boolean;
  isAutoMode?: boolean;
  className?: string;
}

const MARBLE_SIZE = 50;
const MARBLE_BASE = assetPath("/sprites/marble/MarbleBase.png");
const MARBLE_HIGHLIGHT = assetPath("/sprites/marble/MarbleHilight.png");

/**
 * A marble: a base sprite that spins while rolling, under a fixed highlight
 */
export function Marble({
  position,
  state = "falling",
  momentum,
  behindCoordinates,
  warped = false,
  isAutoMode = false,
  className = "",
}: MarbleProps) {
  // Marbles moving right on screen (+x, -y) spin clockwise
  const spinsClockwise = momentum === "+x" || momentum === "-y";

  // Marbles behind the track are drawn just behind the block they fell from
  const zIndex =
    state === "behind"
      ? behindCoordinates
        ? depthZIndex(behindCoordinates) - 1
        : 1
      : 200;

  const moveDuration = isAutoMode ? "150ms linear" : "300ms ease-out";

  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        left: position.x - MARBLE_SIZE / 2,
        top: position.y - 50 - MARBLE_SIZE / 2, // Sit on top of the block
        width: MARBLE_SIZE,
        height: MARBLE_SIZE,
        zIndex,
        transition: warped
          ? "none"
          : `left ${moveDuration}, top ${moveDuration}`,
      }}
    >
      <img
        src={MARBLE_BASE}
        alt=""
        className="absolute inset-0 size-full"
        style={{
          imageRendering: "pixelated",
          animation:
            state === "rolling"
              ? `marble-spin ${isAutoMode ? 1 : 1.5}s linear infinite ${
                  spinsClockwise ? "normal" : "reverse"
                }`
              : undefined,
        }}
      />
      <img
        src={MARBLE_HIGHLIGHT}
        alt=""
        className="absolute inset-0 size-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
