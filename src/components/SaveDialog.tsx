"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";

interface SaveDialogProps {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** Ask for a name before saving a new run */
export function SaveDialog({ defaultName, onSave, onClose }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  return (
    <Dialog title="Save run" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSave(trimmed);
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            className="rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-stone-100 outline-none focus:border-amber-500"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-stone-700 px-3 py-1.5 text-sm hover:bg-stone-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
