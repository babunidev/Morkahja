/**
 * The encounter frame's bottom line doubles as a timer (Babuni's direction,
 * 2026-11-12, refined 2026-11-13): it counts down whole phases, not single
 * animations. There are two per encounter:
 *
 * 1. From the encounter appearing until its solutions can be used (they give
 *    their ready wobble): the actions fading in and the solutions flying into
 *    their slots.
 * 2. From using a solution or the dice until the result can be used (rewards,
 *    losses or the Continue arrow wobble): the roll, the used solution's
 *    flight, rewards coming out of the encounter, losses arriving, and the
 *    wait until they can be collected.
 *
 * A phase is one continuous line. Each step plans when the phase will end;
 * a new plan re-times the line from its current length instead of starting
 * it full again.
 */

export interface FrameTimer {
  /** A new id starts a new line (fading in at full length). */
  id: number;
  /** Which phase this is, e.g. `actions:<snapshot>` or `act:<snapshot>`. */
  key: string;
  /** What is being waited for; the line shrinks toward its horizontal centre. */
  target: Element | null;
  /** The current plan: at `planStart` the line has `startFraction` of its length left and reaches 0 at `planEnd`. */
  planStart: number;
  planEnd: number;
  startFraction: number;
  /** Changes with every new plan, so the drawing restarts its animation. */
  revision: number;
}

/** Phase keys: the encounter's actions appearing, and acting on an encounter until its result can be used. */
export const actionsPhaseKey = (snapshotId: string | null | undefined): string => `actions:${snapshotId ?? 'none'}`;
export const actPhaseKey = (snapshotId: string | null | undefined): string => `act:${snapshotId ?? 'none'}`;

/**
 * First guess, when a solution or the dice is used, at how long the result
 * takes until it can be used (used solution's flight, rewards emerging, the
 * wait until collecting); the result re-plans with the real values.
 */
export const RESULT_READY_ESTIMATE_MS = 5500;

type Listener = (timer: FrameTimer | null) => void;

let current: FrameTimer | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

/** How much of the line is left at `now` (1 = full, 0 = done). */
export function fractionAt(timer: FrameTimer, now: number): number {
  const span = timer.planEnd - timer.planStart;
  if (span <= 0) {
    return 0;
  }
  return timer.startFraction * Math.min(1, Math.max(0, (timer.planEnd - now) / span));
}

/**
 * The timer after planning phase `key` to end `endsInMs` from `now`. Within
 * the running phase a plan only moves the end later, unless `exact` (the
 * step that knows the real end); another phase starts a new full line.
 */
export function planPhase(
  running: FrameTimer | null,
  key: string,
  target: Element | null,
  now: number,
  endsInMs: number,
  exact: boolean,
  newId: () => number,
): FrameTimer | null {
  const end = now + Math.max(0, endsInMs);
  if (running && running.key === key) {
    if (!exact && end <= running.planEnd) {
      return running;
    }
    return {
      ...running,
      target: running.target?.isConnected ? running.target : (target ?? running.target),
      planStart: now,
      planEnd: end,
      startFraction: fractionAt(running, now),
      revision: running.revision + 1,
    };
  }
  return { id: newId(), key, target, planStart: now, planEnd: end, startFraction: 1, revision: 0 };
}

function emit(): void {
  for (const listener of listeners) {
    listener(current);
  }
}

/**
 * Plans the phase `key` to end in `endsInMs`, shrinking toward `target`.
 * Starts the phase's line if it is not running yet.
 */
export function planFramePhase(
  key: string,
  target: Element | null | undefined,
  endsInMs: number,
  { exact = false }: { exact?: boolean } = {},
): void {
  const next = planPhase(current, key, target ?? null, performance.now(), endsInMs, exact, () => nextId++);
  if (next !== current) {
    current = next;
    emit();
  }
}

/** Ends the phase `key` now (the waited-for objects can be used). */
export function endFramePhase(key: string): void {
  if (current?.key === key) {
    current = null;
    emit();
  }
}

export function subscribeFrameTimer(listener: Listener): () => void {
  listeners.add(listener);
  listener(current && current.planEnd > performance.now() ? current : null);
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
