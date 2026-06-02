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
  listPendingHelpInvitations,
  participantsAtSystemEventStart,
  RoomError,
  setFocusState,
  submitChoice,
  submitContinue,
  tickInactivity,
} from './roomService.js';
import { setPlayer } from '../db/postgresDocumentStore.js';
import { queryActivityFeed } from './gameEventService.js';
import { toEncounterRoomSnapshotDto } from './roomDtoMapper.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { INACTIVITY_MS, ROOM_INACTIVITY_ENABLED } from '../domain/rooms/roomConstants.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';

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
assert.notEqual(originalAvatarRoomAgain.roomId, switchedAvatarRoom.roomId);
assert.equal(originalAvatarRoomAgain.participants[0]?.avatarId, avatarId);
const firstRoomAfterSwitch = await loadEncounterRoom(room.roomId);
assert.equal(firstRoomAfterSwitch?.roomState, 'closed');

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
const afterInactivityTick = await tickInactivity(multiInactivityRoom);
assert.equal(
  afterInactivityTick.participants[0]?.choiceState,
  ROOM_INACTIVITY_ENABLED ? 'disengaged' : 'choosing',
);

const roomForReengage: EncounterRoom = ROOM_INACTIVITY_ENABLED
  ? afterInactivityTick
  : {
    ...afterInactivityTick,
    participants: afterInactivityTick.participants.map((participant, index) => (
      index === 0
        ? {
            ...participant,
            choiceState: 'disengaged' as const,
            disconnectedAt: Date.now(),
            preparedResult: {
              success: false,
              message: 'Inactive',
              rewards: [],
            },
          }
        : participant
    )),
  };
if (!ROOM_INACTIVITY_ENABLED) {
  await saveEncounterRoom(roomForReengage);
}

const reengagedByFocus = await setFocusState(
  session.playerId,
  roomForReengage.participants[0]!.avatarId,
  'lore',
);
const reengagedParticipant = reengagedByFocus.participants.find(
  (participant) => participant.playerId === session.playerId,
);
assert.equal(reengagedParticipant?.choiceState, 'choosing');
assert.notEqual(reengagedParticipant?.preparedResult?.message, 'Inactive');

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

console.log('roomService.test.ts passed');
