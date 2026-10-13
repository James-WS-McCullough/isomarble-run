"use client";

import { ALL_ITEMS, type HotbarItem, itemLabel } from "@/lib/hotbar";
import { Dialog } from "./Dialog";
import { ITEM_DRAG_TYPE, Slot } from "./Hotbar";
import { ItemIcon } from "./ItemIcon";

interface InventoryDialogProps {
  slots: (HotbarItem | null)[];
  selected: number;
  onSelect: (slot: number) => void;
  /** Put an item in a slot */
  onPlace: (item: HotbarItem | null, slot: number) => void;
  onClose: () => void;
}

/**
 * Everything you can build with. Click an item to put it in the selected
 * hotbar slot, or drag it onto any slot.
 */
export function InventoryDialog(props: InventoryDialogProps) {
  return (
    <Dialog title="Inventory" onClose={props.onClose} wide>
      <p className="mb-3 text-xs text-stone-400">
        Click something to put it in the selected slot, or drag it onto any
        slot. Press E or Escape to close.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
        {ALL_ITEMS.map((item) => (
          <li key={item}>
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(ITEM_DRAG_TYPE, item);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => props.onPlace(item, props.selected)}
              className="flex w-full flex-col items-center gap-1 rounded border border-stone-600 bg-stone-800 p-2 text-[11px] hover:border-amber-400 hover:bg-stone-700"
            >
              <span className="grid h-10 place-items-center">
                <ItemIcon item={item} />
              </span>
              {itemLabel(item)}
            </button>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-stone-400">
        Hotbar
      </h3>
      <div className="flex flex-wrap gap-1">
        {props.slots.map((item, slot) => (
          <Slot
            // Slots never move, so their index is a stable key
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={slot}
            item={item}
            number={slot + 1}
            selected={slot === props.selected}
            rotation={0}
            onSelect={() => props.onSelect(slot)}
            onDrop={(dropped) => props.onPlace(dropped, slot)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => props.onPlace(null, props.selected)}
        className="mt-3 rounded bg-stone-700 px-3 py-1.5 text-xs hover:bg-stone-600"
      >
        Empty the selected slot
      </button>
    </Dialog>
  );
}
