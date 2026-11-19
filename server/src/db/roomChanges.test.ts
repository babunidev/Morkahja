import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { pool, setEncounterRoom, withDocumentTransaction } from './postgresDocumentStore.js';
import { roomChangeVersion, waitForRoomChange } from './roomChanges.js';

// A waiting GET /room/active answers when the room is saved, not seconds later.
const roomId = `room-changes-${randomUUID().slice(0, 8)}`;
const room = (roomState: string) => ({ roomId, roomState, participants: [], updatedAt: Date.now() });

// Saved outside a transaction: the waiter wakes at once.
let since = roomChangeVersion(roomId);
let started = Date.now();
const direct = waitForRoomChange(roomId, since, 5_000);
await setEncounterRoom(roomId, room('active_encounter'));
await direct;
assert.ok(Date.now() - started < 1_000, 'a direct save wakes the waiter');

// Saved inside a transaction: the waiter wakes after COMMIT, never before.
since = roomChangeVersion(roomId);
let committed = false;
started = Date.now();
const inTransaction = waitForRoomChange(roomId, since, 5_000).then(() => {
  assert.ok(committed, 'the waiter wakes only after the commit');
});
await withDocumentTransaction(async (transaction) => {
  await transaction.setEncounterRoom(roomId, room('waiting_continue'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  committed = true;
});
await inTransaction;
assert.ok(Date.now() - started < 1_000);

// A rolled-back save wakes nobody.
since = roomChangeVersion(roomId);
await withDocumentTransaction(async (transaction) => {
  await transaction.setEncounterRoom(roomId, room('active_encounter'));
  throw new Error('rollback');
}).catch(() => undefined);
assert.equal(roomChangeVersion(roomId), since, 'a rolled-back save is not announced');

// A change that happened before the wait began is not missed.
since = roomChangeVersion(roomId);
await setEncounterRoom(roomId, room('active_encounter'));
started = Date.now();
await waitForRoomChange(roomId, since, 5_000);
assert.ok(Date.now() - started < 50, 'an earlier change answers at once');

// Nothing changes: the wait ends at its timeout; a closed request ends it early.
since = roomChangeVersion(roomId);
started = Date.now();
await waitForRoomChange(roomId, since, 200);
assert.ok(Date.now() - started >= 190, 'without a change the wait lasts until the timeout');
const closed = new AbortController();
started = Date.now();
setTimeout(() => closed.abort(), 50);
await waitForRoomChange(roomId, since, 5_000, closed.signal);
assert.ok(Date.now() - started < 1_000, 'a closed request stops waiting');

// Closing the room deletes it and wakes the waiter too.
since = roomChangeVersion(roomId);
const onClose = waitForRoomChange(roomId, since, 5_000);
started = Date.now();
await setEncounterRoom(roomId, room('closed'));
await onClose;
assert.ok(Date.now() - started < 1_000, 'closing the room wakes the waiter');

await pool.end();
console.log('roomChanges.test.ts passed');
