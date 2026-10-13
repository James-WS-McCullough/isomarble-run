"use client";

import { type HotbarItem, itemHint, itemLabel } from "@/lib/hotbar";
import { ItemIcon } from "./ItemIcon";

interface HotbarProps {
  slots: (HotbarItem | null)[];
  selected: number;
  /** How the piece in hand is turned */
  rotation: number;
  onSelect: (slot: number) => void;
  /** An item dragged from the inventory dropped onto a slot */
  onDrop: (item: HotbarItem, slot: number) => void;
  onOpenInventory: () => void;
}

/** The type of drag data carrying a hotbar item */
export const ITEM_DRAG_TYPE = "application/x-isomarble-item";

/**
 * Nine numbered slots along the bottom of the board, Minecraft style. The
 * number keys pick a slot, and E opens the inventory to fill them.
 */
export function Hotbar(props: HotbarProps) {
  const held = props.slots[props.selected];
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="pointer-events-none text-center drop-shadow">
        <p className="text-sm font-semibold text-amber-100">
          {held ? itemLabel(held) : "Empty hand"}
        </p>
        <p className="text-xs text-stone-300">
          {held ? itemHint(held) : "Press E to fill this slot"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-md border-2 border-stone-600 bg-stone-950/85 p-1 shadow-2xl">
          {props.slots.map((item, slot) => (
            <Slot
              // Slots never move, so their index is a stable key
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={slot}
              item={item}
              number={slot + 1}
              selected={slot === props.selected}
              rotation={props.rotation}
              onSelect={() => props.onSelect(slot)}
              onDrop={(dropped) => props.onDrop(dropped, slot)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={props.onOpenInventory}
          title="Inventory (E)"
          className="flex h-14 flex-col items-center justify-center rounded-md border-2 border-stone-600 bg-stone-950/85 px-2 text-stone-200 shadow-2xl hover:bg-stone-800"
        >
          <span className="text-xl leading-none">🎒</span>
          <span className="mt-1 font-mono text-[10px] text-stone-400">E</span>
        </button>
      </div>
    </div>
  );
}

export function Slot({
  item,
  number,
  selected,
  rotation,
  onSelect,
  onDrop,
}: {
  item: HotbarItem | null;
  number: number;
  selected: boolean;
  rotation: number;
  onSelect: () => void;
  onDrop: (item: HotbarItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(ITEM_DRAG_TYPE)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const dropped = event.dataTransfer.getData(ITEM_DRAG_TYPE);
        if (dropped) onDrop(dropped as HotbarItem);
      }}
      aria-pressed={selected}
      title={item ? `${itemLabel(item)} (${number})` : `Empty (${number})`}
      className={`relative grid h-14 w-14 place-items-center rounded-sm border-2 transition-transform ${
        selected
          ? "z-10 scale-110 border-amber-200 bg-stone-700"
          : "border-stone-600 bg-stone-800/90 hover:bg-stone-700"
      }`}
    >
      {item && <ItemIcon item={item} rotation={selected ? rotation : 0} />}
      <span className="absolute left-1 top-0.5 font-mono text-[10px] text-stone-400">
        {number}
      </span>
    </button>
  );
}
