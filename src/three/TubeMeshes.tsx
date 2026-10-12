"use client";

import * as THREE from "three";
import { FUNNEL, isUpsideDown } from "@/lib/funnel";
import { GROOVE_REST_HEIGHT } from "@/lib/space";
import type { PieceLook } from "./materials";
import type { ModelProps } from "./PieceMesh";

/**
 * Glass tubes, outlets and funnels. They're built unrotated with an
 * outlet's spout facing +x; the parent group rotates them.
 */

const TUBE_RADIUS = 0.3;
const SPOUT_RADIUS = 0.26;

const tubeGeometry = new THREE.CylinderGeometry(
  TUBE_RADIUS,
  TUBE_RADIUS,
  1,
  32,
  1,
  true,
);
const collarGeometry = new THREE.TorusGeometry(
  TUBE_RADIUS + 0.01,
  0.035,
  8,
  32,
);
collarGeometry.rotateX(Math.PI / 2);

// The outlet: a tube up to the spout, a dome on top and the spout itself
const elbowHeight = GROOVE_REST_HEIGHT;
const outletTubeGeometry = new THREE.CylinderGeometry(
  TUBE_RADIUS,
  TUBE_RADIUS,
  0.5 + elbowHeight,
  32,
  1,
  true,
);
outletTubeGeometry.translate(0, (elbowHeight - 0.5) / 2, 0);
const domeGeometry = new THREE.SphereGeometry(
  TUBE_RADIUS,
  32,
  12,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2,
);
domeGeometry.translate(0, elbowHeight, 0);
const spoutGeometry = new THREE.CylinderGeometry(
  SPOUT_RADIUS,
  SPOUT_RADIUS,
  0.5,
  24,
  1,
  true,
);
spoutGeometry.rotateZ(Math.PI / 2);
spoutGeometry.translate(0.25, elbowHeight, 0);

const glassCache = new Map<PieceLook, THREE.Material>();

/** Plain wood for the round collars, which have no vertex colours */
const collarMaterial = new THREE.MeshStandardMaterial({
  color: "#c99c66",
  roughness: 0.7,
});

function glass(look: PieceLook): THREE.Material {
  let material = glassCache.get(look);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color: look === "blocked" ? "#ff8080" : "#e3f4ff",
      transparent: true,
      opacity: look === "ghost" ? 0.15 : look === "highlight" ? 0.35 : 0.22,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: look === "highlight" ? "#ffd28a" : "#000000",
      emissiveIntensity: 0.3,
    });
    glassCache.set(look, material);
  }
  return material;
}

/** A straight glass tube with wooden collars at each end */
export function GlassTube({ look, raycast }: ModelProps) {
  const wood = collarMaterial;
  return (
    <>
      <mesh geometry={tubeGeometry} material={glass(look)} raycast={raycast} />
      <mesh
        geometry={collarGeometry}
        material={wood}
        position={[0, -0.46, 0]}
        raycast={raycast}
      />
      <mesh
        geometry={collarGeometry}
        material={wood}
        position={[0, 0.46, 0]}
        raycast={raycast}
      />
    </>
  );
}

/** A glass tube that bends out through a spout on its +x side */
export function GlassOutlet({ look, raycast }: ModelProps) {
  const wood = collarMaterial;
  return (
    <>
      <mesh
        geometry={outletTubeGeometry}
        material={glass(look)}
        raycast={raycast}
      />
      <mesh geometry={domeGeometry} material={glass(look)} raycast={raycast} />
      <mesh geometry={spoutGeometry} material={glass(look)} raycast={raycast} />
      <mesh
        geometry={collarGeometry}
        material={wood}
        position={[0, -0.46, 0]}
        raycast={raycast}
      />
    </>
  );
}

// The funnel: a cone from the mouth down to the neck, then a short pipe
const coneGeometry = new THREE.LatheGeometry(
  [
    new THREE.Vector2(FUNNEL.NECK_RADIUS, FUNNEL.NECK_HEIGHT),
    new THREE.Vector2(FUNNEL.MOUTH_RADIUS, 0.5),
  ],
  40,
);
const pipeGeometry = new THREE.CylinderGeometry(
  FUNNEL.NECK_RADIUS,
  FUNNEL.NECK_RADIUS,
  0.5 + FUNNEL.NECK_HEIGHT,
  32,
  1,
  true,
);
pipeGeometry.translate(0, (FUNNEL.NECK_HEIGHT - 0.5) / 2, 0);
const rimGeometry = new THREE.TorusGeometry(FUNNEL.MOUTH_RADIUS, 0.03, 8, 40);
rimGeometry.rotateX(Math.PI / 2);

/** A wide glass funnel with a wooden rim, narrowing into a tube */
export function GlassFunnel({ rotation, look, raycast }: ModelProps) {
  // Turned an odd number of times, it's upside down
  const upsideDown = isUpsideDown({ kind: "funnel", rotation });
  return (
    <group rotation={[upsideDown ? Math.PI : 0, 0, 0]}>
      <mesh geometry={coneGeometry} material={glass(look)} raycast={raycast} />
      <mesh geometry={pipeGeometry} material={glass(look)} raycast={raycast} />
      <mesh
        geometry={rimGeometry}
        material={collarMaterial}
        position={[0, 0.49, 0]}
        raycast={raycast}
      />
      <mesh
        geometry={collarGeometry}
        material={collarMaterial}
        position={[0, -0.46, 0]}
        raycast={raycast}
      />
    </group>
  );
}
