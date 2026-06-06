import assert from 'node:assert/strict';

import type { EncounterRoomSnapshotDto, RoomParticipantDto } from '../../api/http.js';
import { shouldApplyServerInventory } from './roomContinue.js';

function participant(
  overrides: Partial<RoomParticipantDto> = {},
): RoomParticipantDto {
  return {
    playerId: 'local',
    avatarId: 'avatar-1',
    slotIndex: 0,
    playerName: 'Local',
    avatar: {
      id: 'avatar-1',
      name: 'Hero',
      race: 'Rokur',
      role: 'Warrior',
      level: 1,
      experience: 0,
      portrait: 'portrait',
      frame: 'frame',
      displayTitle: null,
    },
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    selectedDiceId: 'a',
    isLocal: true,
    ...overrides,
  };
}

function room(
  roomState: EncounterRoomSnapshotDto['roomState'],
  local: RoomParticipantDto,
): EncounterRoomSnapshotDto {
  return {
    roomId: 'room-1',
    leaderPlayerId: 'local',
    roomState,
    activeEncounter: {
      snapshotId: 'snap-1',
      encounterId: 20001,
      encounterTitle: 'Test',
      encounterImageName: 'test.webp',
      rewardIds: [],
    },
    participants: [local],
    slotStates: ['locked', 'open', 'open'],
    helpCalledForEncounter: false,
    updatedAt: 1,
  } as EncounterRoomSnapshotDto;
}

{
  const local = participant({ preparedResult: { success: true, message: 'ok', rewards: [] } });
  assert.equal(shouldApplyServerInventory(room('waiting_continue', local), local), false);
}

{
  const local = participant({ resolutionSummary: { success: true, message: 'ok', rewards: [] } });
  assert.equal(shouldApplyServerInventory(room('waiting_continue', local), local), true);
}

{
  const local = participant();
  assert.equal(shouldApplyServerInventory(room('system_event', local), local), true);
}

{
  const local = participant();
  assert.equal(shouldApplyServerInventory(room('active_encounter', local), local), true);
}

{
  const local = participant();
  assert.equal(shouldApplyServerInventory(room('advancing', local), local), true);
}

console.log('roomContinueInventory.test.ts: all assertions passed');
