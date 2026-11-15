import { loopBreakMs } from './musicTiming.js';

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
export const AMBIANCE_FADE_IN_MS = 1000;

/** A piece, and a land that is leaving, falls over two seconds. */
export const AMBIANCE_FADE_OUT_MS = 2000;

export function inclusiveCount(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function countFor(stage: AmbianceStage, random: () => number): number {
  if (stage === 'A') {
    return inclusiveCount(random, 3, 7);
  }
  if (stage === 'B') {
    return inclusiveCount(random, 1, 7);
  }
  if (stage === 'C') {
    return 1;
  }
  return inclusiveCount(random, 2, 4);
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
    const stage: AmbianceStage = roll < 0.2 ? 'B' : 'A';
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
