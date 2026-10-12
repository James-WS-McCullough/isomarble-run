"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useEditor } from "@/hooks/useEditor";
import { exampleTrack } from "@/lib/example";
import { Simulation, type SimulationEvent } from "@/lib/simulation";
import { SoundEngine } from "@/lib/sound";
import type { Vec3 } from "@/lib/space";

// The 3D board only runs in the browser
const Board = dynamic(
  () => import("@/three/Board").then((module) => module.Board),
  { ssr: false },
);

/** Drop marbles a little above the pointer so they land on what you click */
const DROP_HEIGHT = 0.6;

export default function Home() {
  const [simulation] = useState(() => new Simulation());
  const [sound] = useState(() => new SoundEngine());
  const [marbleIds, setMarbleIds] = useState<string[]>([]);
  const [paint, setPaint] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const dropMarble = (point: Vec3) => {
    const marble = simulation.addMarble({ ...point, z: point.z + DROP_HEIGHT });
    setMarbleIds((ids) => [...ids, marble.id]);
  };

  const [initialPieces] = useState(exampleTrack);
  const editor = useEditor({
    initialPieces,
    onDropMarble: dropMarble,
  });

  useEffect(() => {
    simulation.setPieces(editor.pieces);
  }, [simulation, editor.pieces]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSimulationEvents = (events: SimulationEvent[]) => {
    sound.update(simulation.marbles);
    if (events.length === 0) return;

    const painted: Record<string, number> = {};
    const removed = new Set<string>();
    for (const event of events) {
      if (event.type === "paint") painted[event.pieceId] = event.hue;
      else if (event.type === "removed") removed.add(event.marbleId);
      else if (event.type === "land") sound.tap(event.impact);
    }
    if (Object.keys(painted).length > 0) {
      setPaint((current) => ({ ...current, ...painted }));
    }
    if (removed.size > 0) {
      setMarbleIds((ids) => ids.filter((id) => !removed.has(id)));
    }
  };

  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    if (enabled) sound.enable();
    else sound.disable();
  };

  const clearMarbles = () => {
    simulation.clearMarbles();
    setMarbleIds([]);
  };

  return (
    <div className="h-screen flex bg-stone-950">
      <Sidebar
        tool={editor.tool}
        onToolChange={editor.chooseTool}
        pieceKind={editor.kind}
        rotation={editor.rotation}
        onPieceChange={editor.choosePiece}
        onRotate={() => editor.rotate(1)}
        playing={playing}
        onPlayingChange={setPlaying}
        speed={speed}
        onSpeedChange={setSpeed}
        soundEnabled={soundEnabled}
        onSoundEnabledChange={toggleSound}
        marbleCount={marbleIds.length}
        pieceCount={editor.pieces.length}
        onClearMarbles={clearMarbles}
        onResetColours={() => setPaint({})}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onClearTrack={editor.clearTrack}
        onLoadExample={() => editor.loadTrack(exampleTrack())}
      />

      <main className="relative flex-1 bg-gradient-to-b from-slate-800 to-stone-900">
        <Board
          simulation={simulation}
          pieces={editor.displayedPieces}
          paint={paint}
          marbleIds={marbleIds}
          playing={playing}
          speed={speed}
          ghost={editor.ghost}
          highlightedId={editor.highlightedId}
          draggingId={editor.draggingId}
          onTargetChange={editor.onTargetChange}
          onClick={editor.onClick}
          onRightClick={editor.onRightClick}
          onPointerDown={editor.onPointerDown}
          onSimulationEvents={onSimulationEvents}
        />
        {!playing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-stone-900/80 text-amber-200 text-sm pointer-events-none">
            Paused · press Space to play
          </div>
        )}
      </main>
    </div>
  );
}
