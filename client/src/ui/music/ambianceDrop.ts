import type { AmbianceStage } from './ambianceCycle.js';

export interface DropPlacement {
  sourceName: string;
  expansion: number;
  stage: AmbianceStage;
  number: number;
}

/**
 * Atranor has an ambiance of its own (Babuni, 2026-11-24), played only there.
 * It is filed as a land outside the expansion numbers, in UI/Ambiance/atranor.
 */
export const ATRANOR_AMBIANCE_PACK = 999;
const ATRANOR_FOLDER = 'atranor';

/**
 * The level-up's own ambiance (Babuni, 2026-11-24: the pieces are coming).
 * Until it has pieces, the level-up keeps the bed it has today.
 */
export const LEVEL_UP_AMBIANCE_PACK = 998;
const LEVEL_UP_FOLDER = 'levelup';

/**
 * Atranor and the level-up are one intense moment (Babuni, 2026-11-24): no
 * breaks, every piece crossfades into the next one.
 */
export function ambianceLandIsContinuous(pack: number): boolean {
  return pack === ATRANOR_AMBIANCE_PACK || pack === LEVEL_UP_AMBIANCE_PACK;
}

function packFolder(pack: number): string {
  if (pack === ATRANOR_AMBIANCE_PACK) {
    return ATRANOR_FOLDER;
  }
  if (pack === LEVEL_UP_AMBIANCE_PACK) {
    return LEVEL_UP_FOLDER;
  }
  return String(pack);
}

const WORD_TO_STAGE: Record<string, AmbianceStage> = {
  nature: 'A',
  wind: 'B',
  rainStart: 'C',
  rain: 'D',
};

interface ParsedDrop {
  sourceName: string;
  expansion: number;
  stage: AmbianceStage;
  preferred: number;
  /** A stage-letter name keeps its number. A word name takes the next free number. */
  exact: boolean;
}

function slotKey(expansion: number, stage: AmbianceStage, number: number): string {
  return `${expansion}:${stage}:${number}`;
}

/**
 * Reads one drop-folder name.
 * `1stageC3` keeps expansion 1, stage C, piece 3.
 * `0nature12` is expansion 0, stage A, piece 12.
 * `11nature3` is the doubled-digit typo for expansion 1, stage A.
 * `atranor_b2` is Atranor's own ambiance, stage B, piece 2; `levelup_b2` the level-up's.
 */
export function parseDropName(fileName: string): ParsedDrop | null {
  const base = fileName.replace(/\.mp3$/i, '');
  const doubledNature = base.match(/^11nature(\d+)$/i);
  if (doubledNature) {
    return {
      sourceName: fileName,
      expansion: 1,
      stage: 'A',
      preferred: Number(doubledNature[1]),
      exact: false,
    };
  }

  const special = base.match(/^(atranor|levelup)_([abcd])(\d+)$/i);
  if (special) {
    return {
      sourceName: fileName,
      expansion: special[1]!.toLowerCase() === 'atranor' ? ATRANOR_AMBIANCE_PACK : LEVEL_UP_AMBIANCE_PACK,
      stage: special[2]!.toUpperCase() as AmbianceStage,
      preferred: Number(special[3]),
      exact: true,
    };
  }

  const staged = base.match(/^(\d+)stage([ABCD])(\d+)$/i);
  if (staged) {
    return {
      sourceName: fileName,
      expansion: Number(staged[1]),
      stage: staged[2]!.toUpperCase() as AmbianceStage,
      preferred: Number(staged[3]),
      exact: true,
    };
  }

  const word = base.match(/^(\d+)(rainStart|nature|wind|rain)(\d+)$/);
  if (!word) {
    return null;
  }

  const stage = WORD_TO_STAGE[word[2]!];
  if (!stage) {
    return null;
  }

  return {
    sourceName: fileName,
    expansion: Number(word[1]),
    stage,
    preferred: Number(word[3]),
    exact: false,
  };
}

export function placeDropFiles(fileNames: readonly string[]): {
  placed: DropPlacement[];
  unknown: string[];
} {
  const parsed: ParsedDrop[] = [];
  const unknown: string[] = [];

  for (const fileName of fileNames) {
    if (!fileName.toLowerCase().endsWith('.mp3')) {
      continue;
    }
    const drop = parseDropName(fileName);
    if (!drop) {
      unknown.push(fileName);
      continue;
    }
    parsed.push(drop);
  }

  const taken = new Set<string>();
  const placed: DropPlacement[] = [];
  const exact = parsed.filter((drop) => drop.exact).sort((a, b) => a.preferred - b.preferred);
  const loose = parsed
    .filter((drop) => !drop.exact)
    .sort((a, b) => a.preferred - b.preferred || a.sourceName.localeCompare(b.sourceName));

  for (const drop of exact) {
    taken.add(slotKey(drop.expansion, drop.stage, drop.preferred));
    placed.push({
      sourceName: drop.sourceName,
      expansion: drop.expansion,
      stage: drop.stage,
      number: drop.preferred,
    });
  }

  for (const drop of loose) {
    let number = drop.preferred;
    while (taken.has(slotKey(drop.expansion, drop.stage, number))) {
      number += 1;
    }
    taken.add(slotKey(drop.expansion, drop.stage, number));
    placed.push({
      sourceName: drop.sourceName,
      expansion: drop.expansion,
      stage: drop.stage,
      number,
    });
  }

  return { placed, unknown };
}

export function gameClipPath(placement: DropPlacement): string {
  return [
    '/UI',
    'Ambiance',
    packFolder(placement.expansion),
    `stage${placement.stage}`,
    `${placement.number}.mp3`,
  ].join('/');
}
