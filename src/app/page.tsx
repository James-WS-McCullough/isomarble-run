"use client";

import { useEffect, useReducer, useState } from "react";
import { IsometricGrid } from "@/components/IsometricGrid";
import { Sidebar } from "@/components/Sidebar";
import { useMarbleSounds } from "@/hooks/useMarbleSounds";
import { useTrackEditor } from "@/hooks/useTrackEditor";
import { GRID_CONFIG } from "@/lib/isometric";
import { EMPTY_WORLD, worldReducer } from "@/lib/world";

/** Time between simulation steps in auto mode */
const STEP_INTERVAL_MS = 150;

const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

export default function Home() {
  const [world, dispatch] = useReducer(worldReducer, EMPTY_WORLD);
  const { blocks, marbles } = world;
  const [autoMode, setAutoMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const editor = useTrackEditor({
    blocks,
    updateBlocks: (update) => dispatch({ type: "updateBlocks", update }),
    addMarble: (position) => dispatch({ type: "addMarble", position }),
    config: GRID_CONFIG,
  });

  useMarbleSounds(marbles, soundEnabled);

  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(
      () => dispatch({ type: "step" }),
      STEP_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [autoMode]);

  const countByState = (state: string) =>
    marbles.filter((marble) => marble.state === state).length;

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar
        activeTool={editor.tool}
        onToolChange={editor.setTool}
        paletteBlock={editor.paletteBlock}
        onPaletteBlockChange={editor.setPaletteBlock}
        blockCount={blocks.length}
        marbleCount={marbles.length}
        onClearMarbles={() => dispatch({ type: "clearMarbles" })}
        onResetColours={() => dispatch({ type: "resetColours" })}
        autoMode={autoMode}
        onAutoModeChange={setAutoMode}
        soundEnabled={soundEnabled}
        onSoundEnabledChange={setSoundEnabled}
        onStep={() => dispatch({ type: "step" })}
      />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          <div className="border border-gray-600 rounded w-fit mx-auto">
            <IsometricGrid
              config={GRID_CONFIG}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              blocks={blocks}
              marbles={marbles}
              previewBlock={editor.previewBlock}
              previewMarble={editor.previewMarble}
              isAutoMode={autoMode}
              blocksInteractive={
                editor.tool === "move" ||
                editor.tool === "select" ||
                editor.tool === "deepen"
              }
              selectedIds={editor.selectedIds}
              draggingIds={editor.draggingIds}
              selectionRect={editor.selectionRect}
              onPointerDown={editor.onPointerDown}
              onPointerMove={editor.onPointerMove}
              onPointerUp={editor.onPointerUp}
              onPointerLeave={editor.onPointerLeave}
            />
          </div>

          {marbles.length > 0 && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h2 className="text-sm font-semibold mb-2 text-gray-200">
                Marble status
              </h2>
              <div className="text-sm text-gray-300 flex gap-6">
                <div>Falling: {countByState("falling")}</div>
                <div>Rolling: {countByState("rolling")}</div>
                <div>Behind: {countByState("behind")}</div>
                <div className="ml-auto">Total: {marbles.length}</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
