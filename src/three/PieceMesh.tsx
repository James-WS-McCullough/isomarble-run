"use client";

import type { ComponentType } from "react";
import type { PieceKind } from "@/lib/pieces";
import { type Cell, toThree } from "@/lib/space";
import { Dispenser } from "./DispenserMesh";
import { Fan } from "./FanMesh";
import {
  getPieceMaterial,
  OUTLINE_MATERIAL,
  type PieceLook,
} from "./materials";
import { getPieceGeometry } from "./pieceGeometry";
import { Seesaw } from "./SeesawMesh";
import { GlassFunnel, GlassOutlet, GlassTube } from "./TubeMeshes";

interface PieceMeshProps {
  kind: PieceKind;
  rotation: number;
  cell: Cell;
  look?: PieceLook;
  /** Piece id, so pointer events can tell which piece was hit */
  pieceId?: string;
  /** Whether the pointer can hit this piece */
  pickable?: boolean;
}

/** What a piece with its own model is drawn with */
export interface ModelProps {
  /** Piece id, so moving parts can follow the simulation */
  pieceId?: string;
  /** Quarter turns: the model is already turned, but some flip too */
  rotation: number;
  look: PieceLook;
  raycast?: () => null;
}

/**
 * Pieces with their own model. Every other piece is a wooden block with its
 * grooves carved into the top.
 */
const MODELS: Partial<Record<PieceKind, ComponentType<ModelProps>>> = {
  tube: GlassTube,
  outlet: GlassOutlet,
  funnel: GlassFunnel,
  fan: Fan,
  seesaw: Seesaw,
  dispenser: Dispenser,
};

const ignoreRaycast = () => null;

export function PieceMesh({
  kind,
  rotation,
  cell,
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

  const Model = MODELS[kind];
  if (Model) {
    return (
      <group {...placement}>
        <Model
          pieceId={pieceId}
          rotation={rotation}
          look={look}
          raycast={raycast}
        />
      </group>
    );
  }

  const geometry = getPieceGeometry(kind);
  const material = getPieceMaterial(look);

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
