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

export interface PieceMaterials {
  /** Outside of the piece */
  body: THREE.Material;
  /** Darker wood at the bottom of the groove */
  grooveFloor: THREE.Material;
}

const cache = new Map<string, PieceMaterials>();

/** How strongly a painted colour stains the wood */
const STAIN = 0.55;

export function getPieceMaterials(
  hue: number | undefined,
  look: PieceLook,
): PieceMaterials {
  const key = `${hue ?? "none"}-${look}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const tint = new THREE.Color(1, 1, 1);
  if (hue !== undefined) {
    tint.lerp(new THREE.Color().setHSL(hue / 360, 0.75, 0.55), STAIN);
  }
  if (look === "blocked") tint.set("#ff6b6b");

  const make = (shade: number) => {
    const material = new THREE.MeshStandardMaterial({
      map: wood(),
      color: tint.clone().multiplyScalar(shade),
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
    return material;
  };

  const materials = { body: make(1), grooveFloor: make(0.72) };
  cache.set(key, materials);
  return materials;
}
