import assert from 'node:assert/strict';

import type { EncounterRoomSnapshotDto } from '../../api/http.js';
import { encounterSnapshotAdvanced } from './roomAdvanceOrchestrator.js';

function room(
  roomState: EncounterRoomSnapshotDto['roomState'],
  snapshotId: string,
): EncounterRoomSnapshotDto {
  return {
    roomId: 'room-1',
    leaderPlayerId: 'leader',
    roomState,
    activeEncounter: {
      snapshotId,
      encounterId: 20001,
      encounterTitle: 'Test',
      encounterImageName: 'test.webp',
      rewardIds: [],
    },
    participants: [],
    slotStates: ['locked', 'open', 'open'],
    updatedAt: 1,
  } as EncounterRoomSnapshotDto;
}

{
  const baseline = room('waiting_continue', 'snap-a');
  const next = room('active_encounter', 'snap-b');
  assert.equal(encounterSnapshotAdvanced(baseline, next), true);
}

{
  const baseline = room('waiting_continue', 'snap-a');
  const next = room('system_event', 'snap-b');
  assert.equal(encounterSnapshotAdvanced(baseline, next), true);
}

{
  const baseline = room('system_event', 'snap-a');
  const next = room('system_event', 'snap-b');
  assert.equal(encounterSnapshotAdvanced(baseline, next), true);
}

{
  const baseline = room('system_event', 'snap-a');
  const next = room('active_encounter', 'snap-b');
  assert.equal(encounterSnapshotAdvanced(baseline, next), true);
}

{
  const baseline = room('system_event', 'snap-a');
  const next = room('waiting_continue', 'snap-a');
  assert.equal(encounterSnapshotAdvanced(baseline, next), false);
}

{
  const baseline = room('waiting_continue', 'snap-a');
  const next = room('waiting_continue', 'snap-a');
  assert.equal(encounterSnapshotAdvanced(baseline, next), false);
}

console.log('roomAdvanceOrchestrator.test.ts: all assertions passed');
