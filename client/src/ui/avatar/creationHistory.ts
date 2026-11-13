/**
 * Undo and redo in avatar creation (Babuni's direction, 2026-11-13): every
 * action (a race, role or sex, randomizing, a frame) saves the combination in
 * one list. Undo steps back, redo steps forward. A change made after stepping
 * back is inserted right after the current step, and the later steps are kept,
 * so redo still reaches them.
 */
export interface CreationHistory<T> {
  entries: T[];
  index: number;
}

export function startHistory<T>(first: T): CreationHistory<T> {
  return { entries: [first], index: 0 };
}

/** Saves `next` as the step after the current one (unless it is the same combination). */
export function recordStep<T>(history: CreationHistory<T>, next: T, same: (a: T, b: T) => boolean): CreationHistory<T> {
  const current = history.entries[history.index];
  if (current !== undefined && same(current, next)) {
    return history;
  }
  const at = history.index + 1;
  return {
    entries: [...history.entries.slice(0, at), next, ...history.entries.slice(at)],
    index: at,
  };
}

/** Replaces the current step (for typing a name, which is not a step of its own). */
export function amendStep<T>(history: CreationHistory<T>, next: T): CreationHistory<T> {
  const entries = [...history.entries];
  entries[history.index] = next;
  return { entries, index: history.index };
}

export const canUndo = (history: CreationHistory<unknown>): boolean => history.index > 0;
export const canRedo = (history: CreationHistory<unknown>): boolean => history.index < history.entries.length - 1;

export function undoStep<T>(history: CreationHistory<T>): CreationHistory<T> {
  return canUndo(history) ? { ...history, index: history.index - 1 } : history;
}

export function redoStep<T>(history: CreationHistory<T>): CreationHistory<T> {
  return canRedo(history) ? { ...history, index: history.index + 1 } : history;
}
