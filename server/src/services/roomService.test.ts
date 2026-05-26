import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import {
  clientActionToPlayerAction,
  createRoom,
  getActiveRoomForPlayer,
  RoomError,
  setFocusState,
  submitChoice,
  submitContinue,
  tickInactivity,
} from './roomService.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { INACTIVITY_MS } from '../domain/rooms/roomConstants.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import { saveEncounterRoom } from './roomPersistence.js';

function randomDeviceKey(): string {
  return `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

assert.deepEqual(clientActionToPlayerAction('C'), { type: 'primaryC' });
assert.deepEqual(clientActionToPlayerAction('dice'), { type: 'dice' });

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const challenge = `morkahja-restore:${identityPublicJwk}`;
const signature = sign(
  'sha256',
  Buffer.from(challenge, 'utf8'),
  { key: identityKeyPair.privateKey, dsaEncoding: 'ieee-p1363' },
).toString('base64url');

const session = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: identityPublicJwk,
  playerName: `room-test-${Date.now()}`,
});

const avatarId = `avatar-${Date.now()}`;
const { savePlayerAvatar } = await import('./playerService.js');
await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'Room Tester',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

let room = await createRoom(session.playerId, avatarId);
assert.equal(room.participants.length, 1);
assert.equal(room.roomState, 'active_encounter');
assert.ok(room.activeEncounterSnapshot.snapshotId.length > 0);
room = {
  ...room,
  activeEncounterSnapshot: {
    ...room.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(room);

const active = await getActiveRoomForPlayer(session.playerId, avatarId);
assert.ok(active);
assert.equal(active?.roomId, room.roomId);

const secondAvatarId = `${avatarId}-second`;
await savePlayerAvatar(session.playerId, {
  id: secondAvatarId,
  name: 'Room Tester 2',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
let switchedAvatarRoom = await createRoom(session.playerId, secondAvatarId);
assert.notEqual(switchedAvatarRoom.roomId, room.roomId);
assert.equal(switchedAvatarRoom.participants[0]?.avatarId, secondAvatarId);
switchedAvatarRoom = {
  ...switchedAvatarRoom,
  activeEncounterSnapshot: {
    ...switchedAvatarRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(switchedAvatarRoom);
const originalAvatarRoomAgain = await createRoom(session.playerId, avatarId);
assert.equal(originalAvatarRoomAgain.roomId, room.roomId);

const witnessSystemRoom: EncounterRoom = {
  ...switchedAvatarRoom,
  roomState: 'system_event',
  systemEvent: {
    queue: [{
      actorPlayerId: 'RoomTesterActor',
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    }],
    queueIndex: 0,
    lineage: {
      originEncounterId: switchedAvatarRoom.activeEncounterSnapshot.encounterId,
      originEncounterFollow: switchedAvatarRoom.activeEncounterSnapshot.encounterFollow,
      originRollOutcome: 'Fortune',
      originSuccess: true,
    },
  },
  participants: [
    {
      ...switchedAvatarRoom.participants[0]!,
      choiceState: 'witnessing',
    },
    {
      playerId: 'RoomTesterActor',
      avatarId: switchedAvatarRoom.participants[0]!.avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'choosing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(witnessSystemRoom);
try {
  await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
  assert.fail('expected witness readonly error');
} catch (error) {
  assert.ok(error instanceof RoomError);
  assert.ok(
    error.code === 'WITNESS_READONLY' || error.code === 'INVALID_ROOM_STATE',
  );
}
await saveEncounterRoom(switchedAvatarRoom);

const afterChoice = await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
assert.equal(afterChoice.roomState, 'active_encounter');
assert.notEqual(
  afterChoice.activeEncounterSnapshot.snapshotId,
  room.activeEncounterSnapshot.snapshotId,
);

const waitingContinueRoom: EncounterRoom = {
  ...afterChoice,
  roomState: 'waiting_continue',
  participants: [{
    ...afterChoice.participants[0]!,
    choiceState: 'resolved',
    continuePressed: false,
    focusState: 'none',
    resolutionSummary: {
      success: true,
      message: 'test',
      rewards: [],
    },
  }],
  updatedAt: Date.now(),
};
await saveEncounterRoom(waitingContinueRoom);

const blocked = await setFocusState(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'lore');
assert.equal(blocked.participants[0]?.focusState, 'lore');

const advancedAfterFocus = await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
assert.equal(advancedAfterFocus.roomState, 'active_encounter');
await saveEncounterRoom({
  ...advancedAfterFocus,
  activeEncounterSnapshot: {
    ...advancedAfterFocus.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
});

const followUpChoice = await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
assert.equal(followUpChoice.roomState, 'active_encounter');

const withIdleJoiner: EncounterRoom = {
  ...followUpChoice,
  roomState: 'waiting_continue',
  participants: [
    {
      ...followUpChoice.participants[0]!,
      choiceState: 'resolved',
      continuePressed: false,
      focusState: 'none',
      resolutionSummary: {
        success: true,
        message: 'test',
        rewards: [],
      },
    },
    {
      playerId: 'RoomTesterGhost',
      avatarId: followUpChoice.participants[0]!.avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'choosing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(withIdleJoiner);

const advancedWithGhost = await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
assert.equal(advancedWithGhost.roomState, 'active_encounter');

const soloInactivityRoom: EncounterRoom = {
  ...room,
  roomId: `inactivity-solo-${Date.now()}`,
  participants: [{
    ...room.participants[0],
    choiceState: 'choosing',
    focusState: 'none',
    lastInteractionAt: Date.now() - INACTIVITY_MS - 1000,
  }],
  roomState: 'active_encounter',
  updatedAt: Date.now(),
};
await saveEncounterRoom(soloInactivityRoom);
const soloStillActive = await tickInactivity(soloInactivityRoom);
assert.equal(soloStillActive.participants[0]?.choiceState, 'choosing');

const multiInactivityRoom: EncounterRoom = {
  ...room,
  roomId: `inactivity-multi-${Date.now()}`,
  participants: [
    {
      ...room.participants[0],
      choiceState: 'choosing',
      focusState: 'none',
      lastInteractionAt: Date.now() - INACTIVITY_MS - 1000,
    },
    {
      playerId: 'RoomTesterGhost',
      avatarId: room.participants[0]!.avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'choosing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
  ],
  roomState: 'active_encounter',
  updatedAt: Date.now(),
};
await saveEncounterRoom(multiInactivityRoom);
const disengaged = await tickInactivity(multiInactivityRoom);
assert.equal(disengaged.participants[0]?.choiceState, 'disengaged');

const activeBeforePostSystem = await getActiveRoomForPlayer(
  session.playerId,
  switchedAvatarRoom.participants[0]!.avatarId,
);
assert.ok(activeBeforePostSystem);

const postSystemDisengagedRoom: EncounterRoom = {
  ...activeBeforePostSystem,
  roomId: activeBeforePostSystem.roomId,
  roomState: 'waiting_continue',
  systemEvent: {
    queue: [],
    queueIndex: 0,
    lineage: {
      originEncounterId: activeBeforePostSystem.activeEncounterSnapshot.encounterId,
      originEncounterFollow: 0,
      originRollOutcome: 'Fortune',
      originSuccess: true,
    },
    lastEvent: {
      kind: 'level_up',
      actorPlayerId: session.playerId,
      resolutionSummary: {
        success: true,
        message: 'Level up witnessed',
        rewards: [],
        leveledUp: true,
      },
    },
  },
  participants: [
    {
      ...switchedAvatarRoom.participants[0]!,
      choiceState: 'resolved',
      continuePressed: true,
      resolutionSummary: {
        success: true,
        message: 'witness',
        rewards: [],
      },
    },
    {
      playerId: 'RoomTesterWitness',
      avatarId: switchedAvatarRoom.participants[0]!.avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'disengaged',
      disconnectedAt: Date.now(),
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
      resolutionSummary: {
        success: true,
        message: 'witness',
        rewards: [],
      },
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(postSystemDisengagedRoom);
const advancedPastDisengaged = await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
assert.equal(advancedPastDisengaged.roomState, 'active_encounter');

console.log('roomService.test.ts passed');
