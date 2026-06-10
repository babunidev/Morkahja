import assert from 'node:assert/strict';

import type { EncounterRoomSnapshotDto, PersistedAvatar } from '../../api/http.js';
import { localAvatarDeathPending } from './roomContinue.js';

const avatar: PersistedAvatar = {
  id: 'avatar-1',
  name: 'Tester',
  race: 'Rokur',
  role: 'Mage',
  level: 3,
  experience: 0,
  portrait: 'm_portrait_1',
  frame: 'm_frame_1',
  displayTitle: null,
};

function roomWithLocal(
  local: EncounterRoomSnapshotDto['participants'][number],
  extras?: Partial<EncounterRoomSnapshotDto>,
): EncounterRoomSnapshotDto {
  return {
    roomId: 'room-1',
    leaderPlayerId: 'player-1',
    roomState: 'active_encounter',
    activeEncounter: {
      snapshotId: 'snap-1',
      encounterId: 1,
      encounterTitle: 'Atranor',
      encounterImageName: 'atranor.webp',
      rewardIds: [],
    },
    participants: [local],
    slotStates: ['locked', 'open', 'open'],
    updatedAt: 1,
    ...extras,
  } as EncounterRoomSnapshotDto;
}

{
  const pending = localAvatarDeathPending(roomWithLocal({
    playerId: 'player-1',
    avatarId: avatar.id,
    slotIndex: 0,
    playerName: 'Tester',
    avatar,
    choiceState: 'resolved',
    focusState: 'none',
    continuePressed: true,
    isLocal: true,
    resolutionSummary: {
      success: false,
      message: 'Misery',
      rewards: [],
      avatarDied: true,
    },
  }));
  assert.equal(pending?.id, avatar.id);
}

{
  const pending = localAvatarDeathPending(roomWithLocal({
    playerId: 'player-1',
    avatarId: avatar.id,
    slotIndex: 0,
    playerName: 'Tester',
    avatar: { ...avatar, status: 'failed' },
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    isLocal: true,
  }));
  assert.equal(pending?.status, 'failed');
}

{
  const pending = localAvatarDeathPending(roomWithLocal({
    playerId: 'player-1',
    avatarId: avatar.id,
    slotIndex: 0,
    playerName: 'Tester',
    avatar,
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    isLocal: true,
  }, {
    systemEvent: {
      actorPlayerId: 'player-1',
      encounterId: 1,
      kind: 'atranor',
      isLocalActor: true,
      isLocalWitness: false,
      lastEventRecap: {
        success: false,
        message: 'Hardship',
        rewards: [],
        avatarDied: true,
      },
    },
  }));
  assert.equal(pending?.id, avatar.id);
}

{
  const pending = localAvatarDeathPending(roomWithLocal({
    playerId: 'player-1',
    avatarId: avatar.id,
    slotIndex: 0,
    playerName: 'Tester',
    avatar,
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    isLocal: true,
    resolutionSummary: undefined,
  }));
  assert.equal(pending, null);
}

console.log('roomContinue.test.ts passed');
