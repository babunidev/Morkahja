import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import {
  createRoom,
  getActiveRoomForPlayer,
  joinRoom,
  leaveAllRoomsForPlayer,
  leaveRoomById,
  submitChoice,
  submitContinue,
} from './roomService.js';
import { savePlayerAvatar } from './playerService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';

function randomDeviceKey(): string {
  return `device-departure-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

async function bootstrapPlayer(namePrefix: string) {
  const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
  const challenge = `morkahja-restore:${identityPublicJwk}`;
  sign(
    'sha256',
    Buffer.from(challenge, 'utf8'),
    { key: identityKeyPair.privateKey, dsaEncoding: 'ieee-p1363' },
  ).toString('base64url');

  const session = await bootstrapSession({
    devicePublicKey: randomDeviceKey(),
    identityPublicKey: identityPublicJwk,
    playerName: `${namePrefix}-${Date.now()}`,
  });

  return session;
}

const actorSession = await bootstrapPlayer('actor-departure');
const witnessSession = await bootstrapPlayer('witness-departure');

const actorAvatarId = `avatar-actor-departure-${Date.now()}`;
const witnessAvatarId = `avatar-witness-departure-${Date.now()}`;

await savePlayerAvatar(actorSession.playerId, {
  id: actorAvatarId,
  name: 'Departure Actor',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await savePlayerAvatar(witnessSession.playerId, {
  id: witnessAvatarId,
  name: 'Departure Witness',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

let room = await createRoom(actorSession.playerId, actorAvatarId);
room = await joinRoom(witnessSession.playerId, witnessAvatarId, room.roomId);

const lineage = {
  originEncounterId: room.activeEncounterSnapshot.encounterId,
  originEncounterFollow: room.activeEncounterSnapshot.encounterFollow,
  originRollOutcome: 'Misery',
  originSuccess: false,
} as const;

const systemEventRoom: EncounterRoom = {
  ...room,
  activeEncounterSnapshot: {
    ...room.activeEncounterSnapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot, slotIndex) => ({
    ...snapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    actionReadyAt: Date.now() - 1,
    rollE: slotIndex === 0 ? 96 : 50,
  })) as EncounterRoom['slotEncounterSnapshots'],
  participants: room.participants.map((participant) => ({
    ...participant,
    choiceState: participant.playerId === actorSession.playerId
      ? 'ready_to_continue' as const
      : 'witnessing' as const,
    preparedResult: participant.playerId === actorSession.playerId
      ? {
          success: true,
          message: 'Atranor survived',
          rewards: [40],
        }
      : undefined,
    selectedAction: participant.playerId === actorSession.playerId
      ? { type: 'dice' as const }
      : undefined,
    focusState: 'none' as const,
    continuePressed: false,
  })),
  roomState: 'system_event',
  systemEvent: {
    queue: [{
      actorPlayerId: actorSession.playerId,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    }],
    queueIndex: 0,
    lineage,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(systemEventRoom);

await leaveRoomById(actorSession.playerId, systemEventRoom.roomId);

const witnessRoom = await getActiveRoomForPlayer(witnessSession.playerId, witnessAvatarId);
assert.ok(witnessRoom, 'witness should still have an active room');
assert.equal(
  witnessRoom?.roomState,
  'active_encounter',
  'witness room should auto-advance after actor leaves system event',
);
assert.equal(witnessRoom?.systemEvent, undefined);

const persisted = await loadEncounterRoom(systemEventRoom.roomId);
assert.equal(persisted?.roomState, 'active_encounter');
assert.equal(
  persisted?.participants.some((participant) => participant.playerId === actorSession.playerId),
  false,
);

{
  let multiRoom = await createRoom(actorSession.playerId, actorAvatarId);
  multiRoom = await joinRoom(witnessSession.playerId, witnessAvatarId, multiRoom.roomId);

  const multiSystemRoom: EncounterRoom = {
    ...multiRoom,
    activeEncounterSnapshot: {
      ...multiRoom.activeEncounterSnapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: multiRoom.slotEncounterSnapshots.map((snapshot) => ({
      ...snapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    participants: multiRoom.participants.map((participant) => ({
      ...participant,
      choiceState: participant.playerId === actorSession.playerId
        ? 'choosing' as const
        : 'witnessing' as const,
      focusState: 'none' as const,
      continuePressed: false,
    })),
    roomState: 'system_event',
    systemEvent: {
      queue: [
        {
          actorPlayerId: actorSession.playerId,
          encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
        },
        {
          actorPlayerId: witnessSession.playerId,
          encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        },
      ],
      queueIndex: 0,
      lineage,
    },
    updatedAt: Date.now(),
  };
  await saveEncounterRoom(multiSystemRoom);

  await leaveRoomById(actorSession.playerId, multiSystemRoom.roomId);

  const witnessAfterSkip = await getActiveRoomForPlayer(
    witnessSession.playerId,
    witnessAvatarId,
  );
  assert.equal(witnessAfterSkip?.roomState, 'system_event');
  assert.equal(
    witnessAfterSkip?.systemEvent?.queue[witnessAfterSkip.systemEvent.queueIndex]?.actorPlayerId,
    witnessSession.playerId,
  );
  assert.equal(
    witnessAfterSkip?.participants.find((entry) => entry.playerId === witnessSession.playerId)?.choiceState,
    'choosing',
  );
}

{
  await leaveAllRoomsForPlayer(actorSession.playerId);
  await leaveAllRoomsForPlayer(witnessSession.playerId);
  let chainedRoom = await createRoom(actorSession.playerId, actorAvatarId);
  chainedRoom = await joinRoom(witnessSession.playerId, witnessAvatarId, chainedRoom.roomId);
  const actorSlotIndex = chainedRoom.participants.find(
    (participant) => participant.playerId === actorSession.playerId,
  )!.slotIndex;

  const chainedSystemRoom: EncounterRoom = {
    ...chainedRoom,
    activeEncounterSnapshot: {
      ...chainedRoom.activeEncounterSnapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: chainedRoom.slotEncounterSnapshots.map((snapshot, slotIndex) => ({
      ...snapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      rollE: slotIndex === actorSlotIndex ? 10 : 96,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    participants: chainedRoom.participants.map((participant) => ({
      ...participant,
      choiceState: participant.playerId === actorSession.playerId
        ? 'choosing' as const
        : 'witnessing' as const,
      focusState: 'none' as const,
      continuePressed: false,
    })),
    roomState: 'system_event',
    systemEvent: {
      queue: [
        {
          actorPlayerId: actorSession.playerId,
          encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
          chainedLevelUp: true,
        },
        {
          actorPlayerId: witnessSession.playerId,
          encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        },
      ],
      queueIndex: 0,
      lineage,
    },
    updatedAt: Date.now(),
  };
  await saveEncounterRoom(chainedSystemRoom);

  await leaveRoomById(actorSession.playerId, chainedSystemRoom.roomId);

  const witnessAfterActorLeft = await getActiveRoomForPlayer(
    witnessSession.playerId,
    witnessAvatarId,
  );
  assert.equal(witnessAfterActorLeft?.roomState, 'system_event');
  assert.deepEqual(
    witnessAfterActorLeft?.systemEvent?.queue.map((item) => item.actorPlayerId),
    [witnessSession.playerId],
  );
  assert.equal(
    witnessAfterActorLeft?.systemEvent?.queue[0]?.encounterId,
    LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  );
}

{
  await leaveAllRoomsForPlayer(actorSession.playerId);
  await leaveAllRoomsForPlayer(witnessSession.playerId);
  let deathRoom = await createRoom(actorSession.playerId, actorAvatarId);
  deathRoom = await joinRoom(witnessSession.playerId, witnessAvatarId, deathRoom.roomId);
  const actorSlotIndex = deathRoom.participants.find(
    (participant) => participant.playerId === actorSession.playerId,
  )!.slotIndex;

  const deathSystemRoom: EncounterRoom = {
    ...deathRoom,
    activeEncounterSnapshot: {
      ...deathRoom.activeEncounterSnapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: deathRoom.slotEncounterSnapshots.map((snapshot, slotIndex) => ({
      ...snapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      rollE: slotIndex === actorSlotIndex ? 10 : 96,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    participants: deathRoom.participants.map((participant) => ({
      ...participant,
      choiceState: participant.playerId === actorSession.playerId
        ? 'choosing' as const
        : 'witnessing' as const,
      focusState: 'none' as const,
      continuePressed: false,
    })),
    roomState: 'system_event',
    systemEvent: {
      queue: [
        {
          actorPlayerId: actorSession.playerId,
          encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
          chainedLevelUp: true,
        },
        {
          actorPlayerId: witnessSession.playerId,
          encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
        },
      ],
      queueIndex: 0,
      lineage,
    },
    updatedAt: Date.now(),
  };
  await saveEncounterRoom(deathSystemRoom);

  await submitChoice(actorSession.playerId, actorAvatarId, 'dice');
  const afterDeathContinue = await submitContinue(actorSession.playerId, actorAvatarId);

  assert.equal(afterDeathContinue.roomState, 'system_event');
  assert.deepEqual(
    afterDeathContinue.systemEvent?.queue.map((item) => item.actorPlayerId),
    [witnessSession.playerId],
  );
  assert.equal(
    afterDeathContinue.systemEvent?.queue[0]?.encounterId,
    LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  );
  assert.equal(
    afterDeathContinue.participants.find((entry) => entry.playerId === actorSession.playerId)?.choiceState,
    'disengaged',
  );
  assert.equal(
    afterDeathContinue.participants.find((entry) => entry.playerId === witnessSession.playerId)?.choiceState,
    'choosing',
  );
}

console.log('systemEventActorDeparture.test.ts: all assertions passed');
