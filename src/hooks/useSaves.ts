"use client";

import { useEffect, useState } from "react";
import {
  encodePieces,
  loadSaves,
  newSaveId,
  type SavedRun,
  storeSaves,
} from "@/lib/saves";
import type { Piece } from "@/lib/track";

/**
 * The runs saved in this browser. Every change is written straight to
 * local storage; each returns false if the browser refused (storage full).
 */
export function useSaves() {
  const [saves, setSaves] = useState<SavedRun[]>([]);

  // Local storage only exists in the browser, so read it after mounting
  useEffect(() => {
    setSaves(loadSaves());
  }, []);

  const commit = (next: SavedRun[]): boolean => {
    if (!storeSaves(next)) return false;
    setSaves(next);
    return true;
  };

  /** Save a new run; returns its id, or null if it couldn't be stored */
  const create = (
    name: string,
    pieces: Piece[],
    thumbnail?: string,
  ): string | null => {
    const run: SavedRun = {
      id: newSaveId(),
      name,
      savedAt: Date.now(),
      pieces: encodePieces(pieces),
      thumbnail,
    };
    return commit([run, ...saves]) ? run.id : null;
  };

  const update = (id: string, pieces: Piece[], thumbnail?: string) =>
    commit(
      [
        ...saves.map((save) =>
          save.id === id
            ? {
                ...save,
                pieces: encodePieces(pieces),
                thumbnail,
                savedAt: Date.now(),
              }
            : save,
        ),
      ].sort((a, b) => b.savedAt - a.savedAt),
    );

  const rename = (id: string, name: string) =>
    commit(saves.map((save) => (save.id === id ? { ...save, name } : save)));

  const remove = (id: string) => commit(saves.filter((save) => save.id !== id));

  return { saves, create, update, rename, remove };
}
