import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { interpretRoll } from './engine/diceInterpreter.js';
import { generateEncounterRollSnapshot } from './engine/encounterRollGenerator.js';
import {
  createEncounterRollSnapshot,
  resolveEncounter,
} from './engine/encounterResolver.js';
import type {
  EncounterResolution,
  EncounterRollSnapshot,
  SelectedEncounterAction,
} from './engine/encounterResolver.js';
import type {
  EncounterData,
  EncounterDataMap,
  SolutionData,
  SolutionDataMap,
} from './engine/types.js';
import { ENCOUNTER_SLOTS } from './engine/types.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface TestPlayerFile {
  inventory: number[];
  encounterId?: number;
  rolls: EncounterRollSnapshot;
  selectedAction: SelectedEncounterAction;
  /** When true, ignore rolls in file and generate a fresh snapshot once. */
  generateRolls?: boolean;
}

function loadJson<T>(relativePath: string): T {
  const path = join(projectRoot, relativePath);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function buildSolutionMap(
  raw: Record<string, SolutionData>,
): SolutionDataMap {
  const map: SolutionDataMap = {};

  for (const entry of Object.values(raw)) {
    map[String(entry.mSolutionID)] = entry;
  }

  return map;
}

function selectEncounter(
  encounters: EncounterDataMap,
  preferredId?: number,
): EncounterData {
  if (preferredId !== undefined) {
    const key = String(preferredId);
    const encounter = encounters[key];
    if (!encounter) {
      throw new Error(`Encounter not found: ${preferredId}`);
    }
    return encounter;
  }

  const firstKey = Object.keys(encounters).sort(
    (a, b) => Number(a) - Number(b),
  )[0];

  if (!firstKey) {
    throw new Error('No encounters in encountersdata.json');
  }

  return encounters[firstKey];
}

function printSummary(
  encounter: EncounterData,
  result: EncounterResolution,
  rolls: EncounterRollSnapshot,
  selectedAction: SelectedEncounterAction,
): void {
  const title =
    encounter.mEncounterTitle || `Encounter ${encounter.mEncounterID}`;
  const outcome = result.success ? 'SUCCESS' : 'FAILURE';

  console.log(`Encounter: ${title} (id ${encounter.mEncounterID})`);
  console.log(`Outcome:   ${outcome}`);
  console.log(`Action:    ${JSON.stringify(selectedAction)}`);
  console.log(`Message:   ${result.message}`);
  console.log('Roll snapshot (A/C primary 61–100, B/D secondary 40–100, E dice 1–100):');
  const labels: Array<[keyof EncounterRollSnapshot, string]> = [
    ['rollA', 'A primary'],
    ['rollB', 'B secondary'],
    ['rollC', 'C primary'],
    ['rollD', 'D secondary'],
    ['rollE', 'E dice'],
  ];
  for (const [key, label] of labels) {
    const value = rolls[key];
    console.log(`  ${label}: ${value} → ${interpretRoll(value) ?? '—'}`);
  }
  console.log('Slots:');
  for (const slot of ENCOUNTER_SLOTS) {
    const lane = slot === 'A' || slot === 'C' ? 'primary' : 'secondary';
    const ok = result.slotResults[slot];
    console.log(`  ${slot} (${lane}): ${ok ? 'satisfied' : 'failed'}`);
  }
  console.log(`Used inventory solutions: [${result.usedInventorySolutions.join(', ')}]`);
  console.log(`Failure penalty: ${result.failurePenalty}`);
  if (result.rewards.length > 0) {
    console.log(`Rewards: [${result.rewards.join(', ')}]`);
  } else {
    console.log('Rewards: (none)');
  }
}

function main(): void {
  const encounters = loadJson<EncounterDataMap>('game/encountersdata.json');
  const solutionsRaw = loadJson<Record<string, SolutionData>>(
    'game/solutiondata.json',
  );
  const testPlayer = loadJson<TestPlayerFile>('game/player/testPlayer.json');

  const encounter = selectEncounter(encounters, testPlayer.encounterId);
  const solutionMap = buildSolutionMap(solutionsRaw);

  const rolls = testPlayer.generateRolls
    ? generateEncounterRollSnapshot()
    : createEncounterRollSnapshot(testPlayer.rolls);

  const result = resolveEncounter(
    encounter,
    testPlayer.inventory,
    solutionMap,
    rolls,
    testPlayer.selectedAction,
  );

  console.log('--- Raw result ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
  console.log('--- Summary ---');
  printSummary(encounter, result, rolls, testPlayer.selectedAction);
}

main();
