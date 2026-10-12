import type { Tool } from "@/hooks/useEditor";
import { PIECES, type PieceKind } from "@/lib/pieces";
import { PieceIcon } from "./PieceIcon";

interface SidebarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  pieceKind: PieceKind;
  rotation: number;
  onPieceChange: (kind: PieceKind) => void;
  onRotate: () => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  marbleCount: number;
  pieceCount: number;
  onClearMarbles: () => void;
  onResetColours: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearTrack: () => void;
  onLoadExample: () => void;
  onSave: () => void;
  onOpenRuns: () => void;
  /** Name of the saved run being edited, if any */
  runName: string | null;
}

const TOOLS: { id: Tool; name: string; icon: string; key: string }[] = [
  { id: "build", name: "Build", icon: "🔨", key: "B" },
  { id: "move", name: "Move", icon: "✋", key: "V" },
  { id: "marble", name: "Marble", icon: "🔮", key: "M" },
  { id: "erase", name: "Erase", icon: "🧽", key: "E" },
];

const TOOL_HINTS: Record<Tool, string> = {
  build:
    "Click to place a piece on the grid or on the side of another piece. R rotates it. Pieces snap to the depth where they join up with the track; [ and ] slide them further away or closer.",
  move: "Drag a piece to move it. R rotates the piece under the pointer.",
  marble: "Click anywhere to drop a marble.",
  erase: "Click a piece to remove it.",
};

const SHORTCUTS: [string, string][] = [
  ["Right-click", "Remove a piece"],
  ["Scroll", "Zoom"],
  ["Shift-drag / arrows", "Pan"],
  ["[ / ]", "Slide piece further / closer"],
  ["Space", "Play / pause"],
  ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
  ["Ctrl+S", "Save"],
];

const button =
  "px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function Sidebar(props: SidebarProps) {
  return (
    <aside
      className="w-64 shrink-0 bg-stone-900 border-r border-stone-700 flex flex-col h-screen text-stone-200 overflow-y-auto"
      // Hand keyboard focus back after using a control, so shortcuts like
      // Space and R keep working on the board
      onPointerUp={releaseFocus}
    >
      <header className="p-3 border-b border-stone-700">
        <h1 className="text-lg font-semibold text-amber-100">Isomarble Run</h1>
      </header>

      <Section title="Marbles">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => props.onPlayingChange(!props.playing)}
            className={`${button} w-20 bg-amber-600 hover:bg-amber-500 text-stone-950`}
          >
            {props.playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={props.soundEnabled}
              onChange={(e) => props.onSoundEnabledChange(e.target.checked)}
            />
            Sound
          </label>
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs">
          Speed
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={props.speed}
            onChange={(e) => props.onSpeedChange(Number(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <span className="w-8 text-right tabular-nums">{props.speed}×</span>
        </label>
        <div className="grid grid-cols-2 gap-1 mt-2">
          <button
            type="button"
            onClick={props.onClearMarbles}
            disabled={props.marbleCount === 0}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            Clear marbles
          </button>
          <button
            type="button"
            onClick={props.onResetColours}
            disabled={props.pieceCount === 0}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            Reset colours
          </button>
        </div>
      </Section>

      <Section title="Tools">
        <div className="grid grid-cols-4 gap-1">
          {TOOLS.map((tool) => (
            <button
              type="button"
              key={tool.id}
              onClick={() => props.onToolChange(tool.id)}
              aria-pressed={props.tool === tool.id}
              title={`${tool.name} (${tool.key})`}
              className={`p-2 rounded border text-xs flex flex-col items-center gap-0.5 transition-colors ${
                props.tool === tool.id
                  ? "border-amber-500 bg-amber-900/40"
                  : "border-stone-600 bg-stone-800 hover:bg-stone-700"
              }`}
            >
              <span className="text-lg">{tool.icon}</span>
              {tool.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-400">{TOOL_HINTS[props.tool]}</p>
      </Section>

      <Section title="Pieces">
        <div className="grid grid-cols-3 gap-1">
          {PIECES.map((piece) => {
            const selected =
              props.tool === "build" && props.pieceKind === piece.kind;
            return (
              <button
                type="button"
                key={piece.kind}
                onClick={() => props.onPieceChange(piece.kind)}
                aria-pressed={selected}
                title={`${piece.label} (${piece.hotkey.toUpperCase()})`}
                className={`p-1 rounded border flex flex-col items-center text-[11px] transition-colors ${
                  selected
                    ? "border-amber-500 bg-amber-900/40"
                    : "border-stone-600 bg-stone-800 hover:bg-stone-700"
                }`}
              >
                <PieceIcon
                  kind={piece.kind}
                  rotation={selected ? props.rotation : 0}
                />
                {piece.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={props.onRotate}
          className={`${button} w-full mt-2 bg-stone-700 hover:bg-stone-600`}
        >
          ⟳ Rotate (R)
        </button>
      </Section>

      <Section title="Track">
        {props.runName && (
          <p className="mb-2 truncate text-xs text-stone-400">
            Editing{" "}
            <span className="font-medium text-amber-200">{props.runName}</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={props.onSave}
            title="Save (Ctrl+S)"
            className={`${button} bg-amber-600 hover:bg-amber-500 text-stone-950`}
          >
            💾 Save
          </button>
          <button
            type="button"
            onClick={props.onOpenRuns}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            📂 My runs
          </button>
          <button
            type="button"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            ↷ Redo
          </button>
          <button
            type="button"
            onClick={props.onLoadExample}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            Load example
          </button>
          <button
            type="button"
            onClick={props.onClearTrack}
            disabled={props.pieceCount === 0}
            className={`${button} bg-red-900 hover:bg-red-800`}
          >
            Clear track
          </button>
        </div>
      </Section>

      <Section title="Controls">
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt className="text-stone-400">{keys}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <footer className="mt-auto p-3 border-t border-stone-700 text-xs text-stone-400">
        {props.pieceCount} pieces · {props.marbleCount} marbles
      </footer>
    </aside>
  );
}

function releaseFocus() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) focused.blur();
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-3 border-b border-stone-700">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}
