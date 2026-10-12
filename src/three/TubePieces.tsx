"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { FUNNEL } from "@/lib/funnel";
import { FAN_WELL } from "@/lib/grooves";
import { GROOVE_REST_HEIGHT } from "@/lib/space";
import {
  getPieceMaterial,
  OUTLINE_MATERIAL,
  type PieceLook,
} from "./materials";
import { getPieceGeometry } from "./pieceGeometry";

/**
 * Tubes, outlets, funnels and fans. They're built unrotated with their opening
 * (spout or intake) facing +x; the parent group rotates them.
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

interface TubeProps {
  hue?: number;
  look: PieceLook;
  raycast?: () => null;
  /** For funnels: mouth down, to catch marbles blown up from below */
  upsideDown?: boolean;
}

/** A straight glass tube with wooden collars at each end */
export function GlassTube({ look, raycast }: TubeProps) {
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
export function GlassOutlet({ look, raycast }: TubeProps) {
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
export function GlassFunnel({ look, raycast, upsideDown }: TubeProps) {
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

// The fan sits in the well where the crossroads' grooves meet
const wellFloor = 0.5 - FAN_WELL.DEPTH;
const floorGeometry = new THREE.CircleGeometry(FAN_WELL.RADIUS, 32);
floorGeometry.rotateX(-Math.PI / 2);
const bladeGeometry = new THREE.BoxGeometry(0.22, 0.012, 0.08);
bladeGeometry.translate(0.13, 0, 0);
const hubGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.05, 16);
// A guard over the blades: a ring and two crossed bars
const guardRingGeometry = new THREE.TorusGeometry(
  FAN_WELL.RADIUS - 0.03,
  0.012,
  6,
  32,
);
guardRingGeometry.rotateX(Math.PI / 2);
const guardInnerGeometry = new THREE.TorusGeometry(0.13, 0.01, 6, 24);
guardInnerGeometry.rotateX(Math.PI / 2);
const guardBarGeometry = new THREE.BoxGeometry(
  2 * (FAN_WELL.RADIUS - 0.03),
  0.014,
  0.02,
);
const darkMaterial = new THREE.MeshStandardMaterial({
  color: "#2a1d14",
  roughness: 0.9,
});
const bladeMaterial = new THREE.MeshStandardMaterial({
  color: "#d8d2c8",
  roughness: 0.35,
  metalness: 0.5,
});
const brassMaterial = new THREE.MeshStandardMaterial({
  color: "#c9a25e",
  roughness: 0.35,
  metalness: 0.7,
});

/** A wooden crossroads with a spinning fan set into the middle */
export function Fan({ hue, look, raycast }: TubeProps) {
  const block = getPieceGeometry("fan");
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.y += delta * 14;
  });

  return (
    <>
      <mesh
        geometry={block.solid}
        material={getPieceMaterial(hue, look)}
        raycast={raycast}
      />
      <lineSegments
        geometry={block.outline}
        material={OUTLINE_MATERIAL}
        raycast={() => null}
      />
      <mesh
        geometry={floorGeometry}
        material={darkMaterial}
        position={[0, wellFloor + 0.003, 0]}
        raycast={() => null}
      />
      <group ref={blades} position={[0, wellFloor + 0.05, 0]}>
        <mesh
          geometry={hubGeometry}
          material={brassMaterial}
          raycast={() => null}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            geometry={bladeGeometry}
            material={bladeMaterial}
            // Pitched along their length, like a propeller
            rotation={[0.35, (i * Math.PI * 2) / 5, 0, "YXZ"]}
            raycast={() => null}
          />
        ))}
      </group>
      <group position={[0, wellFloor + 0.1, 0]}>
        <mesh
          geometry={guardRingGeometry}
          material={brassMaterial}
          raycast={() => null}
        />
        <mesh
          geometry={guardInnerGeometry}
          material={brassMaterial}
          raycast={() => null}
        />
        {[0, 1].map((i) => (
          <mesh
            key={i}
            geometry={guardBarGeometry}
            material={brassMaterial}
            rotation={[0, (i * Math.PI) / 2, 0]}
            raycast={() => null}
          />
        ))}
      </group>
    </>
  );
}
