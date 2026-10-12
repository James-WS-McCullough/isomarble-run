"use client";

import type { PieceKind } from "@/lib/pieces";
import { type Cell, toThree } from "@/lib/space";
import {
  getPieceMaterial,
  OUTLINE_MATERIAL,
  type PieceLook,
} from "./materials";
import { getPieceGeometry } from "./pieceGeometry";
import { Fan, GlassOutlet, GlassTube } from "./TubePieces";

interface PieceMeshProps {
  kind: PieceKind;
  rotation: number;
  cell: Cell;
  hue?: number;
  look?: PieceLook;
  /** Piece id, so pointer events can tell which piece was hit */
  pieceId?: string;
  /** Whether the pointer can hit this piece */
  pickable?: boolean;
}

const ignoreRaycast = () => null;

export function PieceMesh({
  kind,
  rotation,
  cell,
  hue,
  look = "normal",
  pieceId,
  pickable = true,
}: PieceMeshProps) {
  const raycast = pickable ? undefined : ignoreRaycast;
  const placement = {
    position: toThree(cell),
    rotation: [0, (-rotation * Math.PI) / 2, 0] as [number, number, number],
    userData: { pieceId },
  };

  if (kind === "tube" || kind === "outlet" || kind === "fan") {
    const Special =
      kind === "tube" ? GlassTube : kind === "outlet" ? GlassOutlet : Fan;
    return (
      <group {...placement}>
        <Special hue={hue} look={look} raycast={raycast} />
      </group>
    );
  }

  const geometry = getPieceGeometry(kind);
  const material = getPieceMaterial(hue, look);

  return (
    <group {...placement}>
      <mesh geometry={geometry.solid} material={material} raycast={raycast} />
      <lineSegments
        geometry={geometry.outline}
        material={OUTLINE_MATERIAL}
        raycast={ignoreRaycast}
      />
    </group>
  );
}
