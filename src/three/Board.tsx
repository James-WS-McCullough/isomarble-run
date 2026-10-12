"use client";

import { Environment, Grid, Lightformer } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { useEffect } from "react";
import type { PieceKind } from "@/lib/pieces";
import type { Simulation, SimulationEvent } from "@/lib/simulation";
import type { Cell } from "@/lib/space";
import { footprint, type Piece } from "@/lib/track";
import { AirParticles } from "./AirParticles";
import { CameraRig } from "./CameraRig";
import { Marbles } from "./Marbles";
import { PieceMesh } from "./PieceMesh";
import { SimulationContext } from "./SimulationContext";
import { type BoardTarget, targetFromEvent } from "./targeting";

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
  /** Receives a function that snapshots the board as a small JPEG */
  onCaptureReady?: (capture: () => string) => void;
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
      {props.onCaptureReady && <Snapshotter onReady={props.onCaptureReady} />}
      <SimulationDriver
        simulation={props.simulation}
        playing={props.playing}
        speed={props.speed}
        onEvents={props.onSimulationEvents}
      />

      <SimulationContext.Provider value={props.simulation}>
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
      </SimulationContext.Provider>

      <AirParticles pieces={pieces} />

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
      {footprint(ghost).map((part) => (
        <mesh
          key={`${part.x},${part.y}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[part.x, -0.495, part.y]}
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
      ))}
      {cell.z !== 0 && (
        // A line from the piece to the floor (up to it, if it's below)
        <mesh
          position={[
            cell.x,
            cell.z > 0 ? (cell.z - 1) / 2 : cell.z / 2,
            cell.y,
          ]}
          raycast={() => null}
        >
          <boxGeometry args={[0.04, Math.abs(cell.z), 0.04]} />
          <meshBasicMaterial color={colour} transparent opacity={0.6} />
        </mesh>
      )}
    </>
  );
}

const THUMBNAIL_WIDTH = 320;

/** Hands out a function that renders the board into a small JPEG */
function Snapshotter({
  onReady,
}: {
  onReady: (capture: () => string) => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      const source = gl.domElement;
      const canvas = document.createElement("canvas");
      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = Math.round(
        (THUMBNAIL_WIDTH * source.height) / source.width,
      );
      const context = canvas.getContext("2d");
      if (!context) return "";
      // The board is drawn over a CSS background, so paint one in
      const background = context.createLinearGradient(0, 0, 0, canvas.height);
      background.addColorStop(0, "#1e293b");
      background.addColorStop(1, "#1c1917");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.8);
    });
  }, [gl, scene, camera, onReady]);
  return null;
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
