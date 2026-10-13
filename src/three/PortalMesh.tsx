"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { GROOVE_REST_HEIGHT } from "@/lib/space";
import { getPieceMaterial, OUTLINE_MATERIAL } from "./materials";
import type { ModelProps } from "./PieceMesh";
import { getPieceGeometry } from "./pieceGeometry";

/** The ring stands across the track, round where the marble rolls */
const RING = { RADIUS: 0.3, TUBE: 0.045 };

const ringGeometry = new THREE.TorusGeometry(RING.RADIUS, RING.TUBE, 12, 48);
// Standing up across the track, which runs along x
ringGeometry.rotateY(Math.PI / 2);
const membraneGeometry = new THREE.CircleGeometry(RING.RADIUS - 0.01, 40);
membraneGeometry.rotateY(Math.PI / 2);

/** Each pair of portals glows its own colour; a lone portal is grey */
export function portalColour(pair: number | null | undefined): THREE.Color {
  if (pair === null || pair === undefined) return new THREE.Color("#9ca3af");
  return new THREE.Color().setHSL(
    ((280 + pair * 137.5) % 360) / 360,
    0.85,
    0.6,
  );
}

const materials = new Map<string, [THREE.Material, THREE.Material]>();

function portalMaterials(pair: number | null | undefined) {
  const key = String(pair ?? "none");
  let pairMaterials = materials.get(key);
  if (!pairMaterials) {
    const colour = portalColour(pair);
    const lit = pair !== null && pair !== undefined;
    pairMaterials = [
      new THREE.MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: lit ? 0.8 : 0,
        roughness: 0.3,
        metalness: 0.3,
      }),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: lit ? 0.35 : 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ];
    materials.set(key, pairMaterials);
  }
  return pairMaterials;
}

/** A straight track with a glowing ring standing over the middle */
export function Portal({ pair, look, raycast }: ModelProps) {
  const block = getPieceGeometry("portal");
  const [ring, membrane] = portalMaterials(pair);
  const shimmer = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (shimmer.current) {
      const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3);
      shimmer.current.scale.set(1, pulse, pulse);
    }
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
      <group position={[0, GROOVE_REST_HEIGHT, 0]}>
        <mesh geometry={ringGeometry} material={ring} raycast={raycast} />
        <mesh
          ref={shimmer}
          geometry={membraneGeometry}
          material={membrane}
          raycast={() => null}
        />
      </group>
    </>
  );
}
