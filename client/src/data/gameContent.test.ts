import assert from 'node:assert/strict';

import {
  gameContentVersion,
  gameSolutions,
  setGameContent,
} from './gameContent.js';
import type { GameContentDto } from '@shared/contracts';

assert.throws(() => gameSolutions(), /before it finished loading/);

const valid: GameContentDto = {
  version: 'abc123',
  encounters: { 19001: { mEncounterID: 19001 } },
  solutions: { 10001: { mSolutionID: 10001 } },
  expansions: {},
  frames: [null, { frameID: 1 }],
  portraits: [null, { avatarID: 1 }],
};

assert.throws(() => setGameContent({ ...valid, solutions: {} }), /incomplete/);
assert.throws(() => setGameContent({ ...valid, frames: [{ frameID: 1 }] }), /incomplete/);
assert.equal(gameContentVersion(), null, 'rejected content is not installed');

setGameContent(valid);
assert.equal(gameContentVersion(), 'abc123');
assert.deepEqual(gameSolutions(), valid.solutions);

console.log('gameContent.test.ts passed');
