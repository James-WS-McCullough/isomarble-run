import * as THREE from "three";
import type { MarbleLook, MarblePattern } from "@/lib/simulation";

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

type Rgb = [number, number, number];

function hsl(hue: number, saturation: number, lightness: number): Rgb {
  const colour = new THREE.Color().setHSL(
    (((hue % 360) + 360) % 360) / 360,
    saturation,
    lightness,
  );
  return [colour.r * 255, colour.g * 255, colour.b * 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const f = Math.min(1, Math.max(0, t));
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

const WHITE: Rgb = [246, 246, 240];

/**
 * A marble's design, wrapped round it: u goes round its middle and v from
 * pole to pole. Each tiles round the middle, and is busy enough to see the
 * marble spin as it rolls.
 */
const DESIGNS: Record<
  MarblePattern,
  (hue: number) => (u: number, v: number) => Rgb
> = {
  // Coloured glass with a white ribbon swirled through it
  swirl: (hue) => {
    const glass = hsl(hue, 0.75, 0.5);
    return (u, v) => {
      const wave = Math.sin(
        (u * 2 + Math.sin(v * Math.PI * 2) * 0.35) * Math.PI * 2,
      );
      return mix(glass, WHITE, Math.max(0, wave) ** 6);
    };
  },

  // Clear glass with bright twisted vanes through the middle
  catsEye: (hue) => {
    const glass = hsl(hue, 0.45, 0.8);
    const vane = hsl(hue, 0.95, 0.42);
    return (u, v) => {
      const twist = u * 3 + v * 1.5;
      const offCentre = twist - Math.floor(twist) - 0.5;
      return mix(glass, vane, Math.exp(-((offCentre / 0.11) ** 2)));
    };
  },

  // Segments in its colour and white, like a beach ball
  beachBall: (hue) => {
    const colour = hsl(hue, 0.85, 0.5);
    return (u) => (Math.floor(u * 6) % 2 === 0 ? colour : WHITE);
  },

  // Dark glass with clouds of colour and specks of starlight
  galaxy: (hue) => {
    const night = hsl(hue + 20, 0.6, 0.1);
    const cloud = hsl(hue, 0.85, 0.42);
    return (u, v) => {
      const clouds =
        noise(u * 6, v * 4, 6) * 0.7 + noise(u * 12, v * 8, 12) * 0.3;
      const base = mix(night, cloud, (clouds - 0.35) * 2);
      const star = lattice(Math.floor(u * 64), Math.floor(v * 32), 64);
      return star > 0.97 ? WHITE : base;
    };
  },

  // One half its colour, the other half the opposite colour
  twoTone: (hue) => {
    const top = hsl(hue, 0.8, 0.5);
    const bottom = hsl(hue + 180, 0.8, 0.55);
    return (_u, v) => mix(top, bottom, (v - 0.47) / 0.06);
  },

  // White spots on its colour
  polkaDot: (hue) => {
    const colour = hsl(hue, 0.8, 0.48);
    return (u, v) => {
      const du = u * 8 - Math.floor(u * 8) - 0.5;
      const dv = v * 5 - Math.floor(v * 5) - 0.5;
      return Math.hypot(du, dv * 0.8) < 0.26 ? WHITE : colour;
    };
  },
};

/** A marble's colour and design */
export function createMarbleTexture(look: MarbleLook): THREE.CanvasTexture {
  return makeTexture(128, DESIGNS[look.pattern](look.hue));
}
