import assert from 'node:assert/strict';

import { chooseHelpRecipientIds } from './helpRecipients.js';

const sequence = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
let cursor = 0;
const random = (): number => {
  const value = sequence[cursor % sequence.length] ?? 0;
  cursor += 1;
  return value;
};

const fiveFriends = chooseHelpRecipientIds(
  ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
  ['s1', 's2', 's3'],
  random,
);
assert.equal(fiveFriends.friendIds.length, 5);
assert.deepEqual(fiveFriends.strangerIds, []);
assert.equal(new Set(fiveFriends.friendIds).size, 5);
for (const friendId of fiveFriends.friendIds) {
  assert.ok(['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].includes(friendId));
}

cursor = 0;
const mixed = chooseHelpRecipientIds(['f1', 'f2'], ['s1', 's2', 's3', 's4'], random);
assert.deepEqual(mixed.friendIds.length, 2);
assert.equal(mixed.strangerIds.length, 3);
assert.equal(new Set([...mixed.friendIds, ...mixed.strangerIds]).size, 5);

cursor = 0;
const strangersOnly = chooseHelpRecipientIds([], ['s1', 's2', 's3', 's4', 's5', 's6'], random);
assert.deepEqual(strangersOnly.friendIds, []);
assert.equal(strangersOnly.strangerIds.length, 5);
