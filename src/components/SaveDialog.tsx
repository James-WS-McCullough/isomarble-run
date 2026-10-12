"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { NOT_A_LOGIN } from "./notALogin";

interface SaveDialogProps {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** Ask for a name before saving a new run */
export function SaveDialog({ defaultName, onSave, onClose }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();
  const save = () => {
    if (trimmed) onSave(trimmed);
  };

  // Not a <form>: password managers treat submitting a form with a text box
  // as a login and offer to save it
  return (
    <Dialog title="Save run" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            {...NOT_A_LOGIN}
            autoFocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
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
            type="button"
            onClick={save}
            disabled={!trimmed}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
}
