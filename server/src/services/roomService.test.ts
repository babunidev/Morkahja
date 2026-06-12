import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import { shouldUseEncounterFollow } from './encounterGenerator.js';
import {
  broadcastCallForHelp,
  clientActionToPlayerAction,
  createRoom,
  getActiveRoomForPlayer,
  joinRoom,
  kickParticipant,
  leaveAllRoomsForPlayer,
  leaveRoom,
  listPendingHelpInvitations,
  participantsAtSystemEventStart,
  RoomError,
  setFocusState,
  submitChoice,
  submitContinue,
} from './roomService.js';
import { getProgression, setPlayer } from '../db/postgresDocumentStore.js';
import { queryActivityFeed } from './gameEventService.js';
import { toEncounterRoomSnapshotDto } from './roomDtoMapper.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { INACTIVITY_MS, ROOM_INACTIVITY_ENABLED } from '../domain/rooms/roomConstants.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import { loadEncounterRoom, saveEncounterRoom, findActiveRoomIdForPlayerAvatar } from './roomPersistence.js';

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
assert.equal(
  originalAvatarRoomAgain.activeEncounterSnapshot.snapshotId,
  room.activeEncounterSnapshot.snapshotId,
);
assert.equal(originalAvatarRoomAgain.participants[0]?.avatarId, avatarId);
const firstRoomAfterSwitch = await loadEncounterRoom(room.roomId);
assert.equal(firstRoomAfterSwitch?.roomState, 'active_encounter');

const soloSystemRoom: EncounterRoom = {
  ...room,
  roomState: 'system_event',
  activeEncounterSnapshot: {
    ...room.activeEncounterSnapshot,
    encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    encounterTitle: 'Level Up',
    actionReadyAt: Date.now() - 1,
  },
  systemEvent: {
    queue: [{
      actorPlayerId: session.playerId,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    }],
    queueIndex: 0,
    lineage: {
      originEncounterId: room.activeEncounterSnapshot.encounterId,
      originEncounterFollow: room.activeEncounterSnapshot.encounterFollow,
      originRollOutcome: 'Fortune',
      originSuccess: true,
    },
  },
  participants: [{
    ...room.participants[0]!,
    choiceState: 'choosing',
    continuePressed: false,
    focusState: 'none',
    lastInteractionAt: Date.now(),
  }],
  updatedAt: Date.now(),
};
await saveEncounterRoom(soloSystemRoom);
const afterSoloSystemRoll = await submitChoice(session.playerId, avatarId, 'dice');
assert.equal(afterSoloSystemRoll.roomState, 'system_event');
assert.equal(
  afterSoloSystemRoll.participants.find((participant) => participant.playerId === session.playerId)?.choiceState,
  'ready_to_continue',
);
const afterSoloSystemContinue = await submitContinue(session.playerId, avatarId);
assert.equal(
  afterSoloSystemContinue.roomState,
  'active_encounter',
  'solo system-event should advance after one continue',
);
await saveEncounterRoom(room);

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
const clearedForSystemEvent = participantsAtSystemEventStart(
  [{
    ...witnessSystemRoom.participants[1]!,
    preparedResult: {
      success: true,
      message: 'stale',
      rewards: [999],
      selectedRoll: 96,
    },
    resolutionSummary: {
      success: true,
      message: 'stale',
      rewards: [999],
      selectedRoll: 96,
    },
    choiceState: 'ready_to_continue',
  }],
  'RoomTesterActor',
);
assert.equal(clearedForSystemEvent[0]?.preparedResult, undefined);
assert.equal(clearedForSystemEvent[0]?.resolutionSummary, undefined);
assert.equal(clearedForSystemEvent[0]?.choiceState, 'choosing');
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

