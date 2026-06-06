import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import {
  applyPendingLevelUpRewardsFlag,
  createInitialProgression,
} from '../domain/avatar/AvatarProgression.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import { getProgression, setProgression } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { savePlayerAvatar } from './playerService.js';
import {
  buildPendingSystemEventQueue,
  createRoom,
  getActiveRoomForPlayer,
  leaveAllRoomsForPlayer,
  leaveRoom,
  submitChoice,
  submitContinue,
} from './roomService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import { bootstrapSession } from './sessionService.js';

function randomDeviceKey(): string {
  return `device-pending-lvl-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function readyEncounterRoom(room: EncounterRoom, slotIndex: number): EncounterRoom {
  return {
    ...room,
    activeEncounterSnapshot: {
      ...room.activeEncounterSnapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      rollPrimaryA: index === slotIndex ? 10 : 96,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  };
}

{
  const progression = createInitialProgression();
  const flagged = applyPendingLevelUpRewardsFlag(progression, {
    leveledUp: true,
    resolvedEncounterId: 42,
    levelUpEncounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  });
  assert.equal(flagged.pendingLevelUpRewards, true);

  const cleared = applyPendingLevelUpRewardsFlag(flagged, {
    leveledUp: false,
    resolvedEncounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    levelUpEncounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  });
  assert.equal(cleared.pendingLevelUpRewards, false);
}

{
  const room = { leaderPlayerId: 'leader' } as EncounterRoom;
  const participant: RoomParticipant = {
    playerId: 'leader',
    avatarId: 'leader-avatar',
    slotIndex: 0,
    joinedAt: 0,
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    lastInteractionAt: 0,
  };

  const queue = buildPendingSystemEventQueue(
    room,
    [participant],
    new Map([['leader', true]]),
  );

  assert.deepEqual(queue, [{
    actorPlayerId: 'leader',
    encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  }]);
}

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
  playerName: `pending-level-up-${Date.now()}`,
});

const avatarId = `avatar-pending-lvl-${Date.now()}`;

await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'Pending Level Up',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

await ensureAvatar(session.playerId, avatarId, {
  id: avatarId,
  name: 'Pending Level Up',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);

{
  await leaveAllRoomsForPlayer(session.playerId);
  await setProgression(session.playerId, avatarId, {
    ...createInitialProgression(),
    level: 2,
    pendingLevelUpRewards: true,
  });

  const room = await createRoom(session.playerId, avatarId);
  assert.equal(room.roomState, 'system_event');
  assert.equal(room.systemEvent?.queue[0]?.encounterId, LEVEL_UP_ENCOUNTER_NUMERIC_ID);
  assert.equal(room.systemEvent?.queue[0]?.actorPlayerId, session.playerId);
}

{
  await leaveAllRoomsForPlayer(session.playerId);
  await setProgression(session.playerId, avatarId, {
    ...createInitialProgression(),
    experience: 6,
  });

  let room = await createRoom(session.playerId, avatarId);
  const slotIndex = room.participants[0]!.slotIndex;
  room = {
    ...readyEncounterRoom(room, slotIndex),
    activeEncounterSnapshot: {
      ...readyEncounterRoom(room, slotIndex).activeEncounterSnapshot,
      rollPrimaryA: 96,
    },
    slotEncounterSnapshots: readyEncounterRoom(room, slotIndex).slotEncounterSnapshots.map(
      (snapshot, index) => ({
        ...snapshot,
        rollPrimaryA: index === slotIndex ? 96 : 50,
      }),
    ) as EncounterRoom['slotEncounterSnapshots'],
  };
  await saveEncounterRoom(room);

  await submitChoice(session.playerId, avatarId, 'A');
  const afterContinue = await submitContinue(session.playerId, avatarId);
  assert.equal(afterContinue.roomState, 'system_event');
  assert.equal(afterContinue.systemEvent?.queue[0]?.encounterId, LEVEL_UP_ENCOUNTER_NUMERIC_ID);

  const progressionAfterCommit = await getProgression(session.playerId, avatarId);
  assert.equal(progressionAfterCommit?.pendingLevelUpRewards, true);

  await leaveRoom(session.playerId, avatarId);

  const newRoom = await createRoom(session.playerId, avatarId);
  assert.equal(newRoom.roomState, 'system_event');
  assert.equal(newRoom.systemEvent?.queue[0]?.encounterId, LEVEL_UP_ENCOUNTER_NUMERIC_ID);

  const slotIndexAfterRejoin = newRoom.participants[0]!.slotIndex;
  const persisted = await loadEncounterRoom(newRoom.roomId);
  await saveEncounterRoom({
    ...persisted!,
    activeEncounterSnapshot: {
      ...persisted!.activeEncounterSnapshot,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: persisted!.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      rollE: index === slotIndexAfterRejoin ? 96 : 50,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });

  await submitChoice(session.playerId, avatarId, 'dice');
  const afterLevelUpRoll = await submitContinue(session.playerId, avatarId);
  assert.equal(afterLevelUpRoll.roomState, 'waiting_continue');

  const activeAfterRewards = await getActiveRoomForPlayer(session.playerId, avatarId);
  assert.equal(activeAfterRewards?.roomState, 'waiting_continue');
  assert.notEqual(activeAfterRewards?.roomState, 'system_event');

  await submitContinue(session.playerId, avatarId);

  const progressionAfterRewards = await getProgression(session.playerId, avatarId);
  assert.equal(progressionAfterRewards?.pendingLevelUpRewards, false);
}

{
  await leaveAllRoomsForPlayer(session.playerId);
  await setProgression(session.playerId, avatarId, {
    ...createInitialProgression(),
    level: 2,
    pendingLevelUpRewards: true,
  });

  await createRoom(session.playerId, avatarId);
  const active = await getActiveRoomForPlayer(session.playerId, avatarId);
  assert.equal(active?.roomState, 'system_event');
  assert.equal(active?.systemEvent?.queue[0]?.encounterId, LEVEL_UP_ENCOUNTER_NUMERIC_ID);
}

console.log('pendingLevelUpRewards.test.ts: all assertions passed');
