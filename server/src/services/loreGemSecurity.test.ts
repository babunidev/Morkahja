import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createRoom } from './roomService.js';
import { activateRoomLoreGem, LoreGemError } from './loreGemService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import { getPlayer, pool, setPlayer, withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { grantPlayerYellowRedGemsInTransaction } from './playerService.js';
import { savePlayerAvatar } from './playerService.js';
import type { PlayerDocument } from '../types/player.js';

const playerId = `lore-security-${randomUUID()}`;
const avatarId = `lore-security-avatar-${randomUUID()}`;
await setPlayer(playerId, {
  playerId, playerName: 'Lore Security Test', unlockedExpansions: [0],
  currencies: { yellow_red_gem: 0 },
});
await savePlayerAvatar(playerId, {
  id: avatarId, name: 'Lore Security', race: 'Rokur', role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior', frame: 'm_frame_01', createdAt: Date.now(),
});
let room = await createRoom(playerId, avatarId);
const snapshotId = room.activeEncounterSnapshot.snapshotId;
const makeOffer = (claimableAt: number) => ({
  eligible: true, claimableAt, offeredAt: claimableAt - 15_000, durationMs: 15_000,
});
const future = Date.now() + 90_000;
room = {
  ...room,
  activeEncounterSnapshot: { ...room.activeEncounterSnapshot, loreGemOffer: makeOffer(future) },
  slotEncounterSnapshots: room.slotEncounterSnapshots.map((slot) => ({
    ...slot, loreGemOffer: makeOffer(future),
  })) as typeof room.slotEncounterSnapshots,
};
await saveEncounterRoom(room);

await assert.rejects(
  activateRoomLoreGem(playerId, avatarId, snapshotId),
  (error: unknown) => error instanceof LoreGemError && error.statusCode === 409,
  'early activation must be rejected by the server',
);
assert.equal((await loadEncounterRoom(room.roomId))?.loreGemActivated, undefined);

const past = Date.now() - 1;
room = {
  ...room,
  activeEncounterSnapshot: { ...room.activeEncounterSnapshot, loreGemOffer: makeOffer(past) },
  slotEncounterSnapshots: room.slotEncounterSnapshots.map((slot) => ({
    ...slot, loreGemOffer: makeOffer(past),
  })) as typeof room.slotEncounterSnapshots,
};
await saveEncounterRoom(room);
const [first, second] = await Promise.all([
  activateRoomLoreGem(playerId, avatarId, snapshotId),
  activateRoomLoreGem(playerId, avatarId, snapshotId),
]);
assert.equal(first.activated, true);
assert.equal(second.activated, true);
assert.equal((await loadEncounterRoom(room.roomId))?.participants[0]?.loreGemCollected, true);

const claimKey = `${snapshotId}:${playerId}`;
const rewards = await Promise.all([
  withDocumentTransaction((tx) => grantPlayerYellowRedGemsInTransaction(tx, playerId, 1, claimKey)),
  withDocumentTransaction((tx) => grantPlayerYellowRedGemsInTransaction(tx, playerId, 1, claimKey)),
]);
assert.deepEqual(rewards.map((value) => value.granted).sort(), [false, true]);
assert.equal((await getPlayer<PlayerDocument>(playerId))?.currencies?.yellow_red_gem, 1);
await pool.end();
console.log('loreGemSecurity.test.ts passed');
