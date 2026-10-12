"use client";

import { type ReactNode, useEffect } from "react";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** A modal panel over the board. Escape or clicking outside closes it. */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? "max-w-4xl" : "max-w-sm"} max-h-[85vh] flex flex-col rounded-lg border border-stone-700 bg-stone-900 text-stone-200 shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-stone-700 px-4 py-3">
          <h2 className="text-base font-semibold text-amber-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
