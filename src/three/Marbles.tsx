"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Simulation } from "@/lib/simulation";
import { MARBLE_RADIUS } from "@/lib/space";
import { swirl } from "./materials";

interface MarblesProps {
  simulation: Simulation;
  marbleIds: string[];
}

const UP = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();
const spin = new THREE.Quaternion();

/**
 * Glass marbles. Positions come straight from the simulation every frame,
 * and each marble spins by exactly the distance it rolled.
 */
export function Marbles({ simulation, marbleIds }: MarblesProps) {
  const meshes = useRef(new Map<string, THREE.Mesh>());
  const geometry = useMemo(
    () => new THREE.SphereGeometry(MARBLE_RADIUS, 32, 24),
    [],
  );

  useFrame(() => {
    for (const marble of simulation.marbles) {
      const mesh = meshes.current.get(marble.id);
      if (!mesh) continue;

      const { position, visualOffset } = marble;
      mesh.position.set(
        position.x + visualOffset.x,
        position.z + visualOffset.z,
        position.y + visualOffset.y,
      );

      // Rolling a distance d turns the marble by d / r around the axis
      // perpendicular to the direction of travel
      const dx = marble.rolled.x;
      const dz = marble.rolled.y;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-6) {
        axis.set(dx, 0, dz).cross(UP).negate().normalize();
        spin.setFromAxisAngle(axis, distance / MARBLE_RADIUS);
        mesh.quaternion.premultiply(spin);
      }
      marble.rolled.x = 0;
      marble.rolled.y = 0;

      const material = mesh.material as THREE.MeshPhysicalMaterial;
      if (material.userData.hue !== marble.hue) {
        material.color.setHSL(marble.hue / 360, 0.8, 0.55);
        material.userData.hue = marble.hue;
      }
    }
  });

  return (
    <>
      {marbleIds.map((id) => (
        <mesh
          key={id}
          ref={(mesh) => {
            if (mesh) meshes.current.set(id, mesh);
            else meshes.current.delete(id);
          }}
          geometry={geometry}
          raycast={() => null}
        >
          <meshPhysicalMaterial
            map={swirl()}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>
      ))}
    </>
  );
}
