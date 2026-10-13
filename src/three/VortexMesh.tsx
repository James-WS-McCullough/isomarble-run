"use client";

import * as THREE from "three";
import { VORTEX, vortexSurface } from "@/lib/vortex";
import { getPieceMaterial, type PieceLook } from "./materials";
import type { ModelProps } from "./PieceMesh";

const { RIM_RADIUS, RIM_HEIGHT, HOLE_RADIUS, HOLE_HEIGHT } = VORTEX;
/** Half the width of the 3 by 3 tiles it stands over */
const HALF = 1.5;

/** Give a geometry plain white vertex colours, for the piece materials */
function plainColours(geometry: THREE.BufferGeometry) {
  const count = geometry.attributes.position.count;
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(new Array(count * 3).fill(1), 3),
  );
  return geometry;
}

const coneGeometry = plainColours(
  new THREE.LatheGeometry(
    [
      new THREE.Vector2(HOLE_RADIUS, HOLE_HEIGHT),
      new THREE.Vector2(RIM_RADIUS, RIM_HEIGHT),
    ],
    72,
  ),
);
const rimGeometry = new THREE.TorusGeometry(RIM_RADIUS, 0.04, 8, 72);
rimGeometry.rotateX(Math.PI / 2);
const spoutGeometry = new THREE.CylinderGeometry(
  HOLE_RADIUS + 0.02,
  HOLE_RADIUS + 0.02,
  HOLE_HEIGHT + 0.5,
  24,
  1,
  true,
);
spoutGeometry.translate(0, (HOLE_HEIGHT - 0.5) / 2, 0);
const barGeometry = new THREE.BoxGeometry(2 * HALF, 0.08, 0.08);
const legGeometry = new THREE.BoxGeometry(0.08, RIM_HEIGHT + 0.5, 0.08);
legGeometry.translate(0, (RIM_HEIGHT - 0.5) / 2, 0);

/** A spiral line traced on the cone, from the rim to the hole */
const spiralGeometry = (() => {
  const points: THREE.Vector3[] = [];
  const turns = 3;
  for (let i = 0; i <= 240; i++) {
    const t = i / 240;
    const r = RIM_RADIUS - 0.08 - (RIM_RADIUS - 0.08 - HOLE_RADIUS) * t;
    const angle = t * turns * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        r * Math.cos(angle),
        vortexSurface(r) + 0.006,
        r * Math.sin(angle),
      ),
    );
  }
  // Drawn as line segments, so each point ends one and starts the next
  const pairs = points.slice(1).flatMap((point, i) => [points[i], point]);
  return new THREE.BufferGeometry().setFromPoints(pairs);
})();

const frameMaterial = new THREE.MeshStandardMaterial({
  color: "#c99c66",
  roughness: 0.7,
});
const spoutMaterial = new THREE.MeshStandardMaterial({
  color: "#2a1d14",
  roughness: 0.9,
  side: THREE.DoubleSide,
});
const spiralMaterial = new THREE.LineBasicMaterial({ color: "#8b5e34" });

const coneMaterials = new Map<PieceLook, THREE.Material>();

/** The piece's wood, showing both faces of the thin cone */
function coneMaterial(look: PieceLook): THREE.Material {
  let material = coneMaterials.get(look);
  if (!material) {
    material = getPieceMaterial(look).clone();
    material.side = THREE.DoubleSide;
    coneMaterials.set(look, material);
  }
  return material;
}

/**
 * A wide wooden cone over 3 by 3 tiles, with a spout under the hole in the
 * middle, standing in a square frame on four legs
 */
export function Vortex({ look, raycast }: ModelProps) {
  return (
    <>
      <mesh
        geometry={coneGeometry}
        material={coneMaterial(look)}
        raycast={raycast}
      />
      <lineSegments
        geometry={spiralGeometry}
        material={spiralMaterial}
        raycast={() => null}
      />
      <mesh
        geometry={rimGeometry}
        material={frameMaterial}
        position={[0, RIM_HEIGHT, 0]}
        raycast={raycast}
      />
      <mesh
        geometry={spoutGeometry}
        material={spoutMaterial}
        raycast={raycast}
      />
      {[0, 1, 2, 3].map((side) => (
        <group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
          <mesh
            geometry={barGeometry}
            material={frameMaterial}
            position={[0, RIM_HEIGHT - 0.04, HALF - 0.04]}
            raycast={raycast}
          />
          <mesh
            geometry={legGeometry}
            material={frameMaterial}
            position={[HALF - 0.04, 0, HALF - 0.04]}
            raycast={raycast}
          />
        </group>
      ))}
    </>
  );
}
