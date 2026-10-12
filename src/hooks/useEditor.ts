"use client";

import { useEffect, useMemo, useState } from "react";
import { PIECES, type PieceKind } from "@/lib/pieces";
import { fitsAt, slideCell, snapToJoins } from "@/lib/placement";
import { type Cell, cellKey, type Vec3 } from "@/lib/space";
import { createPiece, type Piece } from "@/lib/track";
import type { Ghost } from "@/three/Board";
import type { BoardTarget } from "@/three/targeting";
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
  /** Turn keyboard shortcuts off, e.g. while a dialog is open */
  shortcutsEnabled?: boolean;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/**
 * Building tools:
 * - build: click to place the selected piece, R to rotate it. Pieces snap
 *   to the depth along the line of sight where they join up with the track;
 *   [ and ] slide them further away or closer.
 * - move: drag a piece somewhere else, R to rotate the piece under the pointer
 * - marble: click to drop a marble
 * - erase: click a piece to remove it
 * Right-click also removes a piece with any tool, and every change can be
 * undone.
 */
export function useEditor({
  initialPieces,
  onDropMarble,
  shortcutsEnabled = true,
}: EditorOptions) {
  const history = useHistory<Piece[]>(initialPieces);
  const pieces = history.value;

  const [tool, setTool] = useState<Tool>("build");
  const [kind, setKind] = useState<PieceKind>("straight");
  const [rotation, setRotation] = useState(0);
  const [target, setTarget] = useState<BoardTarget | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Extra steps along the line of sight, chosen with [ and ] */
  const [depthNudge, setDepthNudge] = useState(0);

  const canPlace = (
    placed: { kind: PieceKind; rotation: number },
    cell: Cell,
    ignoreId?: string,
  ) => fitsAt(pieces, placed.kind, placed.rotation, cell, ignoreId);

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

  const draggedPiece = drag
    ? pieces.find((piece) => piece.id === drag.pieceId)
    : undefined;
  const placing =
    draggedPiece ?? (tool === "build" ? { kind, rotation } : null);

  // Where the piece being placed (or dragged) would go: the depth where it
  // joins up best, nudged by [ and ]. Only recomputed when what's being
  // placed, or where, changes.
  const placingKind = placing?.kind;
  const placingRotation = placing?.rotation ?? 0;
  const ignoreId = draggedPiece?.id;
  const baseKey = target ? cellKey(target.placeCell) : null;
  const snapped = useMemo(() => {
    if (!baseKey || !placingKind) return null;
    const [x, y, z] = baseKey.split(",").map(Number);
    return snapToJoins(
      pieces,
      placingKind,
      placingRotation,
      { x, y, z },
      ignoreId,
    );
  }, [pieces, placingKind, placingRotation, baseKey, ignoreId]);
  const placeCell = snapped ? slideCell(snapped, depthNudge) : null;

  const onTargetChange = (next: BoardTarget | null) => {
    if (
      !next ||
      !target ||
      cellKey(next.placeCell) !== cellKey(target.placeCell)
    ) {
      setDepthNudge(0);
    }
    setTarget(next);
  };

  // Keep the dragged piece's destination up to date
  useEffect(() => {
    if (!drag || !placeCell || !draggedPiece) return;
    if (cellKey(placeCell) === cellKey(drag.cell)) return;
    setDrag({
      ...drag,
      cell: placeCell,
      valid: canPlace(draggedPiece, placeCell, drag.pieceId),
    });
  });

  const onClick = () => {
    if (
      tool === "build" &&
      placeCell &&
      canPlace({ kind, rotation }, placeCell)
    ) {
      history.commit([...pieces, createPiece(kind, rotation, placeCell)]);
    }
  };

  const onBoardClick = (clicked: BoardTarget) => {
    if (tool === "build") {
      onClick();
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
      if (!shortcutsEnabled || event.target instanceof HTMLInputElement) {
        return;
      }
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
      } else if (key === "[") {
        setDepthNudge((n) => n - 1);
      } else if (key === "]") {
        setDepthNudge((n) => n + 1);
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
    tool === "build" && placeCell
      ? {
          kind,
          rotation,
          cell: placeCell,
          valid: canPlace({ kind, rotation }, placeCell),
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
    onClick: onBoardClick,
    onRightClick,
    onPointerDown,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clearTrack: () => history.commit([]),
    loadTrack: (track: Piece[]) => history.commit(track),
    /** Load a track without an undo step back to the old one */
    replaceTrack: (track: Piece[]) => history.reset(track),
  };
}
