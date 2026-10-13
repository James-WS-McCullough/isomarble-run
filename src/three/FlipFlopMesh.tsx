"use client";

import { useFrame } from "@react-three/fiber";
import { useContext, useRef } from "react";
import * as THREE from "three";
import { GROOVE_DEPTH } from "@/lib/space";
import { getPieceMaterial, OUTLINE_MATERIAL } from "./materials";
import type { ModelProps } from "./PieceMesh";
import { getPieceGeometry } from "./pieceGeometry";
import { SimulationContext } from "./SimulationContext";

/**
 * The flipper is a T on a pin where the branches meet. Its leg points up
 * the stem, tilted to one side so it steers marbles into the other branch;
 * its top bar's arms reach into the branches. A marble rolling out down a
 * branch pushes that arm and rocks the T over.
 *
 * How far the leg tilts from straight up the stem (radians, towards +y
 * when sending marbles down -y)
 */
const TILT = 0.4;
/** How fast the T rocks over (radians per second) */
const SWING_SPEED = 6;

const legGeometry = new THREE.BoxGeometry(0.3, 0.16, 0.045);
legGeometry.translate(0.15, 0.08, 0);
// The top bar runs across the piece: its y, which is three.js z
const barGeometry = new THREE.BoxGeometry(0.045, 0.16, 0.56);
barGeometry.translate(0, 0.08, 0);
const pinGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16);
pinGeometry.translate(0, 0.11, 0);

const paddleMaterial = new THREE.MeshStandardMaterial({
  color: "#b9834d",
  roughness: 0.6,
});
const pinMaterial = new THREE.MeshStandardMaterial({
  color: "#c9a25e",
  roughness: 0.35,
  metalness: 0.7,
});

/** A splitter-shaped block with a T that rocks to follow the switch */
export function FlipFlop({ pieceId, look, raycast }: ModelProps) {
  const simulation = useContext(SimulationContext);
  const block = getPieceGeometry("flipflop");
  const flipper = useRef<THREE.Group>(null);
  const angle = useRef(TILT);

  useFrame((_, delta) => {
    if (!flipper.current) return;
    const side = simulation && pieceId ? simulation.switchSide(pieceId) : "-y";
    // Sending marbles down -y, the leg leans towards +y, and the other way
    const target = side === "+y" ? -TILT : TILT;
    const step = SWING_SPEED * delta;
    angle.current += Math.max(-step, Math.min(step, target - angle.current));
    // Three.js turns +x towards -z, which is the piece's -y
    flipper.current.rotation.y = -angle.current;
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
      <group ref={flipper} position={[0, 0.5 - GROOVE_DEPTH, 0]}>
        <mesh
          geometry={legGeometry}
          material={paddleMaterial}
          raycast={() => null}
        />
        <mesh
          geometry={barGeometry}
          material={paddleMaterial}
          raycast={() => null}
        />
        <mesh
          geometry={pinGeometry}
          material={pinMaterial}
          raycast={() => null}
        />
      </group>
    </>
  );
}
