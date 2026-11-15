import assert from 'node:assert/strict';

import type { EncounterSnapshot, RoomParticipantDto } from '../../../api/http.js';
import { choiceRollBreakdown } from './rollBreakdown.js';

function encounter(fields: Partial<EncounterSnapshot> = {}): EncounterSnapshot {
  return {
    snapshotId: 'snap',
    encounterId: 20010,
    encounterDifficulty: 1,
    primarySolutionA: 10,
    primarySolutionB: 0,
    state: 'resolved',
    resolved: true,
    ...fields,
  };
}

function participant(fields: Partial<RoomParticipantDto> = {}): RoomParticipantDto {
  return {
    playerId: 'p',
    avatarId: 'a',
    slotIndex: 0,
    playerName: 'Myriana',
    avatar: { id: 'a', name: 'Myriana', level: 1, portrait: '', frame: '' } as RoomParticipantDto['avatar'],
    selectedDiceId: 'a',
    choiceState: 'resolved',
    focusState: 'none',
    continuePressed: false,
    isLocal: true,
    ...fields,
  };
}

assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'A', selectedSolutionId: 10, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 23 } }),
    encounter(),
    23,
  ),
  ['16 + 7'],
);

assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'A', selectedSolutionId: 10, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 11 } }),
    encounter({ encounterDifficulty: 2 }),
    11,
  ),
  ['5 + 7 − 1'],
);

assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'dice', preparedResult: { success: false, message: '', rewards: [], selectedRoll: -2 } }),
    encounter({ encounterDifficulty: 4 }),
    -2,
  ),
  ['1 − 3'],
);

assert.deepEqual(
  choiceRollBreakdown(
    participant({
      selectedAction: 'A',
      selectedSolutionId: 10,
      setPicks: [
        { slot: 'A', solutionId: 10, roll: 20 },
        { slot: 'B', solutionId: 22, roll: 10 },
      ],
      preparedResult: {
        success: true,
        message: '',
        rewards: [],
        selectedRoll: 14,
        pickRolls: [20, 10],
        diceFillRoll: 11,
      },
    }),
    encounter({ encounterDifficulty: 3, primarySolutionB: 21 }),
    14,
  ),
  ['15 + 7 − 2', '7 + 5 − 2', '13 − 2'],
);

console.log('rollBreakdown.test.ts passed');
