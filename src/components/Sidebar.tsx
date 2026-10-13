interface SidebarProps {
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  marbleCount: number;
  pieceCount: number;
  onClearMarbles: () => void;
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

const SHORTCUTS: [string, string][] = [
  ["1 – 9", "Pick a hotbar slot"],
  ["E", "Inventory: fill the hotbar"],
  ["R / Shift+R", "Turn the piece"],
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
        <div className="grid gap-1 mt-2">
          <button
            type="button"
            onClick={props.onClearMarbles}
            disabled={props.marbleCount === 0}
            className={`${button} bg-stone-700 hover:bg-stone-600`}
          >
            Clear marbles
          </button>
        </div>
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
