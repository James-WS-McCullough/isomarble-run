"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { FAN_WELL } from "@/lib/pieces";
import { getPieceMaterial, OUTLINE_MATERIAL } from "./materials";
import type { ModelProps } from "./PieceMesh";
import { getPieceGeometry } from "./pieceGeometry";

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
export function Fan({ look, raycast }: ModelProps) {
  const block = getPieceGeometry("fan");
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.y += delta * 14;
  });

  return (
    <>
      <mesh
        geometry={block.solid}
        material={getPieceMaterial(look)}
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
