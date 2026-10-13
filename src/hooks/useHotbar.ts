"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_HOTBAR,
  HOTBAR_SIZE,
  type HotbarItem,
  type HotbarState,
  parseHotbar,
  withItem,
} from "@/lib/hotbar";

const STORAGE_KEY = "isomarble-run:hotbar:v1";

interface HotbarOptions {
  /** Whether the number keys pick slots (off while a dialog is open) */
  keysEnabled: boolean;
  /** Open or close the inventory */
  onToggleInventory: () => void;
}

/**
 * The hotbar's slots and which one is in hand. Number keys 1-9 pick a slot
 * and E opens the inventory. The layout is remembered in this browser.
 */
export function useHotbar({ keysEnabled, onToggleInventory }: HotbarOptions) {
  const [state, setState] = useState<HotbarState>(DEFAULT_HOTBAR);

  // Local storage only exists in the browser, so read it after mounting
  useEffect(() => {
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      if (text) setState(parseHotbar(JSON.parse(text)));
    } catch {
      // Unreadable or blocked storage: keep the default hotbar
    }
  }, []);

  const update = (next: HotbarState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked or full: the hotbar just isn't remembered
    }
  };

  const select = (slot: number) => update({ ...state, selected: slot });
  /** Put an item in a slot (the one in hand, unless given) */
  const place = (item: HotbarItem | null, slot = state.selected) =>
    update(withItem(state, slot, item));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      // E opens the inventory, and closes it again from inside
      if (key === "e") {
        onToggleInventory();
        return;
      }
      if (!keysEnabled) return;
      const slot = Number(key) - 1;
      if (Number.isInteger(slot) && slot >= 0 && slot < HOTBAR_SIZE) {
        select(slot);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return {
    slots: state.slots,
    selected: state.selected,
    held: state.slots[state.selected],
    select,
    place,
  };
}
