import * as THREE from "three";
import type { PieceKind } from "@/lib/pieces";
import { GROOVE_DEPTH, GROOVE_HALF_WIDTH } from "@/lib/space";

/**
 * Geometry for each piece kind, built once and shared.
 *
 * A grooved piece is a base box topped with "rails": raised wood around a
 * groove. Rails are drawn as 2D shapes on the top face (x right, y towards
 * +y in world space) and extruded upwards. Pieces are built unrotated;
 * the mesh is rotated to place them.
 */

const W = GROOVE_HALF_WIDTH;
const HALF = 0.5;

export interface PieceGeometry {
  base: THREE.BufferGeometry;
  rails: THREE.BufferGeometry | null;
}

function rect(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  return shape;
}

function railShapes(kind: PieceKind): THREE.Shape[] {
  switch (kind) {
    case "straight":
      return [rect(-HALF, W, HALF, HALF), rect(-HALF, -HALF, HALF, -W)];

    case "cross":
      return [
        rect(W, W, HALF, HALF),
        rect(-HALF, W, -W, HALF),
        rect(-HALF, -HALF, -W, -W),
        rect(W, -HALF, HALF, -W),
      ];

    case "tee":
      return [
        rect(-HALF, -HALF, -W, HALF),
        rect(W, W, HALF, HALF),
        rect(W, -HALF, HALF, -W),
      ];

    case "curve": {
      // The groove bends around the (+x, +y) corner
      const inner = new THREE.Shape();
      inner.moveTo(HALF, HALF);
      inner.lineTo(HALF - (HALF - W), HALF);
      inner.absarc(HALF, HALF, HALF - W, Math.PI, Math.PI * 1.5, false);
      inner.closePath();

      const outer = new THREE.Shape();
      outer.moveTo(HALF, -HALF);
      outer.lineTo(HALF, HALF - (HALF + W));
      outer.absarc(HALF, HALF, HALF + W, Math.PI * 1.5, Math.PI, true);
      outer.lineTo(-HALF, HALF);
      outer.lineTo(-HALF, -HALF);
      outer.closePath();
      return [inner, outer];
    }

    case "catcher": {
      // A dead-end groove from the middle out to the +x side
      const shape = new THREE.Shape();
      shape.moveTo(HALF, W);
      shape.lineTo(HALF, HALF);
      shape.lineTo(-HALF, HALF);
      shape.lineTo(-HALF, -HALF);
      shape.lineTo(HALF, -HALF);
      shape.lineTo(HALF, -W);
      shape.lineTo(0, -W);
      shape.absarc(0, 0, W, -Math.PI / 2, Math.PI / 2, true);
      shape.closePath();
      return [shape];
    }

    case "block":
      return [];
  }
}

const cache = new Map<PieceKind, PieceGeometry>();

export function getPieceGeometry(kind: PieceKind): PieceGeometry {
  const cached = cache.get(kind);
  if (cached) return cached;

  let geometry: PieceGeometry;
  if (kind === "block") {
    geometry = { base: new THREE.BoxGeometry(1, 1, 1), rails: null };
  } else {
    const baseHeight = 1 - GROOVE_DEPTH;
    const base = new THREE.BoxGeometry(1, baseHeight, 1);
    base.translate(0, -0.5 + baseHeight / 2, 0);

    const rails = new THREE.ExtrudeGeometry(railShapes(kind), {
      depth: GROOVE_DEPTH,
      bevelEnabled: false,
      curveSegments: 10,
    });
    // Lay the shapes flat: shape y becomes world +y (three.js +z), and the
    // extrusion runs up from the groove floor to the top of the piece
    rails.rotateX(Math.PI / 2);
    rails.translate(0, HALF, 0);

    geometry = { base, rails };
  }

  cache.set(kind, geometry);
  return geometry;
}
