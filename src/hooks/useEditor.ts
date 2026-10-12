"use client";

import { useEffect, useState } from "react";
import { PIECES, type PieceKind } from "@/lib/pieces";
import type { Cell, Vec3 } from "@/lib/space";
import { createPiece, type Piece } from "@/lib/track";
import type { BoardTarget, Ghost } from "@/three/Board";
import { useHistory } from "./useHistory";

export type Tool = "build" | "move" | "marble" | "erase";

interface Drag {
  pieceId: string;
  cell: Cell;
  valid: boolean;
}

interface EditorOptions {
  initialPieces: Piece[];
  onDropMarble: (point: Vec3) => void;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/**
 * Building tools:
 * - build: click to place the selected piece, R to rotate it
 * - move: drag a piece somewhere else, R to rotate the piece under the pointer
 * - marble: click to drop a marble
 * - erase: click a piece to remove it
 * Right-click also removes a piece with any tool, and every change can be
 * undone.
 */
export function useEditor({ initialPieces, onDropMarble }: EditorOptions) {
  const history = useHistory<Piece[]>(initialPieces);
  const pieces = history.value;

  const [tool, setTool] = useState<Tool>("build");
  const [kind, setKind] = useState<PieceKind>("straight");
  const [rotation, setRotation] = useState(0);
  const [target, setTarget] = useState<BoardTarget | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const canPlace = (cell: Cell, ignoreId?: string) =>
    cell.z >= 0 &&
    !pieces.some(
      (piece) => piece.id !== ignoreId && sameCell(piece.cell, cell),
    );

  const removePiece = (pieceId: string) =>
    history.commit(pieces.filter((piece) => piece.id !== pieceId));

  const rotatePiece = (pieceId: string, turns: number) =>
    history.commit(
      pieces.map((piece) =>
        piece.id === pieceId
          ? { ...piece, rotation: (piece.rotation + turns + 4) % 4 }
          : piece,
      ),
    );

  const onTargetChange = (next: BoardTarget | null) => {
    setTarget(next);
    if (drag && next) {
      setDrag({
        ...drag,
        cell: next.placeCell,
        valid: canPlace(next.placeCell, drag.pieceId),
      });
    }
  };

  const onClick = (clicked: BoardTarget) => {
    if (tool === "build" && canPlace(clicked.placeCell)) {
      history.commit([
        ...pieces,
        createPiece(kind, rotation, clicked.placeCell),
      ]);
    } else if (tool === "marble") {
      onDropMarble(clicked.point);
    } else if (tool === "erase" && clicked.pieceId) {
      removePiece(clicked.pieceId);
    }
  };

  const onRightClick = (clicked: BoardTarget) => {
    if (clicked.pieceId) removePiece(clicked.pieceId);
  };

  const onPointerDown = (pressed: BoardTarget, button: number) => {
    if (tool === "move" && button === 0 && pressed.pieceId) {
      const piece = pieces.find((p) => p.id === pressed.pieceId);
      if (piece) setDrag({ pieceId: piece.id, cell: piece.cell, valid: true });
    }
  };

  const finishDrag = () => {
    if (!drag) return;
    const piece = pieces.find((p) => p.id === drag.pieceId);
    if (piece && drag.valid && !sameCell(piece.cell, drag.cell)) {
      history.commit(
        pieces.map((p) =>
          p.id === drag.pieceId ? { ...p, cell: drag.cell } : p,
        ),
      );
    }
    setDrag(null);
  };

  const chooseTool = (next: Tool) => {
    setTool(next);
    setDrag(null);
  };

  const choosePiece = (next: PieceKind) => {
    setKind(next);
    setTool("build");
  };

  const rotate = (turns: number) => {
    if (tool === "move" && target?.pieceId) {
      rotatePiece(target.pieceId, turns);
    } else {
      setRotation((current) => (current + turns + 4) % 4);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
      } else if (command && key === "y") {
        event.preventDefault();
        history.redo();
      } else if (command) {
        return;
      } else if (key === "r") {
        rotate(event.shiftKey ? -1 : 1);
      } else if (key === "b") {
        chooseTool("build");
      } else if (key === "v") {
        chooseTool("move");
      } else if (key === "m") {
        chooseTool("marble");
      } else if (key === "e") {
        chooseTool("erase");
      } else if ((key === "delete" || key === "backspace") && target?.pieceId) {
        removePiece(target.pieceId);
      } else if (key === "escape") {
        setDrag(null);
      } else {
        const piece = PIECES.find((p) => p.hotkey === key);
        if (piece) choosePiece(piece.kind);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Finish a drag even if the button is released off the board
  useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointerup", finishDrag);
    return () => window.removeEventListener("pointerup", finishDrag);
  });

  const ghost: Ghost | null =
    tool === "build" && target
      ? {
          kind,
          rotation,
          cell: target.placeCell,
          valid: canPlace(target.placeCell),
        }
      : null;

  // While dragging, show the piece where it would land
  const displayedPieces = drag
    ? pieces.map((piece) =>
        piece.id === drag.pieceId ? { ...piece, cell: drag.cell } : piece,
      )
    : pieces;

  return {
    pieces,
    displayedPieces,
    tool,
    chooseTool,
    kind,
    choosePiece,
    rotation,
    rotate,
    ghost,
    draggingId: drag?.pieceId ?? null,
    highlightedId:
      tool === "move" || tool === "erase"
        ? (drag?.pieceId ?? target?.pieceId ?? null)
        : null,
    onTargetChange,
    onClick,
    onRightClick,
    onPointerDown,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clearTrack: () => history.commit([]),
    loadTrack: (track: Piece[]) => history.commit(track),
  };
}
