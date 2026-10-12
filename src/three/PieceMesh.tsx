"use client";

import type { PieceKind } from "@/lib/pieces";
import { type Cell, toThree } from "@/lib/space";
import {
  getPieceMaterial,
  OUTLINE_MATERIAL,
  type PieceLook,
} from "./materials";
import { getPieceGeometry } from "./pieceGeometry";

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
  const geometry = getPieceGeometry(kind);
  const material = getPieceMaterial(hue, look);

  return (
    <group
      position={toThree(cell)}
      rotation={[0, (-rotation * Math.PI) / 2, 0]}
      userData={{ pieceId }}
    >
      <mesh
        geometry={geometry.solid}
        material={material}
        raycast={pickable ? undefined : ignoreRaycast}
      />
      <lineSegments
        geometry={geometry.outline}
        material={OUTLINE_MATERIAL}
        raycast={ignoreRaycast}
      />
    </group>
  );
}
