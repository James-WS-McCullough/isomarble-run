"use client";

import React from "react";
import { BLOCK_TYPES } from "@/lib/block-types";

// Tool types for the sidebar
export type Tool = "place" | "move" | "select" | "marble" | "deepen";

// Convert block types to sprite types for the UI
const SPRITE_TYPES = BLOCK_TYPES.map((block, index) => ({
  id: `block-${index}`,
  name: block.blockName.replace(/([A-Z])/g, " $1").trim(), // Convert CamelCase to readable name
  path: block.blockPath,
  blockName: block.blockName,
}));

interface SidebarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  selectedSpriteType: {
    id: string;
    name: string;
    path: string;
    blockName: string;
  };
  onSpriteTypeChange: (spriteType: {
    id: string;
    name: string;
    path: string;
    blockName: string;
  }) => void;
  isPlacingMarble: boolean;
  onMarblePlacementToggle: () => void;
  marbleCount: number;
  onClearMarbles: () => void;
  onResetColors: () => void;
  spriteCount: number;
  // New props for controls
  autoMode: boolean;
  onAutoModeChange: (enabled: boolean) => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onStepMarbles: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  onToolChange,
  selectedSpriteType,
  onSpriteTypeChange,
  isPlacingMarble,
  onMarblePlacementToggle,
  marbleCount,
  onClearMarbles,
  onResetColors,
  spriteCount,
  autoMode,
  onAutoModeChange,
  soundEnabled,
  onSoundEnabledChange,
  onStepMarbles,
}) => {
  const tools = [
    {
      id: "place" as Tool,
      name: "Place",
      icon: "🔨",
      description: "Place and remove track pieces",
    },
    {
      id: "move" as Tool,
      name: "Move",
      icon: "✋",
      description: "Drag individual track pieces",
    },
    {
      id: "select" as Tool,
      name: "Select",
      icon: "⬚",
      description: "Select and move multiple pieces",
    },
    {
      id: "marble" as Tool,
      name: "Marble",
      icon: "⚪",
      description: "Place marbles on the track",
    },
    {
      id: "deepen" as Tool,
      name: "Deepen",
      icon: "🕳️",
      description: "Add walls below track pieces",
    },
  ];

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-screen">
      {/* Header - Compact */}
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-100">Marble Run</h2>
      </div>

      {/* Controls - Compact */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-300">Controls</span>
          <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
            {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onStepMarbles}
            disabled={marbleCount === 0}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Step
          </button>

          <label className="flex items-center gap-1 text-gray-200">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => onAutoModeChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
            />
            <span className="text-xs">Auto</span>
          </label>

          <label className="flex items-center gap-1 text-gray-200">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => onSoundEnabledChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
            />
            <span className="text-xs">Sound</span>
          </label>
        </div>
      </div>

      {/* Tool Selection - Compact Icons */}
      <div className="p-3 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-300 block mb-2">Tools</span>
        <div className="grid grid-cols-5 gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`p-2 rounded border transition-all ${
                activeTool === tool.id
                  ? "border-blue-500 bg-blue-900/30 text-blue-200"
                  : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600 text-gray-200"
              }`}
              title={`${tool.name}: ${tool.description}`}
            >
              <span className="text-lg">{tool.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool-specific content */}
      <div className="flex-1 overflow-y-auto">
        {activeTool === "place" && (
          <div className="p-3">
            <span className="text-xs font-medium text-gray-300 block mb-2">
              Track Pieces
            </span>
            <div className="grid grid-cols-3 gap-1">
              {SPRITE_TYPES.map((spriteType) => (
                <button
                  key={spriteType.id}
                  onClick={() => onSpriteTypeChange(spriteType)}
                  className={`p-2 border rounded transition-all ${
                    selectedSpriteType.id === spriteType.id
                      ? "border-blue-500 bg-blue-900/30"
                      : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
                  }`}
                  title={spriteType.name}
                >
                  <img
                    src={spriteType.path}
                    alt={spriteType.name}
                    className="w-8 h-8 mx-auto"
                    style={{ imageRendering: "pixelated" }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTool === "move" && (
          <div className="p-3">
            <span className="text-xs font-medium text-gray-300 block mb-2">
              Move Individual
            </span>
            <div className="bg-gray-700 rounded p-2 mb-2">
              <div className="text-xs text-gray-300">
                Pieces: <span className="font-medium">{spriteCount}</span>
              </div>
            </div>
            {spriteCount === 0 && (
              <div className="p-2 bg-amber-900/30 border border-amber-600 rounded">
                <div className="text-xs text-amber-200">
                  No pieces to move. Use Place tool first.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === "select" && (
          <div className="p-3">
            <span className="text-xs font-medium text-gray-300 block mb-2">
              Select Multiple
            </span>
            <div className="bg-gray-700 rounded p-2 mb-2">
              <div className="text-xs text-gray-300">
                Pieces: <span className="font-medium">{spriteCount}</span>
              </div>
            </div>
            {spriteCount === 0 && (
              <div className="p-2 bg-amber-900/30 border border-amber-600 rounded">
                <div className="text-xs text-amber-200">
                  No pieces to select. Use Place tool first.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === "marble" && (
          <div className="p-3">
            <span className="text-xs font-medium text-gray-300 block mb-2">
              Marble Placement
            </span>

            <button
              onClick={onMarblePlacementToggle}
              className={`w-full p-2 border rounded transition-all mb-2 ${
                isPlacingMarble
                  ? "border-red-500 bg-red-900/30 text-red-200"
                  : "border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600 text-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <img
                  src="/sprites/marble/MarbleBase.png"
                  alt="Marble"
                  className="w-6 h-6"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="text-xs font-medium">
                  {isPlacingMarble ? "Cancel" : "Place Marble"}
                </span>
              </div>
            </button>

            <div className="space-y-2">
              <div className="bg-gray-700 rounded p-2">
                <div className="text-xs text-gray-300">
                  Marbles: <span className="font-medium">{marbleCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={onClearMarbles}
                  disabled={marbleCount === 0}
                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear
                </button>

                <button
                  onClick={onResetColors}
                  disabled={spriteCount === 0}
                  className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTool === "deepen" && (
          <div className="p-3">
            <span className="text-xs font-medium text-gray-300 block mb-2">
              Adjust Height
            </span>

            <div className="mb-2 p-2 bg-gray-700 rounded">
              <div className="flex items-center gap-2 mb-1">
                <img
                  src="/sprites/isometric-cubes/Walls.png"
                  alt="Walls"
                  className="w-6 h-6"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="text-xs text-gray-300">Auto Walls</span>
              </div>
            </div>

            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-300">
                Pieces: <span className="font-medium">{spriteCount}</span>
              </div>
            </div>

            {spriteCount === 0 && (
              <div className="mt-2 p-2 bg-amber-900/30 border border-amber-600 rounded">
                <div className="text-xs text-amber-200">
                  No pieces to modify. Use Place tool first.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
