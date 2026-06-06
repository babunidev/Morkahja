import assert from 'node:assert/strict';

import type { EncounterRoomSnapshotDto } from '../../api/http.js';
import {
  levelUpEncounterJustBecameVisible,
  levelUpSoundKeyForRoom,
  shouldPlayLevelUpSound,
} from './levelUpSoundCue.js';

const baseAvatar = {
  id: 'avatar-1',
  name: 'Hero',
  race: 'Rokur' as const,
  role: 'Warrior' as const,
  level: 2,
  experience: 0,
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  displayTitle: null,
};

function levelUpEncounter(overrides: Partial<EncounterRoomSnapshotDto['activeEncounter']> = {}) {
  return {
    snapshotId: 'snap-level-up',
    encounterId: 2,
    encounterTitle: 'Level Up',
    encounterImageName: 'test',
    encounterText: '',
    encounterDifficulty: 1,
    encounterRewardAmount: 1,
    primarySolutionA: 0,
    primarySolutionB: 0,
    primarySolutionC: 0,
    primarySolutionD: 0,
    secondarySolutionTypeA: 0,
    secondarySolutionTypeB: 0,
    secondarySolutionTypeC: 0,
    secondarySolutionTypeD: 0,
    rollA: 0,
    rollB: 0,
    rollC: 0,
    rollD: 0,
    rollPrimaryA: 0,
    rollPrimaryB: 0,
    rollPrimaryC: 0,
    rollPrimaryD: 0,
    rollSecondaryA: 0,
    rollSecondaryB: 0,
    rollSecondaryC: 0,
    rollSecondaryD: 0,
    rollE: 96,
    rewardIds: [],
    prosperityRewardId: null,
    state: 'active' as const,
    resolved: false,
    ...overrides,
  };
}

function room(overrides: Partial<EncounterRoomSnapshotDto>): EncounterRoomSnapshotDto {
  return {
    roomId: 'room-1',
    roomState: 'system_event',
    leaderPlayerId: 'actor',
    participants: [],
    slotStates: ['open', 'open', 'open'],
    activeEncounter: levelUpEncounter(),
    continueReadiness: 'none',
    updatedAt: 1,
    systemEvent: {
      actorPlayerId: 'actor',
      encounterId: 2,
      kind: 'level_up',
      isLocalActor: false,
      isLocalWitness: true,
    },
    ...overrides,
  };
}

{
  const previous = room({
    roomState: 'waiting_continue',
    systemEvent: undefined,
    activeEncounter: levelUpEncounter({
      snapshotId: 'snap-normal',
      encounterId: 42,
      encounterTitle: 'Normal',
    }),
  });

  const next = room({});

  assert.equal(levelUpEncounterJustBecameVisible(previous, next), true);
  assert.equal(
    levelUpSoundKeyForRoom(next),
    'room-1:snap-level-up:level-up-visible',
  );
}

{
  const previous = room({});
  const next = room({
    systemEvent: {
      actorPlayerId: 'actor',
      encounterId: 2,
      kind: 'level_up',
      isLocalActor: false,
      isLocalWitness: true,
      actorOutcome: {
        success: true,
        message: 'Level up',
        rewards: [10001],
        selectedRoll: 96,
      },
    },
  });

  assert.equal(levelUpEncounterJustBecameVisible(previous, next), false);
}

{
  const previous = room({
    roomState: 'waiting_continue',
    systemEvent: undefined,
    activeEncounter: levelUpEncounter({ snapshotId: 'snap-normal', encounterId: 42 }),
    participants: [{
      playerId: 'actor',
      avatarId: 'actor-avatar',
      slotIndex: 0,
      playerName: 'Actor',
      avatar: baseAvatar,
      choiceState: 'ready_to_continue',
      focusState: 'none',
      continuePressed: false,
      isLocal: true,
      preparedResult: {
        success: true,
        message: 'Nice',
        rewards: [],
        leveledUp: true,
      },
    }],
  });

  const next = previous;

  assert.equal(levelUpEncounterJustBecameVisible(previous, next), false);
}

{
  const played = new Set<string>();
  const previous = room({
    roomState: 'active_encounter',
    systemEvent: undefined,
    activeEncounter: levelUpEncounter({ snapshotId: 'snap-normal', encounterId: 42 }),
  });
  const next = room({});

  const firstKey = shouldPlayLevelUpSound(previous, next, played);
  assert.equal(firstKey, 'room-1:snap-level-up:level-up-visible');
  played.add(firstKey!);

  assert.equal(shouldPlayLevelUpSound(next, next, played), null);
  assert.equal(shouldPlayLevelUpSound(next, {
    ...next,
    updatedAt: next.updatedAt + 1,
  }, played), null);
}

console.log('levelUpSoundCue.test.ts: all assertions passed');
