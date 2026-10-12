"use client";

import { useReducer } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

type HistoryAction<T> =
  | { type: "commit"; value: T }
  | { type: "undo" }
  | { type: "redo" };

const LIMIT = 200;

function historyReducer<T>(
  history: History<T>,
  action: HistoryAction<T>,
): History<T> {
  switch (action.type) {
    case "commit":
      if (action.value === history.present) return history;
      return {
        past: [...history.past, history.present].slice(-LIMIT),
        present: action.value,
        future: [],
      };
    case "undo": {
      if (history.past.length === 0) return history;
      return {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future],
      };
    }
    case "redo": {
      if (history.future.length === 0) return history;
      return {
        past: [...history.past, history.present],
        present: history.future[0],
        future: history.future.slice(1),
      };
    }
  }
}

/** A value with undo and redo */
export function useHistory<T>(initial: T) {
  const [history, dispatch] = useReducer(
    historyReducer<T>,
    initial,
    (value): History<T> => ({ past: [], present: value, future: [] }),
  );

  return {
    value: history.present,
    commit: (value: T) => dispatch({ type: "commit", value }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
