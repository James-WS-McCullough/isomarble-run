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
 * Where the flipper points, as an angle round from the piece's +x towards
 * +y: across the branch the next marble won't take, and a little back from
 * the stem. Measured from 0 to 2π so it swings round the back as it flips,
 * never through the stem.
 */
const POINTING = {
  /** Sending marbles down -y: blocking +y */
  "-y": Math.atan2(1, -0.35),
  /** Sending marbles down +y: blocking -y */
  "+y": 2 * Math.PI - Math.atan2(1, -0.35),
};
/** How fast the flipper swings over (radians per second) */
const SWING_SPEED = 14;

const paddleGeometry = new THREE.BoxGeometry(0.36, 0.17, 0.04);
paddleGeometry.translate(0.18, 0.085, 0);
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

/** A splitter-shaped block with a flipper that swings to follow the switch */
export function FlipFlop({ pieceId, look, raycast }: ModelProps) {
  const simulation = useContext(SimulationContext);
  const block = getPieceGeometry("flipflop");
  const flipper = useRef<THREE.Group>(null);
  const angle = useRef(POINTING["-y"]);

  useFrame((_, delta) => {
    if (!flipper.current) return;
    const side = simulation && pieceId ? simulation.switchSide(pieceId) : "-y";
    const target = side === "+y" ? POINTING["+y"] : POINTING["-y"];
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
          geometry={paddleGeometry}
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
