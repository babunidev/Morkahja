import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { DEATH_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import { ensureAvatar } from './encounterGenerator.js';
import { savePlayerAvatar } from './playerService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  joinRoom,
  RoomError,
  submitChoice,
} from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

const actorIdentity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const witnessIdentity = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const actorSession = await bootstrapTestSession(
  actorIdentity,
  JSON.stringify(actorIdentity.publicKey.export({ format: 'jwk' })),
  `sys-join-actor-${Date.now()}`,
);

const witnessSession = await bootstrapTestSession(
  witnessIdentity,
  JSON.stringify(witnessIdentity.publicKey.export({ format: 'jwk' })),
  `sys-join-witness-${Date.now()}`,
);

const actorAvatarId = `avatar-sys-join-actor-${Date.now()}`;
const witnessAvatarId = `avatar-sys-join-witness-${Date.now()}`;

await savePlayerAvatar(actorSession.playerId, {
  id: actorAvatarId,
  name: 'Atranor Actor',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

await savePlayerAvatar(witnessSession.playerId, {
  id: witnessAvatarId,
  name: 'Atranor Witness',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

await ensureAvatar(actorSession.playerId, actorAvatarId, {
  id: actorAvatarId,
  name: 'Atranor Actor',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);

await ensureAvatar(witnessSession.playerId, witnessAvatarId, {
  id: witnessAvatarId,
  name: 'Atranor Witness',
  profile: { raceRewardType: 41, roleRewardType: 38 },
} as never);

let room = await createRoom(actorSession.playerId, actorAvatarId);
const actorSlotIndex = room.participants[0]!.slotIndex;
const snapshotIdBefore = room.activeEncounterSnapshot.snapshotId;

room = {
  ...room,
  activeEncounterSnapshot: {
    ...room.activeEncounterSnapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot, index) => ({
    ...snapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    rollE: index === actorSlotIndex ? 10 : 50,
    actionReadyAt: Date.now() - 1,
  })) as EncounterRoom['slotEncounterSnapshots'],
  roomState: 'system_event',
  systemEvent: {
    queue: [{
      actorPlayerId: actorSession.playerId,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    }],
    queueIndex: 0,
    lineage: {
      originEncounterId: room.activeEncounterSnapshot.encounterId,
      originEncounterFollow: room.activeEncounterSnapshot.encounterFollow,
      originRollOutcome: 'Misery',
      originSuccess: false,
    },
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(room);

const afterRoll = await submitChoice(actorSession.playerId, actorAvatarId, 'dice');
const actorAfterRoll = afterRoll.participants.find((entry) => entry.playerId === actorSession.playerId);
assert.equal(afterRoll.roomState, 'system_event');
assert.equal(actorAfterRoll?.choiceState, 'ready_to_continue');
assert.equal(actorAfterRoll?.preparedResult?.success, false);
assert.equal(afterRoll.activeEncounterSnapshot.snapshotId, snapshotIdBefore);
assert.equal(
  afterRoll.slotEncounterSnapshots[actorSlotIndex].rollE,
  10,
);

const joinedRoom = await joinRoom(witnessSession.playerId, witnessAvatarId, room.roomId);
const actorAfterJoin = joinedRoom.participants.find(
  (entry) => entry.playerId === actorSession.playerId,
);
const witnessAfterJoin = joinedRoom.participants.find(
  (entry) => entry.playerId === witnessSession.playerId,
);

assert.equal(joinedRoom.roomState, 'system_event');
assert.equal(joinedRoom.activeEncounterSnapshot.snapshotId, snapshotIdBefore);
assert.equal(joinedRoom.slotEncounterSnapshots[actorSlotIndex].rollE, 10);
assert.equal(actorAfterJoin?.choiceState, 'ready_to_continue');
assert.equal(actorAfterJoin?.preparedResult?.success, false);
assert.equal(actorAfterJoin?.preparedResult?.selectedRoll, actorAfterRoll?.preparedResult?.selectedRoll);
assert.equal(witnessAfterJoin?.choiceState, 'witnessing');
assert.equal(witnessAfterJoin?.preparedResult, undefined);

let rerollBlocked = false;
try {
  await submitChoice(actorSession.playerId, actorAvatarId, 'dice');
} catch (error) {
  rerollBlocked = error instanceof RoomError && error.code === 'OUTCOME_ALREADY_PREPARED';
}
assert.equal(rerollBlocked, true);

const persisted = await loadEncounterRoom(room.roomId);
assert.equal(persisted?.slotEncounterSnapshots[actorSlotIndex].rollE, 10);
assert.equal(
  persisted?.participants.find((entry) => entry.playerId === actorSession.playerId)?.preparedResult?.success,
  false,
);

console.log('systemEventJoinPreservesOutcome.test.ts: all assertions passed');