const actorRollSystemRoom: EncounterRoom = {
  ...witnessSystemRoom,
  activeEncounterSnapshot: {
    ...witnessSystemRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  participants: [
    {
      playerId: 'RoomTesterWitness',
      avatarId: secondAvatarId,
      slotIndex: 0,
      joinedAt: Date.now(),
      choiceState: 'witnessing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
    {
      playerId: session.playerId,
      avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'choosing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
  ],
  systemEvent: {
    ...witnessSystemRoom.systemEvent!,
    queue: [{
      actorPlayerId: session.playerId,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    }],
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(actorRollSystemRoom);
const afterActorSystemRoll = await submitChoice(session.playerId, avatarId, 'dice');
assert.equal(afterActorSystemRoll.roomState, 'system_event');
assert.equal(afterActorSystemRoll.participants.find((p) => p.playerId === session.playerId)?.choiceState, 'ready_to_continue');
assert.ok(afterActorSystemRoll.participants.find((p) => p.playerId === session.playerId)?.preparedResult);
const witnessSystemDto = await toEncounterRoomSnapshotDto(
  afterActorSystemRoll,
  'RoomTesterWitness',
);
assert.equal(witnessSystemDto.systemEvent?.isLocalWitness, true);
assert.ok(witnessSystemDto.systemEvent?.actorOutcome);
assert.ok(
  witnessSystemDto.systemEvent?.actorOutcome?.selectedRoll !== undefined
  || (witnessSystemDto.systemEvent?.actorOutcome?.rewards?.length ?? 0) > 0,
  'witness DTO must include actor outcome after system-event roll',
);
const afterActorSystemContinue = await submitContinue(session.playerId, avatarId);
assert.equal(afterActorSystemContinue.roomState, 'waiting_continue');
assert.ok(afterActorSystemContinue.systemEvent?.lastEvent);
await saveEncounterRoom(switchedAvatarRoom);

const afterChoice = await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
assert.equal(afterChoice.roomState, 'waiting_continue');
assert.equal(
  afterChoice.activeEncounterSnapshot.snapshotId,
  switchedAvatarRoom.activeEncounterSnapshot.snapshotId,
);
assert.equal(afterChoice.participants[0]?.choiceState, 'ready_to_continue');

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

await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
const stillWaitingWithLore = await getActiveRoomForPlayer(
  session.playerId,
  switchedAvatarRoom.participants[0]!.avatarId,
);
assert.equal(stillWaitingWithLore?.roomState, 'waiting_continue');
assert.equal(stillWaitingWithLore?.participants[0]?.focusState, 'lore');
assert.equal(stillWaitingWithLore?.participants[0]?.continuePressed, true);

await setFocusState(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'none');
const advancedAfterFocus = await getActiveRoomForPlayer(
  session.playerId,
  switchedAvatarRoom.participants[0]!.avatarId,
);
assert.equal(advancedAfterFocus?.roomState, 'active_encounter');
await saveEncounterRoom({
  ...advancedAfterFocus,
  activeEncounterSnapshot: {
    ...advancedAfterFocus.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
});

const followUpChoice = await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
assert.equal(followUpChoice.roomState, 'waiting_continue');

const ghostChoiceRoom: EncounterRoom = {
  ...followUpChoice,
  roomState: 'active_encounter',
  participants: [
    {
      ...followUpChoice.participants[0]!,
      choiceState: 'choosing',
      preparedResult: undefined,
      preparedCommit: undefined,
      continuePressed: false,
    },
    {
      playerId: 'DisconnectedGhost',
      avatarId: `${avatarId}-ghost`,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'choosing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
      disconnectedAt: Date.now() - 1000,
    },
  ],
  activeEncounterSnapshot: {
    ...followUpChoice.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(ghostChoiceRoom);
const ghostReady = await submitChoice(session.playerId, switchedAvatarRoom.participants[0]!.avatarId, 'dice');
assert.equal(
  ghostReady.roomState,
  'waiting_continue',
  'solo should enter waiting_continue when only disconnected ghosts remain choosing',
);
const ghostAdvanced = await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
assert.equal(
  ghostAdvanced.roomState,
  'active_encounter',
  'continue should advance when solo is the only engaged participant',
);

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

await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
const advancedWithGhost = await getActiveRoomForPlayer(
  session.playerId,
  switchedAvatarRoom.participants[0]!.avatarId,
);
assert.equal(advancedWithGhost?.roomState, 'active_encounter');

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
assert.equal(
  soloInactivityRoom.participants[0]?.choiceState,
  'choosing',
  'idle solo participants stay choosing (inactivity disengage removed)',
);
assert.equal(ROOM_INACTIVITY_ENABLED, false);

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
assert.equal(
  multiInactivityRoom.participants.every((participant) => participant.choiceState === 'choosing'),
  true,
  'idle multiplayer participants stay choosing (inactivity disengage removed)',
);

const roomForReengage: EncounterRoom = {
  ...multiInactivityRoom,
  participants: multiInactivityRoom.participants.map((participant, index) => (
    index === 0
      ? {
          ...participant,
          choiceState: 'disengaged' as const,
          disconnectedAt: Date.now(),
        }
      : participant
  )),
};
await saveEncounterRoom(roomForReengage);

const reengagedByFocus = await setFocusState(
  session.playerId,
  roomForReengage.participants[0]!.avatarId,
  'lore',
);
const reengagedParticipant = reengagedByFocus.participants.find(
  (participant) => participant.playerId === session.playerId,
);
assert.equal(reengagedParticipant?.choiceState, 'choosing');

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
await submitContinue(session.playerId, switchedAvatarRoom.participants[0]!.avatarId);
const advancedPastDisengaged = await getActiveRoomForPlayer(
  session.playerId,
  switchedAvatarRoom.participants[0]!.avatarId,
);
assert.equal(advancedPastDisengaged?.roomState, 'active_encounter');

const prepareAvatarId = `${avatarId}-prepare-${Date.now()}`;
await savePlayerAvatar(session.playerId, {
  id: prepareAvatarId,
  name: 'Prepare Tester',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
const prepareFlowRoom = await createRoom(session.playerId, prepareAvatarId);
const prepareReadyRoom: EncounterRoom = {
  ...prepareFlowRoom,
  activeEncounterSnapshot: {
    ...prepareFlowRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  participants: [
    prepareFlowRoom.participants[0]!,
    {
      playerId: 'RoomTesterAlly',
      avatarId: prepareAvatarId,
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
await saveEncounterRoom(prepareReadyRoom);
const preparedChoice = await submitChoice(session.playerId, prepareAvatarId, 'dice');
assert.equal(preparedChoice.participants[0]?.choiceState, 'ready_to_continue');
assert.ok(preparedChoice.participants[0]?.preparedResult);
assert.ok((preparedChoice.participants[0]?.preparedResult?.gainedExperience ?? 0) >= 1);
assert.ok((preparedChoice.participants[0]?.preparedResult?.gainedExperience ?? 0) <= 3);
assert.equal(preparedChoice.roomState, 'active_encounter');
assert.equal(preparedChoice.participants[0]?.resolutionSummary, undefined);

const waitingAfterPrepare: EncounterRoom = {
  ...preparedChoice,
  roomState: 'waiting_continue',
  participants: preparedChoice.participants.map((participant) => {
    if (participant.playerId === session.playerId) {
      return {
        ...participant,
        continuePressed: false,
      };
    }
    return {
      ...participant,
      choiceState: 'ready_to_continue' as const,
      preparedResult: {
        success: true,
        message: 'ally',
        rewards: [],
      },
    };
  }),
  updatedAt: Date.now(),
};
await saveEncounterRoom(waitingAfterPrepare);

const continueOnly = await submitContinue(session.playerId, prepareAvatarId);
assert.equal(continueOnly.roomState, 'waiting_continue');
assert.equal(continueOnly.participants[0]?.continuePressed, true);

const stillWaiting = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(stillWaiting?.roomState, 'waiting_continue');

const allContinueRoom: EncounterRoom = {
  ...stillWaiting!,
  participants: stillWaiting!.participants.map((participant) => ({
    ...participant,
    continuePressed: true,
    focusState: 'none' as const,
  })),
  updatedAt: Date.now(),
};
await saveEncounterRoom(allContinueRoom);
const advancedAfterTick = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(advancedAfterTick?.roomState, 'active_encounter');
assert.equal(advancedAfterTick?.participants[0]?.choiceState, 'choosing');

const disengagedAdvanceRoom: EncounterRoom = {
  ...advancedAfterTick!,
  roomState: 'waiting_continue',
  participants: [
    {
      ...advancedAfterTick!.participants[0]!,
      choiceState: 'ready_to_continue',
      continuePressed: true,
      preparedResult: {
        success: true,
        message: 'ok',
        rewards: [],
      },
      preparedCommit: undefined,
      resolutionSummary: {
        success: true,
        message: 'ok',
        rewards: [],
      },
    },
    {
      playerId: 'DisengagedTraveler',
      avatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'disengaged',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
      disconnectedAt: Date.now(),
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(disengagedAdvanceRoom);
const advancedByContinue = await submitContinue(session.playerId, prepareAvatarId);
assert.equal(advancedByContinue.roomState, 'active_encounter');
const roomAfterDisengagedAdvance = await loadEncounterRoom(disengagedAdvanceRoom.roomId);
assert.equal(roomAfterDisengagedAdvance?.roomState, 'active_encounter');
assert.equal(
  roomAfterDisengagedAdvance?.participants.some((participant) => participant.playerId === 'DisengagedTraveler'),
  true,
);

const focusBlocksAdvanceRoom: EncounterRoom = {
  ...advancedAfterTick!,
  roomState: 'waiting_continue',
  participants: [
    {
      ...advancedAfterTick!.participants[0]!,
      slotIndex: 0,
      choiceState: 'resolved',
      continuePressed: true,
      focusState: 'none',
      resolutionSummary: {
        success: true,
        message: 'leader',
        rewards: [],
      },
    },
    {
      playerId: 'FocusBlockAlly',
      avatarId: prepareAvatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'resolved',
      continuePressed: true,
      focusState: 'lore',
      lastInteractionAt: Date.now(),
      resolutionSummary: {
        success: true,
        message: 'ally',
        rewards: [],
      },
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(focusBlocksAdvanceRoom);
const blockedByFocus = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(blockedByFocus?.roomState, 'waiting_continue');

const focusClearedRoom: EncounterRoom = {
  ...focusBlocksAdvanceRoom,
  participants: focusBlocksAdvanceRoom.participants.map((participant) => ({
    ...participant,
    focusState: 'none' as const,
  })),
  updatedAt: Date.now(),
};
await saveEncounterRoom(focusClearedRoom);
const advancedAfterFocusClear = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(advancedAfterFocusClear?.roomState, 'active_encounter');

const avatarDetailsNoPauseRoom: EncounterRoom = {
  ...focusBlocksAdvanceRoom,
  participants: focusBlocksAdvanceRoom.participants.map((participant, index) =>
    index === 1
      ? { ...participant, focusState: 'avatar_details' as const }
      : participant,
  ),
  updatedAt: Date.now(),
};
await saveEncounterRoom(avatarDetailsNoPauseRoom);
const advancedDespiteAvatarDetails = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(advancedDespiteAvatarDetails?.roomState, 'active_encounter');

const concurrentHostKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const concurrentHostIdentityJwk = JSON.stringify(
  concurrentHostKeyPair.publicKey.export({ format: 'jwk' }),
);
const concurrentHostSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: concurrentHostIdentityJwk,
  playerName: `concurrent-host-${Date.now()}`,
});
const concurrentHostAvatarId = `concurrent-host-${Date.now()}`;
await savePlayerAvatar(concurrentHostSession.playerId, {
  id: concurrentHostAvatarId,
  name: 'Concurrent Host',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

const concurrentGuestKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const concurrentGuestIdentityJwk = JSON.stringify(
  concurrentGuestKeyPair.publicKey.export({ format: 'jwk' }),
);
const concurrentGuestSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: concurrentGuestIdentityJwk,
  playerName: `concurrent-guest-${Date.now()}`,
});
const concurrentGuestAvatarId = `concurrent-guest-${Date.now()}`;
await savePlayerAvatar(concurrentGuestSession.playerId, {
  id: concurrentGuestAvatarId,
  name: 'Concurrent Guest',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

let concurrentPartyRoom = await createRoom(
  concurrentHostSession.playerId,
  concurrentHostAvatarId,
);
concurrentPartyRoom = {
  ...concurrentPartyRoom,
  activeEncounterSnapshot: {
    ...concurrentPartyRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(concurrentPartyRoom);
await joinRoom(
  concurrentGuestSession.playerId,
  concurrentGuestAvatarId,
  concurrentPartyRoom.roomId,
);

await submitChoice(concurrentHostSession.playerId, concurrentHostAvatarId, 'dice');
await submitChoice(concurrentGuestSession.playerId, concurrentGuestAvatarId, 'dice');
const concurrentSnapshotBefore = concurrentPartyRoom.activeEncounterSnapshot.snapshotId;

const [hostContinue, guestContinue] = await Promise.all([
  submitContinue(concurrentHostSession.playerId, concurrentHostAvatarId),
  submitContinue(concurrentGuestSession.playerId, concurrentGuestAvatarId),
]);
const concurrentAfterBoth = await loadEncounterRoom(concurrentPartyRoom.roomId);
assert.equal(concurrentAfterBoth?.roomState, 'active_encounter');
assert.notEqual(
  concurrentAfterBoth?.activeEncounterSnapshot.snapshotId,
  concurrentSnapshotBefore,
);
assert.equal(concurrentAfterBoth?.participants[0]?.continuePressed, false);
assert.equal(
  concurrentAfterBoth?.participants.find(
    (participant) => participant.playerId === concurrentGuestSession.playerId,
  )?.continuePressed,
  false,
);
assert.ok(
  hostContinue.roomState === 'active_encounter'
  || guestContinue.roomState === 'active_encounter',
);

const pauseInventoryRoom: EncounterRoom = {
  ...hostContinue,
  roomState: 'waiting_continue',
  activeEncounterSnapshot: {
    ...hostContinue.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: hostContinue.slotEncounterSnapshots.map((snapshot) => ({
    ...snapshot,
    actionReadyAt: Date.now() - 1,
  })) as EncounterRoom['slotEncounterSnapshots'],
  participants: hostContinue.participants.map((participant) => ({
    ...participant,
    choiceState: participant.playerId === concurrentHostSession.playerId
      ? 'ready_to_continue' as const
      : 'ready_to_continue' as const,
    continuePressed: true,
    preparedResult: {
      success: true,
      message: 'ok',
      rewards: [],
    },
    preparedCommit: undefined,
    resolutionSummary: undefined,
    focusState: participant.playerId === concurrentHostSession.playerId
      ? 'inventory' as const
      : 'none' as const,
  })),
  updatedAt: Date.now(),
};
await saveEncounterRoom(pauseInventoryRoom);
const pausedByInventory = await getActiveRoomForPlayer(
  concurrentHostSession.playerId,
  concurrentHostAvatarId,
);
assert.equal(pausedByInventory?.roomState, 'waiting_continue');

assert.equal(shouldUseEncounterFollow(19667, { success: true, selectedRoll: 70 }), true);
assert.equal(shouldUseEncounterFollow(19667, { success: true, selectedRoll: 20 }), false);
assert.equal(shouldUseEncounterFollow(19667, { success: false, selectedRoll: 96 }), false);

const FOLLOW_ORIGIN_ID = 19666;
const FOLLOW_TARGET_ID = 19667;

function followOutcomeSummary(success: boolean, selectedRoll: number) {
  return {
    success,
    message: 'follow-test',
    rewards: [] as number[],
    selectedRoll,
  };
}

const advanceTemplate = advancedAfterTick!;

const followSlot0NegativeRoom: EncounterRoom = {
  ...advanceTemplate,
  roomState: 'waiting_continue',
  activeEncounterSnapshot: {
    ...advanceTemplate.activeEncounterSnapshot,
    encounterId: FOLLOW_ORIGIN_ID,
    encounterFollow: FOLLOW_TARGET_ID,
  },
  participants: [
    {
      ...advanceTemplate.participants[0]!,
      slotIndex: 0,
      choiceState: 'ready_to_continue',
      continuePressed: true,
      focusState: 'none',
      preparedResult: followOutcomeSummary(false, 20),
      resolutionSummary: followOutcomeSummary(false, 20),
    },
    {
      playerId: 'FollowAllyNegative',
      avatarId: prepareAvatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'ready_to_continue',
      focusState: 'none',
      continuePressed: true,
      lastInteractionAt: Date.now(),
      preparedResult: followOutcomeSummary(true, 96),
      resolutionSummary: followOutcomeSummary(true, 96),
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(followSlot0NegativeRoom);
const followNegativeAdvance = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(followNegativeAdvance?.roomState, 'active_encounter');
assert.notEqual(
  followNegativeAdvance?.activeEncounterSnapshot.encounterId,
  FOLLOW_TARGET_ID,
);

const followSlot0PositiveRoom: EncounterRoom = {
  ...advanceTemplate,
  roomState: 'waiting_continue',
  activeEncounterSnapshot: {
    ...advanceTemplate.activeEncounterSnapshot,
    encounterId: FOLLOW_ORIGIN_ID,
    encounterFollow: FOLLOW_TARGET_ID,
  },
  participants: [
    {
      ...advanceTemplate.participants[0]!,
      slotIndex: 0,
      choiceState: 'ready_to_continue',
      continuePressed: true,
      focusState: 'none',
      preparedResult: followOutcomeSummary(true, 70),
      resolutionSummary: followOutcomeSummary(true, 70),
    },
    {
      playerId: 'FollowAllyPositive',
      avatarId: prepareAvatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'ready_to_continue',
      focusState: 'none',
      continuePressed: true,
      lastInteractionAt: Date.now(),
      preparedResult: followOutcomeSummary(true, 96),
      resolutionSummary: followOutcomeSummary(true, 96),
    },
  ],
  updatedAt: Date.now(),
};
await saveEncounterRoom(followSlot0PositiveRoom);
const followPositiveAdvance = await getActiveRoomForPlayer(session.playerId, prepareAvatarId);
assert.equal(followPositiveAdvance?.roomState, 'active_encounter');
assert.equal(
  followPositiveAdvance?.activeEncounterSnapshot.encounterId,
  FOLLOW_TARGET_ID,
);

const leaderPoolKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const leaderPoolIdentityJwk = JSON.stringify(leaderPoolKeyPair.publicKey.export({ format: 'jwk' }));
const leaderPoolSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: leaderPoolIdentityJwk,
  playerName: `room-leader-pool-${Date.now()}`,
});
const leaderPoolAvatarId = `leader-pool-${Date.now()}`;
await savePlayerAvatar(leaderPoolSession.playerId, {
  id: leaderPoolAvatarId,
  name: 'Leader Pool',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
const leaderPoolRoom = await createRoom(leaderPoolSession.playerId, leaderPoolAvatarId);
const leaderExpansionsBeforeJoin = [...leaderPoolRoom.mergedExpansions];

const joinerPoolKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const joinerPoolIdentityJwk = JSON.stringify(joinerPoolKeyPair.publicKey.export({ format: 'jwk' }));
const joinerSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: joinerPoolIdentityJwk,
  playerName: `room-joiner-pool-${Date.now()}`,
});
const joinerAvatarId = `joiner-pool-${Date.now()}`;
await savePlayerAvatar(joinerSession.playerId, {
  id: joinerAvatarId,
  name: 'Joiner Pool',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
const joinedRoom = await joinRoom(
  joinerSession.playerId,
  joinerAvatarId,
  leaderPoolRoom.roomId,
);
assert.deepEqual(joinedRoom.mergedExpansions, leaderExpansionsBeforeJoin);

assert.equal(leaderPoolRoom.slotEncounterSnapshots.length, 3);
assert.notEqual(
  leaderPoolRoom.slotEncounterSnapshots[0].rollA,
  leaderPoolRoom.slotEncounterSnapshots[1].rollA,
);
const slotOneRollBeforeJoin = leaderPoolRoom.slotEncounterSnapshots[1].rollA;
assert.equal(
  joinedRoom.slotEncounterSnapshots[1].rollA,
  slotOneRollBeforeJoin,
);

const leaderDto = await toEncounterRoomSnapshotDto(leaderPoolRoom, leaderPoolSession.playerId);
const joinerDto = await toEncounterRoomSnapshotDto(joinedRoom, joinerSession.playerId);
assert.equal(leaderDto.activeEncounter.rollA, leaderPoolRoom.slotEncounterSnapshots[0].rollA);
assert.equal(joinerDto.activeEncounter.rollA, joinedRoom.slotEncounterSnapshots[1].rollA);
assert.notEqual(leaderDto.activeEncounter.rollA, joinerDto.activeEncounter.rollA);

const slotChoiceRoom = await createRoom(joinerSession.playerId, joinerAvatarId);
const slotChoiceReady: EncounterRoom = {
  ...slotChoiceRoom,
  activeEncounterSnapshot: {
    ...slotChoiceRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: slotChoiceRoom.slotEncounterSnapshots.map((snapshot) => ({
    ...snapshot,
    actionReadyAt: Date.now() - 1,
  })) as EncounterRoom['slotEncounterSnapshots'],
  updatedAt: Date.now(),
};
await saveEncounterRoom(slotChoiceReady);
const afterSlotChoice = await submitChoice(joinerSession.playerId, joinerAvatarId, 'C');
const slotChoiceParticipant = afterSlotChoice.participants.find(
  (participant) => participant.playerId === joinerSession.playerId,
);
assert.ok(slotChoiceParticipant?.preparedResult);
const expectedPrimaryRoll = slotChoiceReady.slotEncounterSnapshots[1].rollPrimaryC
  ?? slotChoiceReady.slotEncounterSnapshots[1].rollC;
const expectedSecondaryRoll = slotChoiceReady.slotEncounterSnapshots[1].rollSecondaryC
  ?? slotChoiceReady.slotEncounterSnapshots[1].rollD;
assert.ok(
  slotChoiceParticipant?.preparedResult?.selectedRoll === expectedPrimaryRoll
    || slotChoiceParticipant?.preparedResult?.selectedRoll === expectedSecondaryRoll,
);

const helpCallerKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const helpCallerIdentityJwk = JSON.stringify(helpCallerKeyPair.publicKey.export({ format: 'jwk' }));
const helpCallerSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: helpCallerIdentityJwk,
  playerName: `room-help-caller-${Date.now()}`,
});
const helpCallerAvatarId = `help-caller-${Date.now()}`;
await savePlayerAvatar(helpCallerSession.playerId, {
  id: helpCallerAvatarId,
  name: 'Help Caller',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await createRoom(helpCallerSession.playerId, helpCallerAvatarId);

const helpFriendKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const helpFriendIdentityJwk = JSON.stringify(helpFriendKeyPair.publicKey.export({ format: 'jwk' }));
const helpFriendSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: helpFriendIdentityJwk,
  playerName: `room-help-friend-${Date.now()}`,
});
await savePlayerAvatar(helpFriendSession.playerId, {
  id: `help-friend-${Date.now()}`,
  name: 'Help Friend',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

const helpStrangerKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const helpStrangerIdentityJwk = JSON.stringify(helpStrangerKeyPair.publicKey.export({ format: 'jwk' }));
const helpStrangerSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: helpStrangerIdentityJwk,
  playerName: `room-help-stranger-${Date.now()}`,
});
await savePlayerAvatar(helpStrangerSession.playerId, {
  id: `help-stranger-${Date.now()}`,
  name: 'Help Stranger',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

const helpNow = Date.now();
await setPlayer(helpCallerSession.playerId, {
  friendIds: [helpFriendSession.playerId],
  lastPlayedAt: helpNow,
}, { merge: true });
await setPlayer(helpFriendSession.playerId, {
  lastPlayedAt: helpNow,
}, { merge: true });
await setPlayer(helpStrangerSession.playerId, {
  lastPlayedAt: helpNow,
}, { merge: true });

const helpResult = await broadcastCallForHelp(helpCallerSession.playerId, helpCallerAvatarId);
assert.ok(helpResult.invitedCount >= 1);

const friendInvites = await listPendingHelpInvitations(helpFriendSession.playerId);
const strangerInvites = await listPendingHelpInvitations(helpStrangerSession.playerId);
assert.ok(
  friendInvites.some((invite) => invite.fromPlayerId === helpCallerSession.playerId),
  'eligible friend should receive a help invitation',
);

const friendFeed = await queryActivityFeed(helpFriendSession.playerId);
const friendHelpEntry = friendFeed.find((entry) => entry.eventType === 'help_requested');
assert.ok(friendHelpEntry);
assert.equal(friendHelpEntry.message, 'Help Caller calls out for help.');
assert.ok(friendHelpEntry.joinAction);

if (strangerInvites.some((invite) => invite.fromPlayerId === helpCallerSession.playerId)) {
  const strangerFeed = await queryActivityFeed(helpStrangerSession.playerId);
  const strangerHelpEntry = strangerFeed.find((entry) => entry.eventType === 'help_requested');
  assert.ok(strangerHelpEntry);
  assert.equal(strangerHelpEntry.message, 'Help Caller calls out for help.');
}

const guestKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const guestIdentityJwk = JSON.stringify(guestKeyPair.publicKey.export({ format: 'jwk' }));
const guestSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: guestIdentityJwk,
  playerName: `room-guest-${Date.now()}`,
});
const guestAvatarId = `guest-avatar-${Date.now()}`;
await savePlayerAvatar(guestSession.playerId, {
  id: guestAvatarId,
  name: 'Room Guest',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

let partyRoom = await createRoom(session.playerId, avatarId);
partyRoom = {
  ...partyRoom,
  activeEncounterSnapshot: {
    ...partyRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(partyRoom);
await joinRoom(guestSession.playerId, guestAvatarId, partyRoom.roomId);

await submitChoice(session.playerId, avatarId, 'dice');
const guestChoiceRoom = await submitChoice(guestSession.playerId, guestAvatarId, 'dice');
assert.equal(guestChoiceRoom.roomState, 'waiting_continue');
const guestBeforeLeave = guestChoiceRoom.participants.find(
  (participant) => participant.playerId === guestSession.playerId,
);
assert.equal(guestBeforeLeave?.choiceState, 'ready_to_continue');
assert.ok(guestBeforeLeave?.preparedResult);
assert.ok(guestBeforeLeave?.outcomeSnapshotId);

const guestProgressionBefore = await getProgression<{ experience: number; level: number }>(
  guestSession.playerId,
  guestAvatarId,
);

await leaveRoom(guestSession.playerId, guestAvatarId);
const roomAfterGuestLeave = await loadEncounterRoom(partyRoom.roomId);
assert.ok(
  !roomAfterGuestLeave?.participants.some(
    (participant) => participant.playerId === guestSession.playerId,
  ),
  'guest hard depart should remove player from party',
);

const guestProgressionAfterLeave = await getProgression<{ experience: number; level: number }>(
  guestSession.playerId,
  guestAvatarId,
);
assert.ok(
  (guestProgressionAfterLeave?.experience ?? 0) > (guestProgressionBefore?.experience ?? 0)
  || (guestProgressionAfterLeave?.level ?? 1) > (guestProgressionBefore?.level ?? 1),
  'guest leave with prepared choice should commit progression',
);

const guestRejoinedRoom = await joinRoom(guestSession.playerId, guestAvatarId, partyRoom.roomId);
const guestRestored = guestRejoinedRoom.participants.find(
  (participant) => participant.playerId === guestSession.playerId,
);
assert.equal(guestRestored?.choiceState, 'choosing');
assert.equal(guestRestored?.preparedResult, undefined);
assert.equal(guestRestored?.resolutionSummary, undefined);

await leaveRoom(guestSession.playerId, guestAvatarId);
const guestSoloRoom = await createRoom(guestSession.playerId, guestAvatarId);
assert.equal(guestSoloRoom.leaderPlayerId, guestSession.playerId);
assert.equal(guestSoloRoom.participants.length, 1);
assert.equal(guestSoloRoom.participants[0]?.avatarId, guestAvatarId);
assert.equal(guestSoloRoom.participants[0]?.slotIndex, 0);
const partyAfterGuestSoloPlay = await loadEncounterRoom(partyRoom.roomId);
assert.ok(
  !partyAfterGuestSoloPlay?.participants.some(
    (participant) => participant.playerId === guestSession.playerId,
  ),
  'avatar selection solo play should fully depart the old party room',
);

await leaveRoom(guestSession.playerId, guestAvatarId);
await leaveAllRoomsForPlayer(guestSession.playerId);
const partyAfterGuestLeaveAll = await loadEncounterRoom(partyRoom.roomId);
assert.ok(
  !partyAfterGuestLeaveAll?.participants.some(
    (participant) => participant.playerId === guestSession.playerId,
  ),
  'leave all should remove the player from party rooms instead of leaving a disengaged ghost',
);
const guestOpenRoomId = await findActiveRoomIdForPlayerAvatar(
  guestSession.playerId,
  guestAvatarId,
);
assert.ok(guestOpenRoomId);
assert.notEqual(guestOpenRoomId, partyRoom.roomId);

await submitContinue(session.playerId, avatarId);
const advancedWhileGuestAway = await getActiveRoomForPlayer(session.playerId, avatarId);
assert.ok(
  advancedWhileGuestAway?.roomState === 'active_encounter'
  || advancedWhileGuestAway?.roomState === 'system_event',
  'host should advance after guest departs with choice committed',
);

const guestAfterAdvance = await joinRoom(
  guestSession.playerId,
  guestAvatarId,
  partyRoom.roomId,
);
const guestFreshChooser = guestAfterAdvance.participants.find(
  (participant) => participant.playerId === guestSession.playerId,
);
assert.equal(guestFreshChooser?.choiceState, 'choosing');
assert.equal(guestFreshChooser?.preparedResult, undefined);
assert.equal(guestFreshChooser?.resolutionSummary, undefined);

const soloCheckpointKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const soloCheckpointIdentityJwk = JSON.stringify(soloCheckpointKeyPair.publicKey.export({ format: 'jwk' }));
const soloCheckpointSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: soloCheckpointIdentityJwk,
  playerName: `solo-checkpoint-${Date.now()}`,
});
const soloCheckpointAvatarId = `solo-checkpoint-${Date.now()}`;
await savePlayerAvatar(soloCheckpointSession.playerId, {
  id: soloCheckpointAvatarId,
  name: 'Solo Checkpoint',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
let soloRoom = await createRoom(soloCheckpointSession.playerId, soloCheckpointAvatarId);
const snapshotIdBeforeLeave = soloRoom.activeEncounterSnapshot.snapshotId;
soloRoom = {
  ...soloRoom,
  activeEncounterSnapshot: {
    ...soloRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: soloRoom.slotEncounterSnapshots.map((snapshot) => ({
    ...snapshot,
    actionReadyAt: Date.now() - 1,
  })) as EncounterRoom['slotEncounterSnapshots'],
  updatedAt: Date.now(),
};
await saveEncounterRoom(soloRoom);
await submitChoice(soloCheckpointSession.playerId, soloCheckpointAvatarId, 'dice');
await leaveRoom(soloCheckpointSession.playerId, soloCheckpointAvatarId);
const openSoloRoom = await loadEncounterRoom(soloRoom.roomId);
assert.ok(openSoloRoom && openSoloRoom.roomState !== 'closed');
assert.equal(openSoloRoom.participants.length, 1);
assert.equal(
  await findActiveRoomIdForPlayerAvatar(
    soloCheckpointSession.playerId,
    soloCheckpointAvatarId,
  ),
  soloRoom.roomId,
  'solo away should keep the open room indexed for rejoin',
);

const countAdventureStartedEvents = (
  entries: Awaited<ReturnType<typeof queryActivityFeed>>,
): number => entries.filter((entry) => entry.eventType === 'adventure_started').length;

const adventureStartedBeforeRestore = countAdventureStartedEvents(
  await queryActivityFeed(soloCheckpointSession.playerId),
);
assert.ok(adventureStartedBeforeRestore >= 1);

const restored = await createRoom(soloCheckpointSession.playerId, soloCheckpointAvatarId);
assert.equal(restored.roomId, soloRoom.roomId);
assert.notEqual(
  restored.activeEncounterSnapshot.snapshotId,
  snapshotIdBeforeLeave,
  'solo leave with choice should advance before rejoin',
);
const adventureStartedAfterRestore = countAdventureStartedEvents(
  await queryActivityFeed(soloCheckpointSession.playerId),
);
assert.equal(
  adventureStartedAfterRestore,
  adventureStartedBeforeRestore + 1,
  'rejoining an open solo room should publish adventure_started',
);

const soloNoChoiceKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const soloNoChoiceIdentityJwk = JSON.stringify(soloNoChoiceKeyPair.publicKey.export({ format: 'jwk' }));
const soloNoChoiceSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: soloNoChoiceIdentityJwk,
  playerName: `solo-no-choice-${Date.now()}`,
});
const soloNoChoiceAvatarId = `solo-no-choice-${Date.now()}`;
await savePlayerAvatar(soloNoChoiceSession.playerId, {
  id: soloNoChoiceAvatarId,
  name: 'Solo No Choice',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
const soloNoChoiceRoom = await createRoom(soloNoChoiceSession.playerId, soloNoChoiceAvatarId);
const snapshotBeforeNoChoiceLeave = soloNoChoiceRoom.activeEncounterSnapshot.snapshotId;
await leaveRoom(soloNoChoiceSession.playerId, soloNoChoiceAvatarId);
const soloNoChoiceRestored = await createRoom(soloNoChoiceSession.playerId, soloNoChoiceAvatarId);
assert.equal(soloNoChoiceRestored.roomId, soloNoChoiceRoom.roomId);
assert.equal(
  soloNoChoiceRestored.activeEncounterSnapshot.snapshotId,
  snapshotBeforeNoChoiceLeave,
  'solo leave without choice should preserve the same encounter on rejoin',
);

const kickGuestKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const kickGuestIdentityJwk = JSON.stringify(kickGuestKeyPair.publicKey.export({ format: 'jwk' }));
const kickGuestSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: kickGuestIdentityJwk,
  playerName: `room-kick-guest-${Date.now()}`,
});
const kickGuestAvatarId = `kick-guest-${Date.now()}`;
await savePlayerAvatar(kickGuestSession.playerId, {
  id: kickGuestAvatarId,
  name: 'Kick Guest',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
const kickHostKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const kickHostIdentityJwk = JSON.stringify(kickHostKeyPair.publicKey.export({ format: 'jwk' }));
const kickHostSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: kickHostIdentityJwk,
  playerName: `room-kick-host-${Date.now()}`,
});
const kickHostAvatarId = `kick-host-${Date.now()}`;
await savePlayerAvatar(kickHostSession.playerId, {
  id: kickHostAvatarId,
  name: 'Kick Host',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
let kickPartyRoom = await createRoom(kickHostSession.playerId, kickHostAvatarId);
kickPartyRoom = {
  ...kickPartyRoom,
  activeEncounterSnapshot: {
    ...kickPartyRoom.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(kickPartyRoom);
await joinRoom(kickGuestSession.playerId, kickGuestAvatarId, kickPartyRoom.roomId);
await submitChoice(kickHostSession.playerId, kickHostAvatarId, 'dice');
await submitChoice(kickGuestSession.playerId, kickGuestAvatarId, 'dice');
const kickGuestProgressionBefore = await getProgression<{ experience: number; level: number }>(
  kickGuestSession.playerId,
  kickGuestAvatarId,
);
await kickParticipant(kickHostSession.playerId, kickHostAvatarId, kickGuestSession.playerId);
const kickGuestProgressionAfter = await getProgression<{ experience: number; level: number }>(
  kickGuestSession.playerId,
  kickGuestAvatarId,
);
assert.ok(
  (kickGuestProgressionAfter?.experience ?? 0) > (kickGuestProgressionBefore?.experience ?? 0)
  || (kickGuestProgressionAfter?.level ?? 1) > (kickGuestProgressionBefore?.level ?? 1),
);
const kickRoomAfter = await loadEncounterRoom(kickPartyRoom.roomId);
assert.ok(
  !kickRoomAfter?.participants.some(
    (participant) => participant.playerId === kickGuestSession.playerId,
  ),
);

console.log('roomService.test.ts passed');
