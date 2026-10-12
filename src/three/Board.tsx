"use client";

import { Environment, Grid, Lightformer } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import type { PieceKind } from "@/lib/pieces";
import type { Simulation, SimulationEvent } from "@/lib/simulation";
import type { Cell, Vec3 } from "@/lib/space";
import type { Piece } from "@/lib/track";
import { CameraRig } from "./CameraRig";
import { Marbles } from "./Marbles";
import { PieceMesh } from "./PieceMesh";

/** What the pointer is over */
export interface BoardTarget {
  /** Piece under the pointer, if any */
  pieceId: string | null;
  /** Empty cell next to the face under the pointer, for placing a piece */
  placeCell: Cell;
  /** World position under the pointer */
  point: Vec3;
}

export interface Ghost {
  kind: PieceKind;
  rotation: number;
  cell: Cell;
  valid: boolean;
}

interface BoardProps {
  simulation: Simulation;
  pieces: Piece[];
  paint: Record<string, number>;
  marbleIds: string[];
  playing: boolean;
  speed: number;
  ghost: Ghost | null;
  /** Piece drawn highlighted, e.g. the one a click would pick up */
  highlightedId: string | null;
  /** Piece being dragged: hidden from the pointer so it can be moved */
  draggingId: string | null;
  onTargetChange: (target: BoardTarget | null) => void;
  onClick: (target: BoardTarget) => void;
  onRightClick: (target: BoardTarget) => void;
  onPointerDown: (target: BoardTarget, button: number) => void;
  /** Called every frame the simulation runs, with anything that happened */
  onSimulationEvents: (events: SimulationEvent[]) => void;
}

/**
 * The 3D board: wooden pieces, marbles and the build grid, viewed through a
 * fixed isometric camera.
 */
export function Board(props: BoardProps) {
  const { pieces, onTargetChange } = props;

  const toTarget = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    event.stopPropagation();
    return targetFromEvent(event, pieces);
  };

  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onPointerLeave={() => onTargetChange(null)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CameraRig />
      <Lighting />
      <SimulationDriver
        simulation={props.simulation}
        playing={props.playing}
        speed={props.speed}
        onEvents={props.onSimulationEvents}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: a three.js group, not a DOM element */}
      <group
        onPointerMove={(event) => onTargetChange(toTarget(event))}
        onPointerDown={(event) => {
          // Shift-drag pans the camera instead
          if (!event.shiftKey)
            props.onPointerDown(toTarget(event), event.button);
        }}
        onClick={(event) => props.onClick(toTarget(event))}
        onContextMenu={(event) => {
          event.nativeEvent.preventDefault();
          props.onRightClick(toTarget(event));
        }}
      >
        {/* Invisible floor at the bottom of level 0, for building on */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {pieces.map((piece) => (
          <PieceMesh
            key={piece.id}
            pieceId={piece.id}
            kind={piece.kind}
            rotation={piece.rotation}
            cell={piece.cell}
            hue={props.paint[piece.id]}
            look={piece.id === props.highlightedId ? "highlight" : "normal"}
            pickable={piece.id !== props.draggingId}
          />
        ))}
      </group>

      {props.ghost && <GhostPiece ghost={props.ghost} />}

      <Marbles simulation={props.simulation} marbleIds={props.marbleIds} />

      <Grid
        position={[0.5, -0.499, 0.5]}
        args={[21, 21]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#64748b"
        sectionSize={21}
        sectionThickness={0}
        fadeDistance={45}
        fadeStrength={2}
      />
    </Canvas>
  );
}

/**
 * The piece about to be placed, with its footprint on the floor and a line
 * down to it, so you can see how high it really is
 */
function GhostPiece({ ghost }: { ghost: Ghost }) {
  const { cell } = ghost;
  const colour = ghost.valid ? "#fbbf24" : "#f87171";
  return (
    <>
      <PieceMesh
        kind={ghost.kind}
        rotation={ghost.rotation}
        cell={cell}
        look={ghost.valid ? "ghost" : "blocked"}
        pickable={false}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cell.x, -0.495, cell.y]}
        raycast={() => null}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      {cell.z > 0 && (
        <mesh
          position={[cell.x, (cell.z - 1) / 2, cell.y]}
          raycast={() => null}
        >
          <boxGeometry args={[0.04, cell.z, 0.04]} />
          <meshBasicMaterial color={colour} transparent opacity={0.6} />
        </mesh>
      )}
    </>
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#fff1d6", "#3b2f25", 0.55]} />
      {/* Tops brightest, then left-hand sides, then right-hand sides */}
      <directionalLight position={[2, 10, 5]} intensity={2.4} color="#fff6e8" />
      {/* Soft studio reflections for the glossy marbles */}
      <Environment resolution={64} environmentIntensity={0.3}>
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 6, 0]}
          rotation-x={Math.PI / 2}
          scale={12}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[6, 2, 6]}
          scale={8}
        />
      </Environment>
    </>
  );
}

function SimulationDriver({
  simulation,
  playing,
  speed,
  onEvents,
}: {
  simulation: Simulation;
  playing: boolean;
  speed: number;
  onEvents: (events: SimulationEvent[]) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    onEvents(simulation.advance(Math.min(delta, 0.05) * speed));
  });
  return null;
}

function findPieceId(object: Object3D | null): string | null {
  for (let current = object; current; current = current.parent) {
    const id = current.userData.pieceId;
    if (typeof id === "string") return id;
  }
  return null;
}

function targetFromEvent(
  event: ThreeEvent<PointerEvent | MouseEvent>,
  pieces: Piece[],
): BoardTarget {
  const point = { x: event.point.x, y: event.point.z, z: event.point.y };
  const pieceId = findPieceId(event.object);
  const piece = pieceId ? pieces.find((p) => p.id === pieceId) : undefined;

  if (piece) {
    return {
      pieceId: piece.id,
      placeCell: neighbourFacing(piece.cell, point),
      point,
    };
  }

  return {
    pieceId: null,
    placeCell: { x: Math.round(point.x), y: Math.round(point.y), z: 0 },
    point,
  };
}

/**
 * The cell next to a piece on the side the pointer hit. Anywhere on the top
 * surface, grooves included, counts as the top.
 */
function neighbourFacing(cell: Cell, point: Vec3): Cell {
  const local = {
    x: point.x - cell.x,
    y: point.y - cell.y,
    z: point.z - cell.z,
  };
  const edge = 0.49;
  if (local.z <= -edge) return { ...cell, z: cell.z - 1 };
  if (Math.abs(local.x) < edge && Math.abs(local.y) < edge) {
    return { ...cell, z: cell.z + 1 };
  }
  if (Math.abs(local.x) >= Math.abs(local.y)) {
    return { ...cell, x: cell.x + Math.sign(local.x) };
  }
  return { ...cell, y: cell.y + Math.sign(local.y) };
}
