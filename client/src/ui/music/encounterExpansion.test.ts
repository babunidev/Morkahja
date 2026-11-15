import assert from 'node:assert/strict';

import { expansionFromEncounterMap } from './encounterExpansion.js';

const encounters = {
  '00002': { mEncounterExpansion: 0 },
  '10042': { mEncounterExpansion: 1001 },
  '00007': { mEncounterTitle: 'Missing expansion' },
};

assert.equal(expansionFromEncounterMap(encounters, 2), 0);
assert.equal(expansionFromEncounterMap(encounters, 10042), 1001);
assert.equal(expansionFromEncounterMap(encounters, 7), null);
assert.equal(expansionFromEncounterMap(encounters, 99), null);
