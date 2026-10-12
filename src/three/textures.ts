import * as THREE from "three";

/**
 * Procedurally generated textures, so the site needs no image downloads.
 * Both tile seamlessly.
 */

/** Hash of an integer lattice point, wrapped so the noise tiles */
function lattice(x: number, y: number, period: number): number {
  const px = ((x % period) + period) % period;
  const py = ((y % period) + period) % period;
  const n = Math.sin(px * 127.1 + py * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Smooth tileable value noise in 0-1 */
function noise(x: number, y: number, period: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top =
    lattice(x0, y0, period) * (1 - sx) + lattice(x0 + 1, y0, period) * sx;
  const bottom =
    lattice(x0, y0 + 1, period) * (1 - sx) +
    lattice(x0 + 1, y0 + 1, period) * sx;
  return top * (1 - sy) + bottom * sy;
}

function makeTexture(
  size: number,
  colourAt: (u: number, v: number) => [number, number, number],
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");

  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colourAt(x / size, y / size);
      const i = (y * size + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const LIGHT_WOOD: [number, number, number] = [232, 190, 132];
const DARK_WOOD: [number, number, number] = [168, 112, 62];

/** Light maple-style wood with long grain lines running along u */
export function createWoodTexture(): THREE.CanvasTexture {
  return makeTexture(256, (u, v) => {
    // A few gently wavy growth rings, plus fine streaks along the grain
    const warp = noise(u * 2, v * 3, 2) * 1.6 + noise(u * 4, v * 8, 4) * 0.4;
    const rings = 0.5 + 0.5 * Math.sin((v * 5 + warp) * Math.PI * 2);
    const streaks = noise(u * 3, v * 96, 3) * 0.3;
    const t = Math.min(1, rings ** 6 * 0.7 + streaks);
    return [
      LIGHT_WOOD[0] + (DARK_WOOD[0] - LIGHT_WOOD[0]) * t,
      LIGHT_WOOD[1] + (DARK_WOOD[1] - LIGHT_WOOD[1]) * t,
      LIGHT_WOOD[2] + (DARK_WOOD[2] - LIGHT_WOOD[2]) * t,
    ];
  });
}

/**
 * Pale glass with a white swirl, tinted by the marble's colour. The swirl
 * makes it easy to see the marble roll.
 */
export function createSwirlTexture(): THREE.CanvasTexture {
  return makeTexture(128, (u, v) => {
    const wave = Math.sin(
      (u * 2 + Math.sin(v * Math.PI * 2) * 0.35) * Math.PI * 2,
    );
    const band = Math.max(0, wave) ** 6;
    const level = 150 + 105 * band;
    return [level, level, level];
  });
}
