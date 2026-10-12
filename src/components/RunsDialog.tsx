"use client";

import { useState } from "react";
import type { SavedRun } from "@/lib/saves";
import { Dialog } from "./Dialog";
import { NOT_A_LOGIN } from "./notALogin";

interface RunsDialogProps {
  saves: SavedRun[];
  currentId: string | null;
  onOpen: (save: SavedRun) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSaveNew: () => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A grid of the runs saved in this browser */
export function RunsDialog(props: RunsDialogProps) {
  const { saves } = props;
  return (
    <Dialog title="My runs" onClose={props.onClose} wide>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-stone-400">
          Runs are saved in this browser.
        </p>
        <button
          type="button"
          onClick={props.onSaveNew}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-500"
        >
          💾 Save current run as new
        </button>
      </div>

      {saves.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400">
          No saved runs yet. Build something and press Save!
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {saves.map((save) => (
            <RunCard
              key={save.id}
              save={save}
              current={save.id === props.currentId}
              onOpen={() => props.onOpen(save)}
              onRename={(name) => props.onRename(save.id, name)}
              onDelete={() => props.onDelete(save.id)}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function RunCard({
  save,
  current,
  onOpen,
  onRename,
  onDelete,
}: {
  save: SavedRun;
  current: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(save.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-md border bg-stone-800 ${
        current ? "border-amber-500" : "border-stone-700"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        title={`Open ${save.name}`}
        className="aspect-[3/2] bg-stone-950 hover:opacity-90"
      >
        {save.thumbnail ? (
          <img
            src={save.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl">🎱</span>
        )}
      </button>

      <div className="flex flex-col gap-1 p-2">
        {renaming ? (
          <input
            {...NOT_A_LOGIN}
            ref={(input) => input?.focus()}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Handled here: don't let it press a button once the box goes
                event.preventDefault();
                const trimmed = name.trim();
                if (trimmed) onRename(trimmed);
                setRenaming(false);
              } else if (event.key === "Escape") {
                // Just stop renaming, without closing the whole dialog
                event.stopPropagation();
                setRenaming(false);
              }
            }}
            onBlur={() => setRenaming(false)}
            className="w-full rounded border border-stone-600 bg-stone-900 px-1.5 py-0.5 text-sm outline-none focus:border-amber-500"
          />
        ) : (
          <p className="truncate text-sm font-medium" title={save.name}>
            {save.name}
            {current && (
              <span className="ml-1 text-xs text-amber-400">· open</span>
            )}
          </p>
        )}
        <p className="text-[11px] text-stone-400">
          {save.pieces.length} pieces · {dateFormat.format(save.savedAt)}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
          <button
            type="button"
            onClick={onOpen}
            className="rounded bg-stone-700 py-1 hover:bg-stone-600"
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => {
              setName(save.name);
              setRenaming(true);
            }}
            className="rounded bg-stone-700 py-1 hover:bg-stone-600"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() =>
              confirmDelete ? onDelete() : setConfirmDelete(true)
            }
            onBlur={() => setConfirmDelete(false)}
            className={`rounded py-1 ${
              confirmDelete
                ? "bg-red-700 hover:bg-red-600"
                : "bg-stone-700 hover:bg-stone-600"
            }`}
          >
            {confirmDelete ? "Sure?" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}
