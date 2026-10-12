"use client";

import { isUpsideDown } from "@/lib/funnel";
import type { PieceKind } from "@/lib/pieces";
import { type Cell, toThree } from "@/lib/space";
import {
  getPieceMaterial,
  OUTLINE_MATERIAL,
  type PieceLook,
} from "./materials";
import { getPieceGeometry } from "./pieceGeometry";
import { Seesaw } from "./SeesawMesh";
import { Fan, GlassFunnel, GlassOutlet, GlassTube } from "./TubePieces";

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

  if (kind === "seesaw") {
    return (
      <group {...placement}>
        <Seesaw pieceId={pieceId} hue={hue} look={look} raycast={raycast} />
      </group>
    );
  }

  if (
    kind === "tube" ||
    kind === "outlet" ||
    kind === "funnel" ||
    kind === "fan"
  ) {
    const Special = {
      tube: GlassTube,
      outlet: GlassOutlet,
      funnel: GlassFunnel,
      fan: Fan,
    }[kind];
    return (
      <group {...placement}>
        <Special
          hue={hue}
          look={look}
          raycast={raycast}
          upsideDown={isUpsideDown({ kind, rotation })}
        />
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
