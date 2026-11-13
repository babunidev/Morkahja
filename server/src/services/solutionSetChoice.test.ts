import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { ensureAvatar } from './encounterGenerator.js';
import { flattenInventorySolutionIds, loadInventory, persistInventory } from './inventoryService.js';
import { savePlayerAvatar } from './playerService.js';
import { saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  leaveAllRoomsForPlayer,
  parseClientSolutionSet,
  RoomError,
  submitChoice,
  submitContinue,
  submitSetPick,
} from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Solution sets (D-019) through the room choice path: one skill and the dice
// for the missing solution in an encounter that needs two.
function setEncounterRoom(room: EncounterRoom): EncounterRoom {
  const fixture = {
    encounterDifficulty: 3 as const,
    primarySolutionA: 10001,
    secondarySolutionTypeA: 0,
    primarySolutionB: 0,
    secondarySolutionTypeB: 6,
    rollPrimaryA: 90,
    rollSecondaryB: 70,
    rollE: 15,
    extraRolls: undefined,
    actionReadyAt: Date.now() - 1,
  };
  return {
    ...room,
    activeEncounterSnapshot: { ...room.activeEncounterSnapshot, ...fixture },
    slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot) => ({
      ...snapshot,
      ...fixture,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  };
}

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(identityKeyPair, identityPublicJwk, `solution-set-${Date.now()}`);
const avatarId = `avatar-solution-set-${Date.now()}`;

await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'Solution Set',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await ensureAvatar(session.playerId, avatarId, {
  id: avatarId,
  name: 'Solution Set',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);
await persistInventory(session.playerId, avatarId, {
  spellbook: [{ solutionId: 10001, solutionType: 1, uses: 1 }],
  items: [{ solutionId: 10005, solutionType: 6, uses: 1 }],
  essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
});

// The request shape is checked before anything else.
assert.throws(() => parseClientSolutionSet(['A', 'E'], false), RoomError);
assert.throws(() => parseClientSolutionSet([], false), RoomError);
assert.throws(() => parseClientSolutionSet(['A', 'A', 'A', 'A', 'A'], false), RoomError);
assert.deepEqual(parseClientSolutionSet(['A', 'B'], true), { picks: ['A', 'B'], diceFill: true });
assert.equal(parseClientSolutionSet(undefined, true), undefined);

{
  await leaveAllRoomsForPlayer(session.playerId);
  const room = setEncounterRoom(await createRoom(session.playerId, avatarId));
  await saveEncounterRoom(room);

  // A set must start with the action it is sent with.
  await assert.rejects(
    submitChoice(session.playerId, avatarId, 'A', 10001, { picks: ['B', 'A'], diceFill: true }),
    RoomError,
  );

  // The skill in A (90), the item in B as an alternative (70) and the dice for
  // the third (15): (90 + 70 + 15) / 3 = 58 → Disengage, not a success.
  const after = await submitChoice(session.playerId, avatarId, 'A', 10001, {
    picks: ['A', 'B'],
    diceFill: true,
  });
  const actor = after.participants.find((entry) => entry.avatarId === avatarId);
  assert.equal(actor?.preparedResult?.selectedRoll, 58);
  assert.equal(actor?.preparedResult?.success, false);
  assert.deepEqual(actor?.preparedResult?.usedInventorySolutions, [10001, 10005]);
  assert.deepEqual(actor?.selectedAction, { type: 'primaryA', picks: ['A', 'B'], diceFill: true });

  // Spent on Continue, like every prepared result.
  await submitContinue(session.playerId, avatarId);
  const inventory = await loadInventory(session.playerId, avatarId);
  const remaining = flattenInventorySolutionIds(inventory);
  assert.equal(remaining.filter((id) => id === 10001).length, 0);
  assert.equal(remaining.filter((id) => id === 10005).length, 0);
}

// Picks are locked and revealed one at a time (D-025); the final choice
// resolves the locked picks, whatever the client sends.
{
  await persistInventory(session.playerId, avatarId, {
    spellbook: [{ solutionId: 10001, solutionType: 1, uses: 1 }],
    items: [{ solutionId: 10005, solutionType: 6, uses: 1 }],
    essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
  });
  await leaveAllRoomsForPlayer(session.playerId);
  const room = setEncounterRoom(await createRoom(session.playerId, avatarId));
  await saveEncounterRoom(room);

  const first = await submitSetPick(session.playerId, avatarId, 'A');
  assert.deepEqual(first.picks, [{ slot: 'A', solutionId: 10001, roll: 90 }]);
  const second = await submitSetPick(session.playerId, avatarId, 'B');
  assert.deepEqual(second.picks.map((pick) => pick.roll), [90, 70]);
  // Nothing left to cover a third pick of A.
  await assert.rejects(submitSetPick(session.playerId, avatarId, 'A'), RoomError);

  const after = await submitChoice(session.playerId, avatarId, 'B', 10005, { picks: ['B'], diceFill: true });
  const actor = after.participants.find((entry) => entry.avatarId === avatarId);
  assert.equal(actor?.preparedResult?.selectedRoll, 58);
  assert.deepEqual(actor?.preparedResult?.pickRolls, [90, 70]);
  assert.equal(actor?.preparedResult?.diceFillRoll, 15);
  await submitContinue(session.playerId, avatarId);
}

console.log('solutionSetChoice.test.ts: all assertions passed');
