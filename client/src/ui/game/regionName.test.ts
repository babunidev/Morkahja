import assert from 'node:assert/strict';
import { BASE_REGION_NAME, plateLabelFor, regionNameFor, regionTitleCase } from './regionName.js';

const encounters = {
  '19001': { mEncounterExpansion: 0 },
  '20001': { mEncounterExpansion: 1001 },
  '20002': { mEncounterExpansion: 1003 },
  '20003': { mEncounterExpansion: 1009 },
};
const expansions = {
  '1001': { mExtensioName: 'The cursed forest of Keldor' },
  '1003': { mExtensioName: 'Everwinter Valley' },
};

assert.equal(regionNameFor(encounters, expansions, 19001), BASE_REGION_NAME);
assert.equal(BASE_REGION_NAME, "Ethera's Vale");
assert.equal(regionNameFor(encounters, expansions, 20001), 'The Cursed Forest of Keldor');
assert.equal(regionNameFor(encounters, expansions, 20002), 'Everwinter Valley');
assert.equal(regionNameFor(encounters, expansions, 20003), null);
assert.equal(regionNameFor(encounters, expansions, 99999), null);
assert.equal(regionTitleCase('the land of the dead'), 'The Land of the Dead');

// The plate names the encounter's own land from the placement list (2026-11-17).
const places = { 20001: { label: 'Swamp of Karrhu' }, 2: null };
assert.equal(plateLabelFor(20001, places, encounters, expansions), 'Swamp of Karrhu');
assert.equal(plateLabelFor(1, places, encounters, expansions), 'Atranor');
assert.equal(plateLabelFor(2, places, encounters, expansions), undefined, 'the level-up keeps the land shown');
assert.equal(plateLabelFor(20002, places, encounters, expansions), 'Everwinter Valley', 'not in the list: the expansion');

console.log('regionName.test.ts passed');
