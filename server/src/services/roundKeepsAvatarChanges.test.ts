import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createRoom, submitChoice, submitContinue } from './roomService.js';
import { saveEncounterRoom } from './roomPersistence.js';
import { avatarAfterRound } from './encounterGenerator.js';
import { pool, setPlayer, withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { savePlayerAvatar } from './playerService.js';
import type { AvatarDocument } from '../types/avatar.js';

// Roadmap bug (fixed 2026-11-24): a round's prepared result held a full copy of
// the avatar and saved it back on Continue, undoing changes made in between.

// The round's own fields win; everything else stays as it is now.
const live = {
  name: 'Renamed', level: 3, experience: 10, profile: { displayTitle: 'New Title' },
  specialization: 8, progression: { lastEncounterId: 1, other: 'kept' },
} as unknown as AvatarDocument;
const prepared = {
  name: 'Old Name', level: 4, experience: 0, profile: { displayTitle: null },
  specialization: null, lastPlayedAt: 123, progression: { lastEncounterId: 99 },
} as unknown as AvatarDocument;
const merged = avatarAfterRound(live, prepared);
assert.equal(merged.name, 'Renamed');
assert.equal(merged.specialization, 8);
assert.deepEqual(merged.profile, { displayTitle: 'New Title' });
assert.equal(merged.level, 4);
assert.equal(merged.experience, 0);
assert.equal(merged.lastPlayedAt, 123);
assert.deepEqual(merged.progression, { lastEncounterId: 99, other: 'kept' });

// The same through a real round: choose, change the avatar, then Continue.
const playerId = `round-keeps-${randomUUID()}`;
const avatarId = `round-keeps-avatar-${randomUUID()}`;
await setPlayer(playerId, {
  playerId, playerName: 'Round Keeps Test', unlockedExpansions: [0],
  currencies: { yellow_red_gem: 0 },
});
await savePlayerAvatar(playerId, {
  id: avatarId, name: 'Before', race: 'Rokur', role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior', frame: 'm_frame_01', createdAt: Date.now(),
});
const created = await createRoom(playerId, avatarId);
// Skip the wait before the first choice, as roomService.test.ts does.
const room = {
  ...created,
  activeEncounterSnapshot: { ...created.activeEncounterSnapshot, actionReadyAt: Date.now() - 1 },
  updatedAt: Date.now(),
};
await saveEncounterRoom(room);
const encounterId = room.activeEncounterSnapshot.encounterId;
const chosen = await submitChoice(playerId, avatarId, 'dice');
assert.equal(chosen.participants[0]?.choiceState, 'ready_to_continue');

await withDocumentTransaction(async (transaction) => {
  const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
  await transaction.setAvatar(playerId, avatarId, {
    name: 'After',
    specialization: 8,
    profile: { ...avatar!.profile, displayTitle: 'Changed Mid-Round' },
  }, { merge: true });
});

await submitContinue(playerId, avatarId);
const after = await withDocumentTransaction((transaction) =>
  transaction.getAvatar<AvatarDocument>(playerId, avatarId));
assert.equal(after?.name, 'After');
assert.equal(after?.specialization, 8);
assert.equal(after?.profile?.displayTitle, 'Changed Mid-Round');
assert.equal(after?.progression?.lastEncounterId, encounterId, 'the round itself was still saved');

await pool.end();
console.log('roundKeepsAvatarChanges.test.ts passed');
