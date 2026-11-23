import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import type { AvatarInventory } from '../types/avatar.js';
import { ensureAvatar } from './encounterGenerator.js';
import { equipAvatarItem, EquipmentRequestError } from './equipmentService.js';
import { loadInventory, persistInventory } from './inventoryService.js';
import { savePlayerAvatar } from './playerService.js';
import { saveEncounterRoom } from './roomPersistence.js';
import { createRoom, leaveAllRoomsForPlayer, submitChoice, submitContinue } from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Equipment (D-056) through the room: refused while choosing, allowed once the
// choice is made, and kept through Continue, which writes the prepared outcome.
const CHART = 10007; // Explorer's Chart, solution type 6
const KEY = 10012; // Shadowgate Key, solution type 8

function chartEncounterRoom(room: EncounterRoom): EncounterRoom {
  const fixture = {
    encounterDifficulty: 1 as const,
    primarySolutionA: 0,
    secondarySolutionTypeA: 0,
    primarySolutionB: 0,
    secondarySolutionTypeB: 6,
    rollSecondaryB: 14,
    rollE: 3,
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

function uses(inventory: AvatarInventory, solutionId: number): number {
  return inventory.items
    .filter((item) => item.solutionId === solutionId)
    .reduce((sum, item) => sum + item.uses, 0);
}

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(identityKeyPair, identityPublicJwk, `equipment-${Date.now()}`);
const avatarId = `avatar-equipment-${Date.now()}`;

await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'Equipment',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await ensureAvatar(session.playerId, avatarId, {
  id: avatarId,
  name: 'Equipment',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);
await persistInventory(session.playerId, avatarId, {
  spellbook: [],
  items: [
    { solutionId: CHART, solutionType: 6, uses: 2 },
    { solutionId: KEY, solutionType: 8, uses: 1 },
  ],
  essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
});
await leaveAllRoomsForPlayer(session.playerId);

// Outside a room (the avatar selection): equipping adds the slot's charge.
{
  const inventory = await equipAvatarItem(session.playerId, avatarId, 0, CHART);
  assert.deepEqual(inventory.equipped, [CHART, null]);
  assert.equal(uses(inventory, CHART), 3);
}

const room = chartEncounterRoom(await createRoom(session.playerId, avatarId));
await saveEncounterRoom(room);

// Still choosing: refused.
await assert.rejects(
  equipAvatarItem(session.playerId, avatarId, 1, KEY),
  (error: unknown) => error instanceof EquipmentRequestError && error.code === 'CHOICE_OPEN',
);

// The equipped chart in slot B rolls 14: the charge comes back.
const after = await submitChoice(session.playerId, avatarId, 'B', CHART);
const actor = after.participants.find((entry) => entry.avatarId === avatarId);
assert.equal(actor?.preparedResult?.selectedRoll, 14);
assert.deepEqual(actor?.preparedResult?.equipmentRegain, [{ solutionId: CHART, charges: 1 }]);

// The choice is made: equipping is allowed, and Continue keeps it.
{
  const inventory = await equipAvatarItem(session.playerId, avatarId, 1, KEY);
  assert.deepEqual(inventory.equipped, [CHART, KEY]);
}
await submitContinue(session.playerId, avatarId);
{
  const inventory = await loadInventory(session.playerId, avatarId);
  assert.deepEqual(inventory.equipped, [CHART, KEY]);
  assert.equal(uses(inventory, CHART), 3, 'used once at 14, given back');
  assert.equal(uses(inventory, KEY), 2, 'one charge and the slot charge');
}

await leaveAllRoomsForPlayer(session.playerId);
console.log('equipmentRoom.test.ts passed');
