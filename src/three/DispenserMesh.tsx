"use client";

import * as THREE from "three";
import { getPieceMaterial, OUTLINE_MATERIAL } from "./materials";
import type { ModelProps } from "./PieceMesh";
import { getPieceGeometry } from "./pieceGeometry";

/** The glass hopper on top, standing over the start of the groove */
const HOPPER = { RADIUS: 0.27, HEIGHT: 0.6, X: -0.14 };

const hopperGeometry = new THREE.CylinderGeometry(
  HOPPER.RADIUS,
  HOPPER.RADIUS * 0.85,
  HOPPER.HEIGHT,
  32,
  1,
  true,
);
hopperGeometry.translate(HOPPER.X, 0.5 + HOPPER.HEIGHT / 2, 0);
const rimGeometry = new THREE.TorusGeometry(HOPPER.RADIUS, 0.03, 8, 32);
rimGeometry.rotateX(Math.PI / 2);
const ballGeometry = new THREE.SphereGeometry(0.11, 16, 12);

const glassMaterial = new THREE.MeshStandardMaterial({
  color: "#e3f4ff",
  transparent: true,
  opacity: 0.25,
  roughness: 0.05,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const rimMaterial = new THREE.MeshStandardMaterial({
  color: "#c99c66",
  roughness: 0.7,
});

/** Marbles waiting in the hopper: [x, height, z, colour] */
const WAITING: [number, number, number, string][] = [
  [-0.06, 0.62, 0.08, "#e0533d"],
  [-0.22, 0.62, -0.06, "#3b82f6"],
  [-0.08, 0.62, -0.12, "#f2c94c"],
  [-0.2, 0.83, 0.07, "#22a36b"],
  [-0.1, 0.83, -0.02, "#a855f7"],
];
const waitingMaterials = WAITING.map(
  ([, , , colour]) =>
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.15 }),
);

/** A wooden block with a groove out of one side, under a hopper of marbles */
export function Dispenser({ look, raycast }: ModelProps) {
  const block = getPieceGeometry("dispenser");
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
      {WAITING.map(([x, y, z], i) => (
        <mesh
          key={`${x},${y},${z}`}
          geometry={ballGeometry}
          material={waitingMaterials[i]}
          position={[x, y, z]}
          raycast={() => null}
        />
      ))}
      <mesh
        geometry={hopperGeometry}
        material={glassMaterial}
        raycast={raycast}
      />
      <mesh
        geometry={rimGeometry}
        material={rimMaterial}
        position={[HOPPER.X, 0.5 + HOPPER.HEIGHT, 0]}
        raycast={raycast}
      />
    </>
  );
}
