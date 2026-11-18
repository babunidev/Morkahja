import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  getEncounterRoom,
  pool,
  setAvatar,
  setEncounterRoom,
  sweepAbandonedRooms,
  withDocumentTransaction,
} from '../db/postgresDocumentStore.js';

// D-048: closed rooms are not kept, and rooms nobody can return to are swept.
const run = randomUUID().slice(0, 8);
const playerId = `cleanup-player-${run}`;
const livingAvatar = `cleanup-living-${run}`;
const deadAvatar = `cleanup-dead-${run}`;
const day = 24 * 60 * 60 * 1000;
const now = Date.now();

await setAvatar(playerId, livingAvatar, { id: livingAvatar, status: 'active' });
await setAvatar(playerId, deadAvatar, { id: deadAvatar, status: 'deceased' });
const lonelyAvatar = `cleanup-lonely-${run}`;
await setAvatar(playerId, lonelyAvatar, { id: lonelyAvatar, status: 'active' });

function room(roomId: string, avatarId: string | null, updatedAt: number, roomState = 'active_encounter') {
  return {
    roomId,
    roomState,
    leaderPlayerId: playerId,
    participants: avatarId ? [{ playerId, avatarId, slotIndex: 0, choiceState: 'choosing' }] : [],
    updatedAt,
  };
}

// Saving a room as closed deletes it, outside and inside a transaction.
const closedDirect = `cleanup-closed-direct-${run}`;
await setEncounterRoom(closedDirect, room(closedDirect, livingAvatar, now));
assert.ok(await getEncounterRoom(closedDirect));
await setEncounterRoom(closedDirect, room(closedDirect, livingAvatar, now, 'closed'));
assert.equal(await getEncounterRoom(closedDirect), null, 'a room saved as closed is deleted');

const closedInTransaction = `cleanup-closed-tx-${run}`;
await setEncounterRoom(closedInTransaction, room(closedInTransaction, livingAvatar, now));
await withDocumentTransaction(async (transaction) => {
  await transaction.getEncounterRoom(closedInTransaction);
  await transaction.setEncounterRoom(closedInTransaction, room(closedInTransaction, livingAvatar, now, 'closed'));
});
assert.equal(await getEncounterRoom(closedInTransaction), null, 'a room closed in a transaction is deleted');

// The sweep: what goes and what stays.
const ids = {
  legacyClosed: `cleanup-legacy-closed-${run}`,
  dead: `cleanup-dead-room-${run}`,
  missingAvatar: `cleanup-missing-${run}`,
  empty: `cleanup-empty-${run}`,
  untouched: `cleanup-untouched-${run}`,
  pausedRecent: `cleanup-paused-${run}`,
  olderSolo: `cleanup-older-solo-${run}`,
  olderParty: `cleanup-older-party-${run}`,
};
// A closed row left by an older release (written past the new save rule).
await pool.query('INSERT INTO encounter_rooms (id, data) VALUES ($1, $2::jsonb)', [
  ids.legacyClosed,
  JSON.stringify(room(ids.legacyClosed, livingAvatar, now, 'closed')),
]);
await setEncounterRoom(ids.dead, room(ids.dead, deadAvatar, now));
await setEncounterRoom(ids.missingAvatar, room(ids.missingAvatar, `cleanup-nobody-${run}`, now));
await setEncounterRoom(ids.empty, room(ids.empty, null, now));
await setEncounterRoom(ids.untouched, room(ids.untouched, lonelyAvatar, now - 31 * day));
await setEncounterRoom(ids.pausedRecent, room(ids.pausedRecent, livingAvatar, now - 29 * day));
// Older than the paused room for the same avatar: superseded when alone in it.
await setEncounterRoom(ids.olderSolo, room(ids.olderSolo, livingAvatar, now - 29 * day - 1000));
const olderParty = room(ids.olderParty, livingAvatar, now - 29 * day - 2000);
olderParty.participants.push({ playerId: `cleanup-friend-${run}`, avatarId: livingAvatar, slotIndex: 1, choiceState: 'choosing' });
await setAvatar(`cleanup-friend-${run}`, livingAvatar, { id: livingAvatar, status: 'active' });
await setEncounterRoom(ids.olderParty, olderParty);

const counted = await sweepAbandonedRooms({ dryRun: true, now });
assert.ok(counted.closed >= 1 && counted.withoutLivingAvatar >= 3 && counted.superseded >= 1 && counted.untouched >= 1);
assert.ok(await getEncounterRoom(ids.legacyClosed), 'a dry run deletes nothing');

const removed = await sweepAbandonedRooms({ now });
assert.ok(removed.closed >= 1 && removed.withoutLivingAvatar >= 3 && removed.superseded >= 1 && removed.untouched >= 1);
for (const id of [ids.legacyClosed, ids.dead, ids.missingAvatar, ids.empty, ids.untouched, ids.olderSolo]) {
  assert.equal(await getEncounterRoom(id), null, `${id} is swept`);
}
assert.ok(await getEncounterRoom(ids.pausedRecent), 'a living avatar\'s paused room younger than 30 days stays');
assert.ok(await getEncounterRoom(ids.olderParty), 'an older room shared with another player stays');

await pool.query('DELETE FROM encounter_rooms WHERE id = ANY($1)', [[ids.pausedRecent, ids.olderParty]]);
await pool.query('DELETE FROM avatars WHERE player_id = ANY($1)', [[playerId, `cleanup-friend-${run}`]]);
await pool.end();
console.log('roomCleanup.test.ts passed');
