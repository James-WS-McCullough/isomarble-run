"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScreenPosition {
  x: number;
  y: number;
}

interface MarbleProps {
  position: ScreenPosition;
  rotation?: number;
  state?: "rolling" | "falling" | "behind";
  behindCoordinates?: { x: number; y: number };
  className?: string;
  momentum?: string;
  isAutoMode?: boolean;
}

/**
 * Component for rendering a marble with separate clockwise/counterclockwise rolling sprites
 */
export const Marble: React.FC<MarbleProps> = ({
  position,
  rotation = 0,
  state = "falling",
  behindCoordinates,
  className = "",
  momentum,
  isAutoMode = false,
}) => {
  const [clockwiseRotation, setClockwiseRotation] = useState(0);
  const [counterclockwiseRotation, setCounterclockwiseRotation] = useState(0);
  const [rollingDirection, setRollingDirection] = useState<
    "clockwise" | "counterclockwise" | "none"
  >("none");
  const [prevPosition, setPrevPosition] = useState(position);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Use the actual position directly
  const finalScreenPos = {
    x: position.x,
    y: position.y - 50, // Raise marble 50px above the surface
  };

  // Calculate z-index based on state
  const zIndex =
    state === "behind" && behindCoordinates !== undefined
      ? 100 + (behindCoordinates.x + behindCoordinates.y) - 1
      : state === "behind"
      ? 1
      : 200;

  const marbleSize = 50;

  // Determine rolling direction based on movement
  useEffect(() => {
    if (state === "rolling") {
      const deltaX = position.x - prevPosition.x;
      const deltaY = position.y - prevPosition.y;

      // Determine rolling direction based on movement vector
      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        if (deltaX < 0 || deltaY > 0) {
          // Moving left or down-left: counterclockwise
          setRollingDirection("counterclockwise");
        } else {
          // Moving right or up-right: clockwise
          setRollingDirection("clockwise");
        }
      } else if (momentum) {
        // Fallback to momentum when no clear movement
        if (momentum === "+Y" || momentum === "-X") {
          setRollingDirection("counterclockwise");
        } else if (momentum === "-Y" || momentum === "+X") {
          setRollingDirection("clockwise");
        }
      }
    } else {
      setRollingDirection("none");
    }

    setPrevPosition(position);
  }, [position.x, position.y, state, momentum]);

  // Animate both rotations continuously
  useEffect(() => {
    if (state === "rolling") {
      const animate = () => {
        const now = Date.now();
        const deltaTime = now - lastUpdateRef.current;
        lastUpdateRef.current = now;

        // Smooth, steady rotation speed (degrees per millisecond)
        const rotationSpeed = isAutoMode ? 0.36 : 0.24; // 360°/second in auto, 240°/second manual

        // Update both rotations continuously
        setClockwiseRotation((prev) => prev + rotationSpeed * deltaTime);
        setCounterclockwiseRotation((prev) => prev - rotationSpeed * deltaTime);

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Stop animation when not rolling
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, isAutoMode]);

  const transitionClasses = isAutoMode
    ? "transition-all duration-150 ease-linear"
    : "transition-all duration-300 ease-out";
  const baseStyle = {
    left: `${finalScreenPos.x - marbleSize / 2}px`,
    top: `${finalScreenPos.y - marbleSize / 2}px`,
    width: `${marbleSize}px`,
    height: `${marbleSize}px`,
    minWidth: `${marbleSize}px`,
    minHeight: `${marbleSize}px`,
    imageRendering: "pixelated" as const,
    zIndex: zIndex,
    position: "absolute" as const,
    boxSizing: "border-box" as const,
  };

  return (
    <>
      {/* Clockwise rolling marble - only visible when rolling clockwise */}
      <img
        src="/sprites/marble/MarbleBase.png"
        alt="Marble base clockwise"
        className={`absolute pointer-events-none ${transitionClasses} ${className}`}
        style={{
          ...baseStyle,
          transform: `rotate(${clockwiseRotation}deg)`,
          opacity:
            state === "rolling" && rollingDirection === "clockwise" ? 1 : 0,
          transition: `opacity 0.1s ease, ${transitionClasses}`,
        }}
      />

      {/* Counterclockwise rolling marble - only visible when rolling counterclockwise */}
      <img
        src="/sprites/marble/MarbleBase.png"
        alt="Marble base counterclockwise"
        className={`absolute pointer-events-none ${transitionClasses} ${className}`}
        style={{
          ...baseStyle,
          transform: `rotate(${counterclockwiseRotation}deg)`,
          opacity:
            state === "rolling" && rollingDirection === "counterclockwise"
              ? 1
              : 0,
          transition: `opacity 0.1s ease, ${transitionClasses}`,
        }}
      />

      {/* Static marble - visible when falling or behind */}
      <img
        src="/sprites/marble/MarbleBase.png"
        alt="Marble base static"
        className={`absolute pointer-events-none ${transitionClasses} ${className}`}
        style={{
          ...baseStyle,
          transform: "none",
          opacity: state !== "rolling" ? 1 : 0,
          transition: `opacity 0.1s ease, ${transitionClasses}`,
        }}
      />

      {/* Marble highlight - ALWAYS visible, NEVER rotates */}
      <img
        src="/sprites/marble/MarbleHilight.png"
        alt="Marble highlight"
        className={`absolute pointer-events-none ${transitionClasses} ${className}`}
        style={{
          left: `${finalScreenPos.x - marbleSize / 2}px`,
          top: `${finalScreenPos.y - marbleSize / 2}px`,
          width: `${marbleSize}px`,
          height: `${marbleSize}px`,
          minWidth: `${marbleSize}px`,
          minHeight: `${marbleSize}px`,
          imageRendering: "pixelated",
          zIndex: zIndex + 1,
          position: "absolute",
          boxSizing: "border-box",
          transform: "none", // Highlight overlay NEVER rotates
        }}
      />
    </>
  );
};
