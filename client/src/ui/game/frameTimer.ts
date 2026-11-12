/**
 * The encounter frame's bottom line doubles as a timer (Babuni's direction,
 * 2026-11-12): while the game plays an animation the player has to wait for
 * (the dice rolling, a solution being used, rewards arriving, Continue
 * appearing), the line shrinks from its ends toward the element doing the work,
 * finishing exactly when the animation does.
 */

export interface FrameTimer {
  id: number;
  /** What is being waited for; the line shrinks toward its horizontal centre. */
  target: Element | null;
  startedAt: number;
  durationMs: number;
}

type Listener = (timer: FrameTimer | null) => void;

let current: FrameTimer | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

function endOf(timer: FrameTimer): number {
  return timer.startedAt + timer.durationMs;
}

/**
 * Whether a new wait replaces the running one. Two animations can overlap
 * (rewards arriving while losses fly in); the line follows whichever finishes
 * last, because that is when the game is ready.
 */
export function replacesTimer(running: FrameTimer | null, next: Pick<FrameTimer, 'startedAt' | 'durationMs'>, now: number): boolean {
  if (!running || endOf(running) <= now) {
    return true;
  }
  return next.startedAt + next.durationMs >= endOf(running);
}

function emit(): void {
  for (const listener of listeners) {
    listener(current);
  }
}

/** Starts a wait toward `target`; returns a function that cancels this wait only. */
export function startFrameTimer(target: Element | null | undefined, durationMs: number): () => void {
  const now = performance.now();
  if (!(durationMs > 0) || !replacesTimer(current, { startedAt: now, durationMs }, now)) {
    return () => {};
  }
  const timer: FrameTimer = { id: nextId++, target: target ?? null, startedAt: now, durationMs };
  current = timer;
  emit();
  return () => {
    if (current?.id === timer.id) {
      current = null;
      emit();
    }
  };
}

export function subscribeFrameTimer(listener: Listener): () => void {
  listeners.add(listener);
  listener(current && endOf(current) > performance.now() ? current : null);
  return () => {
    listeners.delete(listener);
  };
}

/** Of several elements, the one in the middle from left to right (for a row of rewards or losses). */
export function middleElement(elements: Iterable<Element>): Element | null {
  const placed = [...elements]
    .filter((element) => element.isConnected)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, x: rect.left + rect.width / 2 };
    })
    .sort((a, b) => a.x - b.x);
  return placed[Math.floor((placed.length - 1) / 2)]?.element ?? null;
}
