import * as THREE from "three";
import type { MarbleLook } from "@/lib/simulation";
import { createMarbleTexture, createWoodTexture } from "./textures";

/** Shared materials, cached rather than created per piece or marble */

let woodTexture: THREE.Texture | null = null;

function wood(): THREE.Texture {
  woodTexture ??= createWoodTexture();
  return woodTexture;
}

export type PieceLook = "normal" | "highlight" | "ghost" | "blocked";

const cache = new Map<PieceLook, THREE.Material>();

/** Wood for a piece; vertex colours on the geometry darken the grooves */
export function getPieceMaterial(look: PieceLook): THREE.Material {
  const cached = cache.get(look);
  if (cached) return cached;

  const tint = new THREE.Color(1, 1, 1);
  if (look === "blocked") tint.set("#ff6b6b");

  const material = new THREE.MeshStandardMaterial({
    map: wood(),
    color: tint,
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
  });
  if (look === "ghost" || look === "blocked") {
    material.transparent = true;
    material.opacity = 0.55;
    material.depthWrite = false;
  }
  if (look === "highlight") {
    material.emissive = new THREE.Color("#ffd28a");
    material.emissiveIntensity = 0.25;
  }

  cache.set(look, material);
  return material;
}

const marbleCache = new Map<string, THREE.Material>();

/** Polished glass in a marble's colour and design */
export function getMarbleMaterial(look: MarbleLook): THREE.Material {
  const key = `${look.pattern}-${Math.round(look.hue)}`;
  let material = marbleCache.get(key);
  if (!material) {
    material = new THREE.MeshPhysicalMaterial({
      map: createMarbleTexture(look),
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    marbleCache.set(key, material);
  }
  return material;
}

export const OUTLINE_MATERIAL = new THREE.LineBasicMaterial({
  color: "#6b4423",
});
