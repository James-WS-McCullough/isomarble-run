"use client";

import { Edges } from "@react-three/drei";
import type { PieceKind } from "@/lib/pieces";
import { type Cell, toThree } from "@/lib/space";
import { getPieceMaterials, type PieceLook } from "./materials";
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
const EDGE_COLOUR = "#6b4423";

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
  const { body, grooveFloor } = getPieceMaterials(hue, look);
  const raycast = pickable ? undefined : ignoreRaycast;

  return (
    <group
      position={toThree(cell)}
      rotation={[0, (-rotation * Math.PI) / 2, 0]}
      userData={{ pieceId }}
    >
      <mesh
        geometry={geometry.base}
        // Box faces: +x, -x, top, bottom, +z, -z. With rails, the top of the
        // base is the floor of the groove.
        material={
          geometry.rails ? [body, body, grooveFloor, body, body, body] : body
        }
        raycast={raycast}
      >
        <Edges threshold={20} color={EDGE_COLOUR} raycast={ignoreRaycast} />
      </mesh>
      {geometry.rails && (
        <mesh geometry={geometry.rails} material={body} raycast={raycast}>
          <Edges threshold={20} color={EDGE_COLOUR} raycast={ignoreRaycast} />
        </mesh>
      )}
    </group>
  );
}
