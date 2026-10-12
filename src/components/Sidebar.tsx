import type { Tool } from "@/hooks/useTrackEditor";
import { BLOCK_TYPES, WALL_SPRITE_PATH } from "@/lib/block-types";

interface SidebarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  paletteBlock: string;
  onPaletteBlockChange: (blockName: string) => void;
  blockCount: number;
  marbleCount: number;
  onClearMarbles: () => void;
  onResetColours: () => void;
  autoMode: boolean;
  onAutoModeChange: (enabled: boolean) => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onStep: () => void;
}

const TOOLS: { id: Tool; name: string; icon: string; hint: string }[] = [
  {
    id: "place",
    name: "Place",
    icon: "🔨",
    hint: "Click an empty cell to place the selected piece. Click a piece to remove it.",
  },
  {
    id: "move",
    name: "Move",
    icon: "✋",
    hint: "Drag a piece to move it.",
  },
  {
    id: "select",
    name: "Select",
    icon: "⬚",
    hint: "Drag a box to select pieces, then drag the selection to move them together.",
  },
  {
    id: "marble",
    name: "Marble",
    icon: "⚪",
    hint: "Click anywhere to drop a marble.",
  },
  {
    id: "deepen",
    name: "Deepen",
    icon: "🕳️",
    hint: "Left-click a piece to add a wall layer below it. Right-click to remove one.",
  },
];

const buttonClass =
  "px-2 py-1 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Sidebar({
  activeTool,
  onToolChange,
  paletteBlock,
  onPaletteBlockChange,
  blockCount,
  marbleCount,
  onClearMarbles,
  onResetColours,
  autoMode,
  onAutoModeChange,
  soundEnabled,
  onSoundEnabledChange,
  onStep,
}: SidebarProps) {
  const tool = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-screen text-gray-200">
      <div className="p-3 border-b border-gray-700">
        <h1 className="text-lg font-semibold text-gray-100">Isomarble Run</h1>
      </div>

      <section className="p-3 border-b border-gray-700">
        <h2 className="text-xs font-medium text-gray-300 mb-2">Simulation</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStep}
            disabled={marbleCount === 0}
            className={`${buttonClass} bg-blue-600 hover:bg-blue-700`}
          >
            Step
          </button>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => onAutoModeChange(e.target.checked)}
              className="w-3 h-3"
            />
            Auto
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => onSoundEnabledChange(e.target.checked)}
              className="w-3 h-3"
            />
            Sound
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-2">
          <button
            type="button"
            onClick={onClearMarbles}
            disabled={marbleCount === 0}
            className={`${buttonClass} bg-red-600 hover:bg-red-700`}
          >
            Clear marbles
          </button>
          <button
            type="button"
            onClick={onResetColours}
            disabled={blockCount === 0}
            className={`${buttonClass} bg-purple-600 hover:bg-purple-700`}
          >
            Reset colours
          </button>
        </div>
      </section>

      <section className="p-3 border-b border-gray-700">
        <h2 className="text-xs font-medium text-gray-300 mb-2">Tools</h2>
        <div className="grid grid-cols-5 gap-1">
          {TOOLS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => onToolChange(t.id)}
              aria-pressed={activeTool === t.id}
              aria-label={t.name}
              title={t.name}
              className={`p-2 rounded border transition-all ${
                activeTool === t.id
                  ? "border-blue-500 bg-blue-900/30"
                  : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          <span className="font-medium text-gray-200">{tool.name}:</span>{" "}
          {tool.hint}
        </p>
        {activeTool !== "place" &&
          activeTool !== "marble" &&
          blockCount === 0 && (
            <p className="mt-2 p-2 bg-amber-900/30 border border-amber-600 rounded text-xs text-amber-200">
              No pieces yet. Use the Place tool first.
            </p>
          )}
      </section>

      {activeTool === "place" && (
        <section className="p-3 flex-1 overflow-y-auto">
          <h2 className="text-xs font-medium text-gray-300 mb-2">
            Track pieces
          </h2>
          <div className="grid grid-cols-3 gap-1">
            {BLOCK_TYPES.map((block) => (
              <button
                type="button"
                key={block.blockName}
                onClick={() => onPaletteBlockChange(block.blockName)}
                aria-pressed={paletteBlock === block.blockName}
                title={block.label}
                className={`p-2 border rounded transition-all ${
                  paletteBlock === block.blockName
                    ? "border-blue-500 bg-blue-900/30"
                    : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
                }`}
              >
                <img
                  src={block.blockPath}
                  alt={block.label}
                  className="w-8 h-8 mx-auto"
                  style={{ imageRendering: "pixelated" }}
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTool === "deepen" && (
        <section className="p-3">
          <div className="flex items-center gap-2 p-2 bg-gray-700 rounded text-xs">
            <img
              src={WALL_SPRITE_PATH}
              alt=""
              className="w-6 h-6"
              style={{ imageRendering: "pixelated" }}
            />
            Walls are added below the piece
          </div>
        </section>
      )}

      <footer className="mt-auto p-3 border-t border-gray-700 text-xs text-gray-400">
        {blockCount} pieces · {marbleCount} marbles
      </footer>
    </aside>
  );
}
