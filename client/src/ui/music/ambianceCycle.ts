import { loopBreakMs, PIECE_FADE_IN_MS, PIECE_FADE_OUT_MS } from './musicTiming.js';

export type AmbianceStage = 'A' | 'B' | 'C' | 'D';

export interface AmbianceRun {
  stage: AmbianceStage;
  piecesLeft: number;
}

/** Silence, a crossfade into the next piece, or the last storm piece fading out alone. */
export type AmbianceGap = 'rest' | 'crossfade' | 'fade-out';

export interface AmbianceStep {
  gap: AmbianceGap;
  restMs: number;
  next: AmbianceRun;
}

/** A piece, and a new land, rises over one second. */
export const AMBIANCE_FADE_IN_MS = PIECE_FADE_IN_MS;

/** A piece, and a land that is leaving, falls over two seconds (Babuni, 2026-11-17). */
export const AMBIANCE_FADE_OUT_MS = PIECE_FADE_OUT_MS;

/**
 * A new land starts rising at the same moment the old land starts falling,
 * so the two overlap. A land that begins in silence still fades in.
 */
export function landCrossfade(): { fadeOutMs: number; fadeInMs: number; fadeInDelayMs: number } {
  return {
    fadeOutMs: AMBIANCE_FADE_OUT_MS,
    fadeInMs: AMBIANCE_FADE_IN_MS,
    fadeInDelayMs: 0,
  };
}

export function inclusiveCount(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * How many pieces a stage plays before the next stage is rolled: one to four
 * in every stage, the approach included (Babuni, 2026-11-17).
 */
export const STAGE_RUN_MIN = 1;
export const STAGE_RUN_MAX = 4;

function countFor(_stage: AmbianceStage, random: () => number): number {
  return inclusiveCount(random, STAGE_RUN_MIN, STAGE_RUN_MAX);
}

export function openingRun(random: () => number = Math.random): AmbianceRun {
  return { stage: 'A', piecesLeft: countFor('A', random) };
}

/**
 * What happens after the piece now playing.
 * One random draw chooses the next stage when a run ends, then one draw
 * chooses that stage's count, then one draw chooses a rest when the gap has one.
 */
export function stepAfterPiece(run: AmbianceRun, random: () => number = Math.random): AmbianceStep {
  if (run.piecesLeft > 1) {
    if (run.stage === 'D') {
      return {
        gap: 'crossfade',
        restMs: 0,
        next: { stage: 'D', piecesLeft: run.piecesLeft - 1 },
      };
    }

    return {
      gap: 'rest',
      restMs: loopBreakMs('ambient', random),
      next: { stage: run.stage, piecesLeft: run.piecesLeft - 1 },
    };
  }

  const roll = random();

  if (run.stage === 'A') {
    const stage: AmbianceStage = roll < 0.5 ? 'B' : 'A';
    return {
      gap: 'rest',
      restMs: loopBreakMs('ambient', random),
      next: { stage, piecesLeft: countFor(stage, random) },
    };
  }

  if (run.stage === 'B') {
    const stage: AmbianceStage = roll < 0.5 ? 'A' : 'C';
    return {
      gap: 'rest',
      restMs: loopBreakMs('ambient', random),
      next: { stage, piecesLeft: countFor(stage, random) },
    };
  }

  if (run.stage === 'C') {
    if (roll < 0.8) {
      return {
        gap: 'crossfade',
        restMs: 0,
        next: { stage: 'D', piecesLeft: countFor('D', random) },
      };
    }

    return {
      gap: 'rest',
      restMs: loopBreakMs('ambient', random),
      next: { stage: 'B', piecesLeft: countFor('B', random) },
    };
  }

  const stage: AmbianceStage = roll < 0.5 ? 'B' : 'A';
  return {
    gap: 'fade-out',
    restMs: loopBreakMs('ambient', random),
    next: { stage, piecesLeft: countFor(stage, random) },
  };
}

/**
 * The run a new land starts with when it cuts off a piece that is still
 * playing (Babuni, 2026-11-17). The cut-off piece counts as played, so the
 * cycle goes on to the next step instead of starting over at stage A. If the
 * new land has no pieces for that stage, it starts a fresh stage A instead;
 * null if it has no stage A either.
 */
export function handoffRunFor(
  current: AmbianceRun | null,
  hasStage: (stage: AmbianceStage) => boolean,
  random: () => number = Math.random,
): AmbianceRun | null {
  const next = current ? stepAfterPiece(current, random).next : openingRun(random);
  if (hasStage(next.stage)) {
    return next;
  }
  return hasStage('A') ? openingRun(random) : null;
}

export function pickPiece<T>(pieces: readonly T[], last: T | null, random: () => number = Math.random): T {
  if (pieces.length === 0) {
    throw new Error('An ambiance stage has no pieces to play.');
  }

  if (pieces.length === 1) {
    return pieces[0] as T;
  }

  const choices = last == null ? pieces : pieces.filter((piece) => piece !== last);
  const pool = choices.length > 0 ? choices : pieces;
  return pool[Math.floor(random() * pool.length)] as T;
}
