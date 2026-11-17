import assert from 'node:assert/strict';
import { BASE_REGION_NAME, regionNameFor, regionTitleCase } from './regionName.js';

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

console.log('regionName.test.ts passed');
