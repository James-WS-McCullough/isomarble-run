import { PIECES, type PieceKind } from "./pieces";
import { createPiece, type Piece } from "./track";

/**
 * Saving runs in the browser's local storage. Pieces are stored compactly
 * as [kind, rotation, x, y, z].
 */

type StoredPiece = [
  kind: PieceKind,
  rotation: number,
  x: number,
  y: number,
  z: number,
];

export interface SavedRun {
  id: string;
  name: string;
  /** When it was last saved (ms since 1970) */
  savedAt: number;
  pieces: StoredPiece[];
  /** Small JPEG snapshot as a data URL */
  thumbnail?: string;
}

interface CurrentTrack {
  pieces: StoredPiece[];
  /** The saved run this track came from, if any */
  saveId: string | null;
}

const SAVES_KEY = "isomarble-run:saves:v1";
const CURRENT_KEY = "isomarble-run:current:v1";
const KINDS = new Set<string>(PIECES.map((piece) => piece.kind));

export function encodePieces(pieces: Piece[]): StoredPiece[] {
  return pieces.map(({ kind, rotation, cell }) => [
    kind,
    rotation,
    cell.x,
    cell.y,
    cell.z,
  ]);
}

/** Rebuild pieces, skipping anything that doesn't look like a valid piece */
export function decodePieces(stored: unknown): Piece[] {
  if (!Array.isArray(stored)) return [];
  const pieces: Piece[] = [];
  for (const entry of stored) {
    if (!Array.isArray(entry) || entry.length !== 5) continue;
    const [kind, rotation, x, y, z] = entry;
    if (
      typeof kind !== "string" ||
      !KINDS.has(kind) ||
      ![rotation, x, y, z].every(Number.isInteger)
    ) {
      continue;
    }
    pieces.push(
      createPiece(kind as PieceKind, ((rotation % 4) + 4) % 4, { x, y, z }),
    );
  }
  return pieces;
}

function read<T>(key: string): T | null {
  try {
    const text = window.localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false if the browser refused, e.g. because storage is full */
function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Saved runs, newest first */
export function loadSaves(): SavedRun[] {
  const saves = read<SavedRun[]>(SAVES_KEY);
  if (!Array.isArray(saves)) return [];
  return saves
    .filter(
      (save) =>
        save &&
        typeof save.id === "string" &&
        typeof save.name === "string" &&
        Array.isArray(save.pieces),
    )
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function storeSaves(saves: SavedRun[]): boolean {
  return write(SAVES_KEY, saves);
}

export function loadCurrentTrack(): {
  pieces: Piece[];
  saveId: string | null;
} | null {
  const current = read<CurrentTrack>(CURRENT_KEY);
  if (!current || !Array.isArray(current.pieces)) return null;
  return {
    pieces: decodePieces(current.pieces),
    saveId: typeof current.saveId === "string" ? current.saveId : null,
  };
}

export function storeCurrentTrack(pieces: Piece[], saveId: string | null) {
  write(CURRENT_KEY, { pieces: encodePieces(pieces), saveId });
}

export function newSaveId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
