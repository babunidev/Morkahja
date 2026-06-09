import assert from 'node:assert/strict';

import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { DEFAULT_SLOT_STATES } from '../domain/rooms/RoomSlot.js';
import {
  assertEncounterChoiceAllowed,
  ChoiceLockedError,
  checkpointFromRoom,
  isSoloLeaderRoom,
} from './soloRoomCheckpointService.js';

const snapshotId = 'checkpoint-test-snapshot';
const encounterSnapshot = {
  snapshotId,
  encounterId: 1,
  encounterTitle: 'Test',
  encounterDifficulty: 1,
  encounterFollow: 0,
  encounterImageName: 'test.webp',
  encounterText: 'Test',
  encounterType: 1 as const,
  encounterExpansion: 0,
  createdAt: Date.now(),
  actionReadyAt: Date.now() - 1,
} as EncounterSnapshot;

const room: EncounterRoom = {
  roomId: 'checkpoint-room',
  leaderPlayerId: 'SoloLeader',
  participants: [{
    playerId: 'SoloLeader',
    avatarId: 'avatar-solo',
    slotIndex: 0,
    joinedAt: Date.now(),
    choiceState: 'choosing',
    focusState: 'none',
    continuePressed: false,
    lastInteractionAt: Date.now(),
  }],
  slotStates: DEFAULT_SLOT_STATES,
  mergedExpansions: [0],
  activeEncounterSnapshot: encounterSnapshot,
  slotEncounterSnapshots: [encounterSnapshot, encounterSnapshot, encounterSnapshot],
  roomState: 'active_encounter',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

assert.equal(isSoloLeaderRoom(room), true);
assert.ok(checkpointFromRoom(room));

const lockedChoice = {
  snapshotId,
  selectedAction: { type: 'dice' as const },
};

assert.doesNotThrow(() => {
  assertEncounterChoiceAllowed(room, 'SoloLeader', { type: 'dice' }, undefined, lockedChoice);
});

assert.throws(
  () => {
    assertEncounterChoiceAllowed(room, 'SoloLeader', { type: 'primaryA' }, undefined, lockedChoice);
  },
  (error: unknown) => error instanceof ChoiceLockedError && error.code === 'CHOICE_LOCKED',
);

console.log('soloRoomCheckpointService.test.ts passed');
