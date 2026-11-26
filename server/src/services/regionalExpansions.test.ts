import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pool } from '../db/postgresDocumentStore.js';
import type { EncounterData } from '../engine/types.js';
import { HELD_ENCOUNTER_IDS, isExpansionOpen } from './encounterAvailability.js';
import { selectEncounterInExpansion, selectNextEncounter } from './encounterGenerator.js';
import { getEncounters, getExpansionById } from './gameData.js';
import { ExpansionInactiveError, unlockPlayerExpansion } from './playerService.js';
import { RoomError, travelToExpansion } from './roomService.js';

/**
 * Regional expansions (D-063): the base game is Ethera's Vale. The 79
 * encounters of docs/CONTENT_EXPANSION_ASSIGNMENTS.md are never drawn for the
 * base game, future regions stay closed even to a player whose account lists
 * them, and the existing expansions keep giving their encounters.
 */

/** Every encounter a random draw (no region roll) can give these expansions. */
function randomPool(unlockedExpansions: number[]): EncounterData[] {
  let size = -1;
  selectNextEncounter({ unlockedExpansions, nextInt: (_min, max) => { size = max + 1; return 0; } });
  const drawn: EncounterData[] = [];
  for (let index = 0; index < size; index += 1) {
    drawn.push(selectNextEncounter({ unlockedExpansions, nextInt: () => index }));
  }
  return drawn;
}

const manifest = readFileSync(new URL('../../../docs/CONTENT_EXPANSION_ASSIGNMENTS.md', import.meta.url), 'utf8');
const assigned = [...manifest.matchAll(/^\| (\d{5}) \| [^|]+ \| [^|]+ \| +(\d+) \|/gm)]
  .map((match) => ({ id: Number(match[1]), expansion: Number(match[2]) }));
assert.equal(assigned.length, 79, 'the manifest lists 79 encounters');

const encounters = Object.values(getEncounters());
const byId = new Map(encounters.map((entry) => [entry.mEncounterID, entry]));

// The data follows the manifest; 20009 is held in the base game, not given to Everwinter.
for (const { id, expansion } of assigned) {
  const record = byId.get(id)!;
  if (HELD_ENCOUNTER_IDS.has(id)) {
    assert.equal(record.mEncounterExpansion, 0, `${id} is held, not moved`);
  } else {
    assert.equal(record.mEncounterExpansion, expansion, `${id} belongs to ${expansion}`);
  }
}
assert.equal(byId.get(20127)?.mEncounterExpansion, 1005, 'Eternal Twilight Grove is in Eldertree Forest');

// Existing expansions keep their definitions and encounters; the new ones are inactive.
for (const id of [1001, 1003, 1004]) {
  assert.equal(getExpansionById(id)?.mExtensioActive, true, `${id} stays active`);
}
assert.equal(getExpansionById(1002)?.mExtensioActive, false, 'Urcogor Ravage stays an inactive event');
for (let id = 1005; id <= 1014; id += 1) {
  const expansion = getExpansionById(id);
  assert.equal(expansion?.mExtensioActive, false, `${id} is inactive`);
  assert.equal(expansion?.mExtensioListed, false, `${id} is not listed in the Expansions menu`);
  assert.equal(expansion?.mExtensioCost, undefined, `${id} has no invented price`);
  assert.equal(isExpansionOpen(id), false);
}
const counts = new Map<number, number>();
for (const record of encounters) {
  counts.set(record.mEncounterExpansion, (counts.get(record.mEncounterExpansion) ?? 0) + 1);
}
assert.deepEqual(
  Object.fromEntries([...counts].sort((left, right) => left[0] - right[0])),
  { 0: 52, 1001: 48, 1003: 20, 1004: 5, 1005: 22, 1006: 9, 1007: 10, 1008: 7, 1009: 7, 1010: 7, 1011: 5, 1012: 4, 1013: 6, 1014: 1 },
  '203 records: 51 Vale and universal + held 20009, 73 existing, 78 moved',
);

// A base-game player draws only the Vale: none of the 79, not the held one.
const base = randomPool([0]);
const assignedIds = new Set(assigned.map((entry) => entry.id));
assert.ok(base.length > 0);
assert.ok(base.every((record) => record.mEncounterExpansion === 0 && !assignedIds.has(record.mEncounterID)),
  'no out-of-Vale encounter in a base-game draw');

// A player with every active expansion draws those too, still none of the 79.
const owner = randomPool([0, 1001, 1003, 1004]);
const randomIn = (expansion: number) => encounters
  .filter((record) => record.mEncounterExpansion === expansion && record.mEncounterID >= 20001).length;
assert.equal(owner.length, base.length + randomIn(1001) + randomIn(1003) + randomIn(1004),
  'Keldor, Everwinter and Aetherion keep their random encounters');
assert.equal(randomIn(1001) + randomIn(1003) + randomIn(1004), 41 + 20 + 5);
assert.ok(owner.every((record) => !assignedIds.has(record.mEncounterID)));

// An account that somehow lists a future region still gets nothing from it.
const forged = randomPool([0, 1005, 1006, 1007, 1014]);
assert.equal(forged.length, base.length, 'a closed region is closed even to an account that lists it');

// Travel draws: the held encounter never, even when asked for its land directly.
for (let index = 0; index < 60; index += 1) {
  assert.notEqual(selectEncounterInExpansion(0, [], getEncounters(), () => index % 52)?.mEncounterID ?? 0, 20009);
}

// Travel and unlocking refuse a closed region before anything is read or charged.
await assert.rejects(
  travelToExpansion('nobody', 'no-avatar', 1005),
  (error: unknown) => error instanceof RoomError && error.code === 'UNKNOWN_DESTINATION',
);
await assert.rejects(unlockPlayerExpansion('nobody', 1006), ExpansionInactiveError);

await pool.end();
console.log('regionalExpansions.test.ts passed');
