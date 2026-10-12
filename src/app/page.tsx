"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { RunsDialog } from "@/components/RunsDialog";
import { SaveDialog } from "@/components/SaveDialog";
import { Sidebar } from "@/components/Sidebar";
import { useEditor } from "@/hooks/useEditor";
import { useSaves } from "@/hooks/useSaves";
import { exampleTrack } from "@/lib/example";
import {
  decodePieces,
  loadCurrentTrack,
  type SavedRun,
  storeCurrentTrack,
} from "@/lib/saves";
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

const STORAGE_FULL =
  "Couldn't save: this browser's storage is full. Try deleting some runs.";

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

  const saves = useSaves();
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"save" | "runs" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const captureRef = useRef<(() => string) | null>(null);

  const [initialPieces] = useState(exampleTrack);
  const editor = useEditor({
    initialPieces,
    onDropMarble: dropMarble,
    shortcutsEnabled: dialog === null,
  });

  useEffect(() => {
    simulation.setPieces(editor.pieces);
  }, [simulation, editor.pieces]);

  // Pick up where you left off: restore the autosaved track once
  const { replaceTrack } = editor;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const current = loadCurrentTrack();
    if (current) {
      replaceTrack(current.pieces);
      setCurrentSaveId(current.saveId);
    }
  }, [replaceTrack]);

  // Autosave the track as you build
  useEffect(() => {
    const timer = setTimeout(
      () => storeCurrentTrack(editor.pieces, currentSaveId),
      400,
    );
    return () => clearTimeout(timer);
  }, [editor.pieces, currentSaveId]);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(
      () => setToast((current) => (current === message ? null : current)),
      2500,
    );
  }, []);

  const snapshot = () => captureRef.current?.() || undefined;

  const currentSave = saves.saves.find((save) => save.id === currentSaveId);

  /** Save over the open run, or ask for a name for a new one */
  const save = () => {
    if (currentSave) {
      if (saves.update(currentSave.id, editor.pieces, snapshot())) {
        flash(`Saved "${currentSave.name}"`);
      } else {
        flash(STORAGE_FULL);
      }
    } else {
      setDialog("save");
    }
  };

  const saveAsNew = (name: string) => {
    const id = saves.create(name, editor.pieces, snapshot());
    if (id) {
      setCurrentSaveId(id);
      flash(`Saved "${name}"`);
    } else {
      flash(STORAGE_FULL);
    }
    setDialog(null);
  };

  const openRun = (run: SavedRun) => {
    editor.loadTrack(decodePieces(run.pieces));
    setCurrentSaveId(run.id);
    clearMarbles();
    setPaint({});
    setDialog(null);
    flash(`Opened "${run.name}"`);
  };

  const startFresh = (pieces: ReturnType<typeof exampleTrack>) => {
    editor.loadTrack(pieces);
    setCurrentSaveId(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialog || event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((current) => !current);
      } else if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const onSimulationEvents = (events: SimulationEvent[]) => {
    sound.update(simulation.marbles);
    if (events.length === 0) return;

    const painted: Record<string, number> = {};
    const removed = new Set<string>();
    for (const event of events) {
      if (event.type === "paint") painted[event.pieceId] = event.hue;
      else if (event.type === "removed") removed.add(event.marbleId);
      else if (event.type === "land" || event.type === "hit") {
        sound.tap(event.impact);
      }
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
        onClearTrack={() => startFresh([])}
        onLoadExample={() => startFresh(exampleTrack())}
        onSave={save}
        onOpenRuns={() => setDialog("runs")}
        runName={currentSave?.name ?? null}
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
          onCaptureReady={(capture) => {
            captureRef.current = capture;
          }}
        />
        {!playing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-stone-900/80 text-amber-200 text-sm pointer-events-none">
            Paused · press Space to play
          </div>
        )}
        {toast && (
          <output className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/90 px-4 py-1.5 text-sm text-amber-100 shadow-lg pointer-events-none">
            {toast}
          </output>
        )}
      </main>

      {dialog === "save" && (
        <SaveDialog
          defaultName={`Run ${saves.saves.length + 1}`}
          onSave={saveAsNew}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "runs" && (
        <RunsDialog
          saves={saves.saves}
          currentId={currentSaveId}
          onOpen={openRun}
          onRename={(id, name) => {
            if (!saves.rename(id, name)) flash(STORAGE_FULL);
          }}
          onDelete={(id) => {
            saves.remove(id);
            if (id === currentSaveId) setCurrentSaveId(null);
          }}
          onSaveNew={() => setDialog("save")}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
