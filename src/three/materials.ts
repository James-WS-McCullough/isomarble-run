import * as THREE from "three";
import { createSwirlTexture, createWoodTexture } from "./textures";

/**
 * Shared materials. Pieces are tinted by the colour last painted onto them,
 * so materials are cached per tint rather than created per piece.
 */

let woodTexture: THREE.Texture | null = null;
let swirlTexture: THREE.Texture | null = null;

function wood(): THREE.Texture {
  woodTexture ??= createWoodTexture();
  return woodTexture;
}

export function swirl(): THREE.Texture {
  swirlTexture ??= createSwirlTexture();
  return swirlTexture;
}

export type PieceLook = "normal" | "highlight" | "ghost" | "blocked";

const cache = new Map<string, THREE.Material>();

/** How strongly a painted colour stains the wood */
const STAIN = 0.55;

/** Wood for a piece; vertex colours on the geometry darken the grooves */
export function getPieceMaterial(
  hue: number | undefined,
  look: PieceLook,
): THREE.Material {
  const key = `${hue ?? "none"}-${look}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const tint = new THREE.Color(1, 1, 1);
  if (hue !== undefined) {
    tint.lerp(new THREE.Color().setHSL(hue / 360, 0.75, 0.55), STAIN);
  }
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

  cache.set(key, material);
  return material;
}

export const OUTLINE_MATERIAL = new THREE.LineBasicMaterial({
  color: "#6b4423",
});
