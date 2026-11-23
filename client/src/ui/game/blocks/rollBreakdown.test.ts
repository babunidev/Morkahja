import assert from 'node:assert/strict';

import type { EncounterSnapshot, RoomParticipantDto } from '../../../api/http.js';
import { setGameContent } from '../../../data/gameContent.js';
import { choiceRollBreakdown } from './rollBreakdown.js';

setGameContent({
  version: 'test',
  encounters: { 20010: { mEncounterID: 20010 } },
  solutions: {
    10: { mSolutionID: 10, mSolutionIconName: 'tool_key', mSolutionInventoryType: 2, mSolutionType: 8 },
    22: { mSolutionID: 22, mSolutionIconName: 'tool_map', mSolutionInventoryType: 2, mSolutionType: 6 },
    10015: { mSolutionID: 10015, mSolutionIconName: 'tool_epic_atranor_potion', mSolutionInventoryType: 3, mSolutionType: 77 },
    30: { mSolutionID: 30, mSolutionIconName: 'skill_stealth', mSolutionInventoryType: 1, mSolutionType: 35 },
  },
  expansions: {},
  frames: [null, { frameID: 1 }],
  portraits: [null, { avatarID: 1 }],
} as never);

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
    participant({ selectedAction: 'A', selectedSolutionId: 10, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 21 } }),
    encounter(),
    21,
  ),
  ['16 + 5'],
);

assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'A', selectedSolutionId: 10, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 9 } }),
    encounter({ encounterDifficulty: 2 }),
    9,
  ),
  ['5 + 5 − 1'],
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
  ['17 + 5 − 2', '10 + 2 − 2', '13 − 2'],
);

assert.deepEqual(
  choiceRollBreakdown(
    participant({
      selectedAction: 'dice',
      preparedResult: {
        success: true,
        message: '',
        rewards: [],
        selectedRoll: 13,
        diceFillRolls: [15, 9],
      },
    }),
    encounter({ encounterDifficulty: 2 }),
    12,
  ),
  ['16 − 1', '10 − 1'],
);

console.log('rollBreakdown.test.ts passed');

// A rare item adds its own +1 to the slot's bonus.
assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'A', selectedSolutionId: 10015, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 26 } }),
    encounter({ primarySolutionA: 10015 }),
    26,
  ),
  ['20 + 6'],
);
assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'B', selectedSolutionId: 10015, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 13 } }),
    encounter({ primarySolutionB: 21 }),
    13,
  ),
  ['10 + 3'],
);

// Specialization (D-056): a Stealth skill of a Stealth specialist shows +1 more.
assert.deepEqual(
  choiceRollBreakdown(
    participant({
      avatar: { id: 'a', name: 'Myriana', level: 1, portrait: '', frame: '', specialization: 35 } as RoomParticipantDto['avatar'],
      selectedAction: 'A',
      selectedSolutionId: 30,
      preparedResult: { success: true, message: '', rewards: [], selectedRoll: 22 },
    }),
    encounter({ primarySolutionA: 30 }),
    22,
  ),
  ['16 + 6'],
);
// Without it, the same skill shows the slot bonus only.
assert.deepEqual(
  choiceRollBreakdown(
    participant({ selectedAction: 'A', selectedSolutionId: 30, preparedResult: { success: true, message: '', rewards: [], selectedRoll: 21 } }),
    encounter({ primarySolutionA: 30 }),
    21,
  ),
  ['16 + 5'],
);
