import type { AmbianceStage } from './ambianceCycle.js';

export interface DropPlacement {
  sourceName: string;
  expansion: number;
  stage: AmbianceStage;
  number: number;
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
    String(placement.expansion),
    `stage${placement.stage}`,
    `${placement.number}.mp3`,
  ].join('/');
}
