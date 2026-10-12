"use client";

import { useFrame } from "@react-three/fiber";
import { useContext, useRef } from "react";
import * as THREE from "three";
import { SEESAW } from "@/lib/seesaw";
import { getPieceMaterial, OUTLINE_MATERIAL } from "./materials";
import type { ModelProps } from "./PieceMesh";
import { getPieceGeometry } from "./pieceGeometry";
import { SimulationContext } from "./SimulationContext";

const baseGeometry = new THREE.BoxGeometry(0.86, 0.36, 0.86);
baseGeometry.translate(0, -0.32, 0);
// Piece materials use vertex colours (for grooves), so give the base plain white ones
baseGeometry.setAttribute(
  "color",
  new THREE.Float32BufferAttribute(
    new Array(baseGeometry.attributes.position.count * 3).fill(1),
    3,
  ),
);
const postGeometry = new THREE.BoxGeometry(0.14, 0.2, 0.3);
postGeometry.translate(0, -0.06, 0);
// The beam reaches from the stand to a cup over the tile on either side
const beamGeometry = new THREE.BoxGeometry(
  2 * SEESAW.CUP_OFFSET + 0.2,
  0.06,
  0.16,
);

// A cup: tapered sides and a bottom, sitting on the beam
const cupGeometry = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.17, 0),
    new THREE.Vector2(0.3, 0.2),
    new THREE.Vector2(0.28, 0.2),
    new THREE.Vector2(0.155, 0.02),
    new THREE.Vector2(0, 0.02),
  ],
  24,
);
cupGeometry.computeVertexNormals();

const woodMaterial = new THREE.MeshStandardMaterial({
  color: "#d9a86c",
  roughness: 0.75,
});
const cupMaterial = new THREE.MeshStandardMaterial({
  color: "#b9834d",
  roughness: 0.6,
  side: THREE.DoubleSide,
});

/**
 * A cup seesaw, built along +x: a stand in the middle tile and a cup over
 * the tile at each end. It tips to follow the simulation.
 */
export function Seesaw({ pieceId, hue, look, raycast }: ModelProps) {
  const simulation = useContext(SimulationContext);
  const beam = useRef<THREE.Group>(null);
  const block = getPieceGeometry("block");
  const base = getPieceMaterial(hue, look);

  useFrame(() => {
    if (!beam.current) return;
    const tilt =
      simulation && pieceId ? simulation.seesawTilt(pieceId) : SEESAW.TILT;
    // Positive tilt lowers the +x end
    beam.current.rotation.z = -tilt;
  });

  return (
    <>
      <mesh geometry={baseGeometry} material={base} raycast={raycast} />
      <lineSegments
        geometry={block.outline}
        material={OUTLINE_MATERIAL}
        scale={[0.86, 0.36, 0.86]}
        position={[0, -0.32, 0]}
        raycast={() => null}
      />
      <mesh geometry={postGeometry} material={woodMaterial} raycast={raycast} />
      <group ref={beam} position={[0, SEESAW.PIVOT_HEIGHT, 0]}>
        <mesh
          geometry={beamGeometry}
          material={woodMaterial}
          raycast={raycast}
        />
        {[1, -1].map((side) => (
          <mesh
            key={side}
            geometry={cupGeometry}
            material={cupMaterial}
            position={[side * SEESAW.CUP_OFFSET, 0.03, 0]}
            raycast={raycast}
          />
        ))}
      </group>
    </>
  );
}
