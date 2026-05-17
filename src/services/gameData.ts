import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EncounterData,
  EncounterDataMap,
  SolutionData,
  SolutionDataMap,
} from '../engine/types.ts';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

let encounterCache: EncounterDataMap | null = null;
let solutionCache: SolutionDataMap | null = null;

function loadJson<T>(relativePath: string): T {
  const path = join(projectRoot, relativePath);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function getEncounters(): EncounterDataMap {
  if (!encounterCache) {
    encounterCache = loadJson<EncounterDataMap>('game/encountersdata.json');
  }
  return encounterCache;
}

export function getEncounterById(encounterId: number): EncounterData | undefined {
  return getEncounters()[String(encounterId)];
}

export function getSolutionMap(): SolutionDataMap {
  if (!solutionCache) {
    const raw = loadJson<Record<string, SolutionData>>(
      'game/solutiondata.json',
    );
    solutionCache = {};
    for (const entry of Object.values(raw)) {
      solutionCache[String(entry.mSolutionID)] = entry;
    }
  }
  return solutionCache;
}
