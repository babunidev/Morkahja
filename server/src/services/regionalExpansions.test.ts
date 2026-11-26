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

// The data follows the manifest, as Babuni corrected it on 2026-11-26: the
// Evergrove review and the Grimnir Vault in Celesterra.
const REVIEWED: Record<number, number> = {
  20009: 1009, 20010: 1005, 20016: 1005, 20021: 1005, 20024: 1005, 20029: 1005, 20033: 0, 20191: 0,
};
assert.equal(HELD_ENCOUNTER_IDS.size, 0, 'nothing is held any more');
for (const { id, expansion } of assigned) {
  const want = REVIEWED[id] ?? expansion;
  assert.equal(byId.get(id)!.mEncounterExpansion, want, `${id} belongs to ${want}`);
}
assert.equal(byId.get(20127)?.mEncounterExpansion, 1005, 'Eternal Twilight Grove is in Eldertree Forest');

// Existing expansions keep their definitions and encounters; the new ones are inactive.
for (const id of [1001, 1003, 1004]) {
  assert.equal(getExpansionById(id)?.mExtensioActive, true, `${id} stays active`);
}
assert.equal(getExpansionById(1002)?.mExtensioActive, false, 'Urcogor Ravage stays an inactive event');
// Listed as coming soon with a gem price only (Babuni, 2026-11-26): big 75, medium 50, small 25.
const GEMS: Record<number, number> = {
  1005: 50, 1006: 50, 1007: 75, 1008: 50, 1009: 75, 1010: 50, 1011: 25, 1012: 50, 1013: 75, 1014: 50,
};
// The three homelands are open to whoever earned them (Babuni, 2026-11-26); the rest are coming soon.
const HOMELANDS = new Set([1007, 1009, 1010]);
for (let id = 1005; id <= 1014; id += 1) {
  const expansion = getExpansionById(id);
  const homeland = HOMELANDS.has(id);
  assert.equal(expansion?.mExtensioActive, homeland, `${id} is ${homeland ? 'open' : 'inactive'}`);
  assert.equal((expansion?.mExtensioHomelandOf?.length ?? 0) > 0, homeland);
  assert.notEqual(expansion?.mExtensioListed, false, `${id} is listed in the Expansions menu`);
  assert.equal(expansion?.mExtensioCost, GEMS[id], `${id} costs ${GEMS[id]} gems`);
  assert.equal(expansion?.mExtensioPriceEurCents, undefined, `${id} has no money price yet`);
  assert.ok(expansion?.mExtensioHeaderImage && expansion.mExtensioText, `${id} has a banner and a text`);
  assert.equal(isExpansionOpen(id), homeland);
}
const counts = new Map<number, number>();
for (const record of encounters) {
  counts.set(record.mEncounterExpansion, (counts.get(record.mEncounterExpansion) ?? 0) + 1);
}
assert.deepEqual(
  Object.fromEntries([...counts].sort((left, right) => left[0] - right[0])),
  { 0: 53, 1001: 48, 1003: 20, 1004: 5, 1005: 27, 1006: 9, 1007: 3, 1008: 7, 1009: 8, 1010: 7, 1011: 5, 1012: 4, 1013: 6, 1014: 1 },
  '203 records: 51 Vale and universal + the Ogru and the Bloodfang, 73 existing, 77 regional',
);

// A base-game player draws only the Vale: 49 encounters, none of the 77 regional ones.
const base = randomPool([0]);
const assignedIds = new Set(assigned.map((entry) => entry.id).filter((id) => REVIEWED[id] !== 0));
assert.equal(base.length, 49);
assert.ok(base.every((record) => record.mEncounterExpansion === 0 && !assignedIds.has(record.mEncounterID)),
  'no out-of-Vale encounter in a base-game draw');
assert.ok(base.some((record) => record.mEncounterID === 20191) && base.some((record) => record.mEncounterID === 20033),
  'the Ogru and the Bloodfang are back in the Vale');

// A player with every active expansion draws those too, still none of the 79.
const owner = randomPool([0, 1001, 1003, 1004]);
const randomIn = (expansion: number) => encounters
  .filter((record) => record.mEncounterExpansion === expansion && record.mEncounterID >= 20001).length;
assert.equal(owner.length, base.length + randomIn(1001) + randomIn(1003) + randomIn(1004),
  'Keldor, Everwinter and Aetherion keep their random encounters');
assert.equal(randomIn(1001) + randomIn(1003) + randomIn(1004), 41 + 20 + 5);
assert.ok(owner.every((record) => !assignedIds.has(record.mEncounterID)));

// An account that somehow lists a future region still gets nothing from it.
const forged = randomPool([0, 1005, 1006, 1014]);
assert.equal(forged.length, base.length, 'a closed region is closed even to an account that lists it');

// An earned homeland gives its encounters, by chance and by travel.
const verdani = randomPool([0, 1007]);
assert.equal(verdani.length, base.length + randomIn(1007), 'Evergrove plays once earned');
assert.ok(selectEncounterInExpansion(1007, [], getEncounters(), () => 0));

// Travel (Babuni, 2026-11-26): a random encounter from the destination's own
// pool, every one of them possible, never one from elsewhere.
for (const destination of [0, 1001, 1003, 1004, 1007, 1009, 1010]) {
  const pool = encounters.filter((record) => record.mEncounterExpansion === destination && record.mEncounterID >= 20001);
  const picked = new Set(pool.map((_, index) => selectEncounterInExpansion(destination, [], getEncounters(), () => index)?.mEncounterID));
  assert.equal(picked.size, pool.length, `travel to ${destination} can give each of its ${pool.length} encounters`);
  assert.ok([...picked].every((id) => byId.get(id!)?.mEncounterExpansion === destination), `travel to ${destination} stays in its pool`);
  if (pool.length > 1) {
    const recent = selectEncounterInExpansion(destination, [pool[0]!.mEncounterID], getEncounters(), () => 0)?.mEncounterID;
    assert.notEqual(recent, pool[0]!.mEncounterID, `travel to ${destination} skips a recent encounter`);
  }
}

// Travel to Celesterra can give the Grimnir Vault once the land opens.
const celesterra = Array.from({ length: 8 }, (_, index) => selectEncounterInExpansion(1009, [], getEncounters(), () => index)?.mEncounterID);
assert.ok(celesterra.includes(20009));

// Travel and unlocking refuse a closed region before anything is read or charged.
await assert.rejects(
  travelToExpansion('nobody', 'no-avatar', 1005),
  (error: unknown) => error instanceof RoomError && error.code === 'UNKNOWN_DESTINATION',
);
await assert.rejects(unlockPlayerExpansion('nobody', 1006), ExpansionInactiveError);

await pool.end();
console.log('regionalExpansions.test.ts passed');
