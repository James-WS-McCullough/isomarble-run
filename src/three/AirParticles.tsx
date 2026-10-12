"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { airStreams } from "@/lib/air";
import { type Piece, TrackIndex } from "@/lib/track";

/** Particles per tile of rising air */
const DENSITY = 10;
/** How fast the air rises, in tiles per second */
const RISE_SPEED = { open: 2.2, tube: 3.2 };
/** Particle size, in tiles */
const PARTICLE_SIZE = 0.09;

/** A soft round dot */
function dotTexture(): THREE.Texture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Wisps of air rising from every fan, up through the open air or along the
 * tubes they blow through
 */
export function AirParticles({ pieces }: { pieces: Piece[] }) {
  const streams = useMemo(() => airStreams(new TrackIndex(pieces)), [pieces]);

  const particles = useMemo(() => {
    const owner: number[] = [];
    streams.forEach((stream, index) => {
      const count = Math.ceil((stream.to - stream.from) * DENSITY);
      for (let i = 0; i < count; i++) owner.push(index);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(owner.length * 3), 3),
    );
    // Colour with alpha, so each particle can fade in and out
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(owner.length * 4), 4),
    );
    // Fixed random numbers per particle: where it starts, its angle and
    // how far out from the middle it drifts
    const seeds = Float32Array.from({ length: owner.length * 3 }, Math.random);
    return { geometry, owner, seeds };
  }, [streams]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: dotTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    [],
  );

  useEffect(() => () => particles.geometry.dispose(), [particles]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const { geometry, owner, seeds } = particles;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const color = geometry.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < owner.length; i++) {
      const stream = streams[owner[i]];
      const length = Math.max(stream.to - stream.from, 0.01);
      const inTube = stream.tubeFrom !== null;
      const speed = inTube ? RISE_SPEED.tube : RISE_SPEED.open;
      const phase = (seeds[i * 3] + (t * speed) / length) % 1;
      const height = stream.from + phase * length;

      // Narrow inside a tube; spreading out as it rises through open air
      const spread =
        stream.tubeFrom !== null && height > stream.tubeFrom
          ? 0.2
          : 0.12 + 0.22 * Math.min(1, (height - stream.from) / 2);
      const angle = seeds[i * 3 + 1] * Math.PI * 2 + t * 1.5;
      const radius = spread * Math.sqrt(seeds[i * 3 + 2]);

      // Three.js is y up: world (x, y, z) is (x, z, y)
      position.setXYZ(
        i,
        stream.x + Math.cos(angle) * radius,
        height,
        stream.y + Math.sin(angle) * radius,
      );
      color.setXYZW(i, 0.85, 0.95, 1, Math.sin(phase * Math.PI) * 0.75);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    // Keep the dots the same size in tiles as the view zooms
    material.size = PARTICLE_SIZE * camera.zoom;
  });

  if (particles.owner.length === 0) return null;
  return (
    <points
      geometry={particles.geometry}
      material={material}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
