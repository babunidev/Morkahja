import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createInitialProgression } from '../domain/avatar/AvatarProgression.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import { setProgression } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import {
  flattenInventorySolutionIds,
  loadInventory,
  persistInventory,
} from './inventoryService.js';
import { savePlayerAvatar } from './playerService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  leaveAllRoomsForPlayer,
  submitChoice,
  submitContinue,
} from './roomService.js';
import { bootstrapSession } from './sessionService.js';

function randomDeviceKey(): string {
  return `device-system-inv-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function countSolutionCharges(
  inventory: Awaited<ReturnType<typeof loadInventory>>,
  solutionId: number,
): number {
  return flattenInventorySolutionIds(inventory).filter((id) => id === solutionId).length;
}

function totalEssenceUses(inventory: Awaited<ReturnType<typeof loadInventory>>): number {
  return inventory.essences.reduce((total, item) => total + item.uses, 0);
}

function totalItemUses(inventory: Awaited<ReturnType<typeof loadInventory>>): number {
  return inventory.items.reduce((total, item) => total + item.uses, 0);
}

function readyEncounterRoom(room: EncounterRoom, slotIndex: number): EncounterRoom {
  return {
    ...room,
    activeEncounterSnapshot: {
      ...room.activeEncounterSnapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      rollPrimaryA: index === slotIndex ? 10 : 96,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  };
}

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const challenge = `morkahja-restore:${identityPublicJwk}`;
sign(
  'sha256',
  Buffer.from(challenge, 'utf8'),
  { key: identityKeyPair.privateKey, dsaEncoding: 'ieee-p1363' },
).toString('base64url');

const session = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: identityPublicJwk,
  playerName: `system-event-inventory-${Date.now()}`,
});

const avatarId = `avatar-system-inv-${Date.now()}`;

await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'System Event Inventory',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

await ensureAvatar(session.playerId, avatarId, {
  id: avatarId,
  name: 'System Event Inventory',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);

await persistInventory(session.playerId, avatarId, {
  spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
  items: [
    { solutionId: 10005, solutionType: 6, uses: 2 },
    { solutionId: 10006, solutionType: 6, uses: 2 },
  ],
  essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
});

{
  await leaveAllRoomsForPlayer(session.playerId);
  let room = await createRoom(session.playerId, avatarId);
  room = readyEncounterRoom(room, room.participants[0]!.slotIndex);
  await saveEncounterRoom(room);

  const afterChoice = await submitChoice(session.playerId, avatarId, 'A');
  const actor = afterChoice.participants.find((entry) => entry.avatarId === avatarId);

  assert.equal(actor?.preparedResult?.success, false);
  assert.deepEqual(actor?.preparedResult?.usedInventorySolutions, [10001, 10001]);
  assert.equal(actor?.preparedResult?.lostInventorySolutions?.length, 4);

  const afterContinue = await submitContinue(session.playerId, avatarId);
  assert.equal(afterContinue.roomState, 'active_encounter');
  assert.equal(afterContinue.systemEvent, undefined);

  const inventory = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventory, 10001), 0);
  assert.equal(totalEssenceUses(inventory), 3);
  assert.equal(totalItemUses(inventory), 2);
}

{
  await leaveAllRoomsForPlayer(session.playerId);
  await persistInventory(session.playerId, avatarId, {
    spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
    items: [
      { solutionId: 10005, solutionType: 6, uses: 2 },
      { solutionId: 10006, solutionType: 6, uses: 2 },
    ],
    essences: [{ solutionId: 10010, solutionType: 15, uses: 2 }],
  });

  let room = await createRoom(session.playerId, avatarId);
  room = readyEncounterRoom(room, room.participants[0]!.slotIndex);
  await saveEncounterRoom(room);

  await submitChoice(session.playerId, avatarId, 'A');
  const afterNormalContinue = await submitContinue(session.playerId, avatarId);

  assert.equal(afterNormalContinue.roomState, 'system_event');
  assert.equal(
    afterNormalContinue.systemEvent?.queue[0]?.encounterId,
    DEATH_ENCOUNTER_NUMERIC_ID,
  );

  const inventoryAfterNormalCommit = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventoryAfterNormalCommit, 10001), 0);
  assert.equal(totalEssenceUses(inventoryAfterNormalCommit), 0);
  assert.equal(totalItemUses(inventoryAfterNormalCommit), 2);

  const persisted = await loadEncounterRoom(afterNormalContinue.roomId);
  const slotIndex = persisted!.participants[0]!.slotIndex;
  await saveEncounterRoom({
    ...persisted!,
    activeEncounterSnapshot: {
      ...persisted!.activeEncounterSnapshot,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: persisted!.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      rollE: index === slotIndex ? 96 : 50,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });

  await submitChoice(session.playerId, avatarId, 'dice');
  const afterAtranorContinue = await submitContinue(session.playerId, avatarId);

  assert.equal(afterAtranorContinue.roomState, 'waiting_continue');
  assert.equal(afterAtranorContinue.systemEvent?.lastEvent?.kind, 'atranor');

  const inventoryAfterAtranor = await loadInventory(session.playerId, avatarId);
  assert.equal(totalEssenceUses(inventoryAfterAtranor), 3);
  assert.equal(countSolutionCharges(inventoryAfterAtranor, 10001), 0);
  assert.equal(totalItemUses(inventoryAfterAtranor), 2);
}

{
  await leaveAllRoomsForPlayer(session.playerId);
  await persistInventory(session.playerId, avatarId, {
    spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
    items: [],
    essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
  });

  await setProgression(
    session.playerId,
    avatarId,
    {
      ...createInitialProgression(),
      experience: 6,
    },
  );

  let room = await createRoom(session.playerId, avatarId);
  const slotIndex = room.participants[0]!.slotIndex;
  room = {
    ...readyEncounterRoom(room, slotIndex),
    activeEncounterSnapshot: {
      ...readyEncounterRoom(room, slotIndex).activeEncounterSnapshot,
      rollPrimaryA: 96,
    },
    slotEncounterSnapshots: readyEncounterRoom(room, slotIndex).slotEncounterSnapshots.map(
      (snapshot, index) => ({
        ...snapshot,
        rollPrimaryA: index === slotIndex ? 96 : 50,
      }),
    ) as EncounterRoom['slotEncounterSnapshots'],
  };
  await saveEncounterRoom(room);

  await submitChoice(session.playerId, avatarId, 'A');
  const actorAfterLevelUpRoll = (await loadEncounterRoom(room.roomId))!
    .participants.find((entry) => entry.avatarId === avatarId);
  assert.equal(actorAfterLevelUpRoll?.preparedResult?.success, true);
  assert.equal(actorAfterLevelUpRoll?.preparedResult?.leveledUp, true);

  const afterNormalContinue = await submitContinue(session.playerId, avatarId);
  assert.equal(afterNormalContinue.roomState, 'system_event');
  assert.equal(
    afterNormalContinue.systemEvent?.queue[0]?.encounterId,
    LEVEL_UP_ENCOUNTER_NUMERIC_ID,
  );

  const inventoryBeforeLevelUpEvent = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventoryBeforeLevelUpEvent, 10001), 0);
  assert.equal(totalEssenceUses(inventoryBeforeLevelUpEvent), 6);

  const persisted = await loadEncounterRoom(afterNormalContinue.roomId);
  await saveEncounterRoom({
    ...persisted!,
    activeEncounterSnapshot: {
      ...persisted!.activeEncounterSnapshot,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: persisted!.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterId: LEVEL_UP_ENCOUNTER_NUMERIC_ID,
      rollE: index === slotIndex ? 96 : 50,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });

  await submitChoice(session.playerId, avatarId, 'dice');
  const afterLevelUpContinue = await submitContinue(session.playerId, avatarId);

  assert.equal(afterLevelUpContinue.roomState, 'waiting_continue');
  assert.equal(afterLevelUpContinue.systemEvent?.lastEvent?.kind, 'level_up');

  const inventoryAfterLevelUp = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventoryAfterLevelUp, 10001), 0);
  assert.equal(totalEssenceUses(inventoryAfterLevelUp), 6);
  assert.ok(
    inventoryAfterLevelUp.spellbook.length + inventoryAfterLevelUp.items.length >= 1,
    'level-up system event should add rewards on top of committed normal-encounter inventory',
  );
}

console.log('systemEventInventory.test.ts: all assertions passed');
