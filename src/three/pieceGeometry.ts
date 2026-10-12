import * as THREE from "three";
import { grooveCentrelines, surfaceHeight } from "@/lib/grooves";
import type { PieceKind } from "@/lib/pieces";
import { GROOVE_DEPTH } from "@/lib/space";

/**
 * Geometry for each piece kind, built once and shared.
 *
 * A piece is a unit block whose top surface is sampled on a fine grid from
 * the groove shape in lib/grooves, so grooves have smooth rounded bottoms.
 * The sides follow the top surface, so grooves show as notches where they
 * reach the edge. Pieces are built unrotated; the mesh is rotated to place
 * them. Three.js uses y up, so world (x, y, z) is built as (x, z, y).
 */

export interface PieceGeometry {
  /** The wooden block, with vertex colours darkening the grooves */
  solid: THREE.BufferGeometry;
  /** Outline: the block's edges and the rims of its grooves */
  outline: THREE.BufferGeometry;
}

/** Grid samples along each side of the top surface */
const RESOLUTION = 48;
/** How much darker the wood is at the bottom of a groove */
const GROOVE_SHADE = 0.3;

const cache = new Map<PieceKind, PieceGeometry>();

export function getPieceGeometry(kind: PieceKind): PieceGeometry {
  let geometry = cache.get(kind);
  if (!geometry) {
    geometry = buildPiece(kind);
    cache.set(kind, geometry);
  }
  return geometry;
}

function buildPiece(kind: PieceKind): PieceGeometry {
  const lines = grooveCentrelines(kind, 0);
  const n = lines.length === 0 ? 1 : RESOLUTION;
  const coord = (i: number) => -0.5 + i / n;

  const heights: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      heights.push(surfaceHeight(lines, { x: coord(i), y: coord(j) }));
    }
  }
  const h = (i: number, j: number) =>
    heights[
      Math.min(n, Math.max(0, j)) * (n + 1) + Math.min(n, Math.max(0, i))
    ];

  const builder = new MeshBuilder();

  // Top surface, with normals from the slope of the surface
  const top: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const slopeX = ((h(i + 1, j) - h(i - 1, j)) * n) / 2;
      const slopeY = ((h(i, j + 1) - h(i, j - 1)) * n) / 2;
      const normal = new THREE.Vector3(-slopeX, 1, -slopeY).normalize();
      const depth = (0.5 - h(i, j)) / GROOVE_DEPTH;
      top.push(
        builder.vertex(
          [coord(i), h(i, j), coord(j)],
          [normal.x, normal.y, normal.z],
          [i / n, j / n],
          1 - GROOVE_SHADE * depth,
        ),
      );
    }
  }
  const at = (i: number, j: number) => top[j * (n + 1) + i];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      builder.triangle(at(i, j), at(i, j + 1), at(i + 1, j));
      builder.triangle(at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
    }
  }

  // Sides, running up to the edge of the top surface
  const sides: {
    outward: [number, number, number];
    edge: [number, number][];
  }[] = [
    { outward: [1, 0, 0], edge: range(n).map((k) => [n, k]) },
    { outward: [-1, 0, 0], edge: range(n).map((k) => [0, k]) },
    { outward: [0, 0, 1], edge: range(n).map((k) => [k, n]) },
    { outward: [0, 0, -1], edge: range(n).map((k) => [k, 0]) },
  ];
  const outline: number[] = [];
  for (const { outward, edge } of sides) {
    const columns = edge.map(([i, j], k) => {
      const x = coord(i);
      const z = coord(j);
      const height = h(i, j);
      const along = k / n;
      return {
        bottom: builder.vertex([x, -0.5, z], outward, [along, 0], 1),
        top: builder.vertex([x, height, z], outward, [along, height + 0.5], 1),
        position: [x, height, z],
      };
    });
    for (let k = 1; k < columns.length; k++) {
      builder.quad(
        columns[k - 1].bottom,
        columns[k].bottom,
        columns[k].top,
        columns[k - 1].top,
        outward,
      );
      outline.push(...columns[k - 1].position, ...columns[k].position);
    }
  }

  // Bottom
  const down: [number, number, number] = [0, -1, 0];
  builder.quad(
    builder.vertex([-0.5, -0.5, -0.5], down, [0, 0], 1),
    builder.vertex([0.5, -0.5, -0.5], down, [1, 0], 1),
    builder.vertex([0.5, -0.5, 0.5], down, [1, 1], 1),
    builder.vertex([-0.5, -0.5, 0.5], down, [0, 1], 1),
    down,
  );

  // Outline: vertical corners, the bottom square and the groove rims
  for (const [x, z] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ]) {
    outline.push(x, -0.5, z, x, 0.5, z);
  }
  outline.push(
    ...[-0.5, -0.5, -0.5, 0.5, -0.5, -0.5],
    ...[0.5, -0.5, -0.5, 0.5, -0.5, 0.5],
    ...[0.5, -0.5, 0.5, -0.5, -0.5, 0.5],
    ...[-0.5, -0.5, 0.5, -0.5, -0.5, -0.5],
  );
  outline.push(...grooveRims(heights, n));

  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(outline, 3),
  );

  return { solid: builder.build(), outline: outlineGeometry };
}

function range(n: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => k);
}

/**
 * Line segments tracing where the grooves meet the flat top, found with
 * marching squares over the height samples
 */
function grooveRims(heights: number[], n: number): number[] {
  const level = 0.5 - 0.004;
  const lift = 0.003;
  const segments: number[] = [];
  const value = (i: number, j: number) => heights[j * (n + 1) + i];
  const coord = (i: number) => -0.5 + i / n;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Corners in order round the cell
      const corners: [number, number][] = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      const crossings: number[][] = [];
      for (let c = 0; c < 4; c++) {
        const [ai, aj] = corners[c];
        const [bi, bj] = corners[(c + 1) % 4];
        const a = value(ai, aj);
        const b = value(bi, bj);
        if (a < level !== b < level) {
          const t = (level - a) / (b - a);
          crossings.push([
            coord(ai + (bi - ai) * t),
            level + lift,
            coord(aj + (bj - aj) * t),
          ]);
        }
      }
      for (let c = 0; c + 1 < crossings.length; c += 2) {
        segments.push(...crossings[c], ...crossings[c + 1]);
      }
    }
  }
  return segments;
}

/** Collects vertices and triangles for an indexed BufferGeometry */
class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colours: number[] = [];
  private indices: number[] = [];
  private count = 0;

  vertex(
    position: number[],
    normal: number[],
    uv: number[],
    shade: number,
  ): number {
    this.positions.push(...position);
    this.normals.push(...normal);
    this.uvs.push(...uv);
    this.colours.push(shade, shade, shade);
    return this.count++;
  }

  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c);
  }

  /** Two triangles, wound so they face `outward` */
  quad(a: number, b: number, c: number, d: number, outward: number[]) {
    const p = (index: number) =>
      new THREE.Vector3().fromArray(this.positions, index * 3);
    const normal = new THREE.Vector3()
      .subVectors(p(b), p(a))
      .cross(new THREE.Vector3().subVectors(p(c), p(a)));
    if (normal.dot(new THREE.Vector3().fromArray(outward)) >= 0) {
      this.indices.push(a, b, c, a, c, d);
    } else {
      this.indices.push(a, c, b, a, d, c);
    }
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(this.normals, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(this.colours, 3),
    );
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}
