import assert from 'node:assert/strict';

import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { RoomParticipant } from '../domain/rooms/RoomParticipant.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import {
  buildPendingSystemEventQueue,
  participantsAtSystemEventStart,
} from './roomService.js';

function participant(
  playerId: string,
  slotIndex: number,
  summary: NonNullable<RoomParticipant['resolutionSummary']>,
): RoomParticipant {
  return {
    playerId,
    avatarId: `${playerId}-avatar`,
    slotIndex,
    joinedAt: 0,
    choiceState: 'resolved',
    focusState: 'none',
    continuePressed: false,
    lastInteractionAt: 0,
    resolutionSummary: summary,
  };
}

const room = {
  leaderPlayerId: 'leader',
} as EncounterRoom;

{
  const queue = buildPendingSystemEventQueue(
    room,
    [
      participant('slot-two', 2, { success: true, message: 'up', rewards: [], leveledUp: true }),
      participant('leader', 1, { success: true, message: 'up', rewards: [], leveledUp: true }),
      participant('slot-one', 0, { success: true, message: 'up', rewards: [], leveledUp: true }),
    ],
    new Map([
      ['slot-two', true],
      ['leader', true],
      ['slot-one', true],
    ]),
  );

  assert.deepEqual(
    queue.map((item) => item.actorPlayerId),
    ['leader', 'slot-one', 'slot-two'],
  );
  assert.deepEqual(
    queue.map((item) => item.encounterId),
    [
      LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      LEVEL_UP_ENCOUNTER_NUMERIC_ID,
    ],
  );
}

{
  const queue = buildPendingSystemEventQueue(room, [
    participant('leader', 0, { success: true, message: 'up', rewards: [], leveledUp: true }),
  ]);

  assert.deepEqual(queue, []);
}

{
  const queue = buildPendingSystemEventQueue(room, [
    participant('slot-one', 0, { success: false, message: 'death', rewards: [], deathTriggered: true }),
    participant('leader', 1, {
      success: false,
      message: 'death+up',
      rewards: [],
      deathTriggered: true,
      leveledUp: true,
    }),
  ]);

  assert.deepEqual(queue, [
    {
      actorPlayerId: 'leader',
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      chainedLevelUp: true,
    },
    {
      actorPlayerId: 'slot-one',
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    },
  ]);
}

{
  const reset = participantsAtSystemEventStart([
    participant('leader', 0, { success: true, message: 'up', rewards: [], leveledUp: true }),
    participant('slot-one', 1, { success: true, message: 'up', rewards: [], leveledUp: true }),
    participant('slot-two', 2, { success: true, message: 'up', rewards: [], leveledUp: true }),
  ], 'slot-one');

  assert.equal(
    reset.filter((entry) => entry.choiceState === 'choosing').length,
    1,
  );
  assert.equal(reset.find((entry) => entry.playerId === 'slot-one')?.choiceState, 'choosing');
  assert.equal(reset.find((entry) => entry.playerId === 'leader')?.choiceState, 'witnessing');
  assert.equal(reset.find((entry) => entry.playerId === 'slot-two')?.choiceState, 'witnessing');
}

console.log('systemEventQueue.test.ts: all assertions passed');
