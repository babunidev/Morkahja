import assert from 'node:assert/strict';

import { witnessWaitingLabel } from './witnessSystemEventDisplay.js';

assert.equal(
  witnessWaitingLabel('atranor', 'Rokoran', 'Rokur'),
  "Witnessing the Ignis Council's judgment of Rokoran…",
);
assert.equal(
  witnessWaitingLabel('atranor', 'Vela', 'Verdani'),
  "Witnessing the Abyssal Conclave's judgment of Vela…",
);
assert.equal(
  witnessWaitingLabel('atranor', 'Kree', 'Aevis'),
  "Witnessing the Celestial Convocation's judgment of Kree…",
);
assert.equal(
  witnessWaitingLabel('atranor', 'Dorn', 'Grimnir'),
  "Witnessing the Terran Assembly's judgment of Dorn…",
);
assert.equal(witnessWaitingLabel('atranor', 'Nemo', 'Unknown'), "Witnessing the gods' judgment of Nemo…");
assert.equal(witnessWaitingLabel('level_up', 'Rokoran', 'Rokur'), "Witnessing Rokoran's fate…");
assert.equal(witnessWaitingLabel('atranor', undefined, 'Rokur'), 'Witnessing a shared moment…');

console.log('witnessSystemEventDisplay.test.ts passed');
