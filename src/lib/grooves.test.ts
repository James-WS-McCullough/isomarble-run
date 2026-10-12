import { describe, expect, it } from "vitest";
import {
  marbleHeightAt,
  nearestOnRoute,
  routeToExit,
  surfaceHeight,
} from "./grooves";
import { grooveCentrelines } from "./pieces";
import {
  FLAT_REST_HEIGHT,
  GROOVE_DEPTH,
  GROOVE_HALF_WIDTH,
  GROOVE_REST_HEIGHT,
} from "./space";

describe("groove shape", () => {
  const straight = grooveCentrelines("straight", 0);

  it("is deepest along the centreline and level with the top at the rim", () => {
    expect(surfaceHeight(straight, { x: 0.3, y: 0 })).toBeCloseTo(
      0.5 - GROOVE_DEPTH,
    );
    expect(surfaceHeight(straight, { x: 0, y: GROOVE_HALF_WIDTH })).toBeCloseTo(
      0.5,
    );
    expect(surfaceHeight(straight, { x: 0, y: 0.45 })).toBe(0.5);
  });

  it("curves smoothly up from the bottom to the rim", () => {
    const heights = [0, 0.06, 0.12, 0.18, 0.24].map((y) =>
      surfaceHeight(straight, { x: 0, y }),
    );
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it("follows the bend of a curve", () => {
    const curve = grooveCentrelines("curve", 0);
    // Halfway round the quarter circle about the (+x, +y) corner
    const mid = 0.5 - 0.5 / Math.SQRT2;
    expect(surfaceHeight(curve, { x: mid, y: mid })).toBeCloseTo(
      0.5 - GROOVE_DEPTH,
    );
    // The far corner is solid wood
    expect(surfaceHeight(curve, { x: -0.3, y: -0.3 })).toBe(0.5);
  });

  it("gives a catcher a wide round bowl with a groove leading out", () => {
    const catcher = grooveCentrelines("catcher", 0);
    const bottom = surfaceHeight(catcher, { x: 0, y: 0 });
    const side = surfaceHeight(catcher, { x: 0, y: 0.3 });
    expect(bottom).toBeCloseTo(0.5 - GROOVE_DEPTH);
    // Partway up the side of the bowl, away from the exit groove
    expect(side).toBeGreaterThan(bottom);
    expect(side).toBeLessThan(0.5);
    expect(surfaceHeight(catcher, { x: 0, y: 0.47 })).toBe(0.5);
    // The exit groove runs all the way to the +x side
    expect(surfaceHeight(catcher, { x: 0.49, y: 0 })).toBeCloseTo(
      0.5 - GROOVE_DEPTH,
    );
  });

  it("sits a marble in the bottom of the groove, or on top of a rail", () => {
    expect(marbleHeightAt("straight", 0, { x: 0, y: 0 })).toBeCloseTo(
      GROOVE_REST_HEIGHT,
    );
    expect(marbleHeightAt("straight", 0, { x: 0, y: 0.4 })).toBeCloseTo(
      FLAT_REST_HEIGHT,
    );
    expect(marbleHeightAt("block", 0, { x: 0, y: 0 })).toBe(FLAT_REST_HEIGHT);
  });
});

describe("routes", () => {
  it("leaves a curve along its arc", () => {
    const route = routeToExit("curve", 0, "+x");
    expect(route[0].x).toBeCloseTo(0);
    expect(route[0].y).toBeCloseTo(0.5);
    expect(route[route.length - 1].x).toBeCloseTo(0.5);
    expect(route[route.length - 1].y).toBeCloseTo(0);
  });

  it("joins a route at the nearest point", () => {
    const { point, next } = nearestOnRoute(
      [
        { x: -0.5, y: 0 },
        { x: 0.5, y: 0 },
      ],
      { x: 0.2, y: 0.3 },
    );
    expect(point.x).toBeCloseTo(0.2);
    expect(point.y).toBeCloseTo(0);
    expect(next).toBe(1);
  });
});
