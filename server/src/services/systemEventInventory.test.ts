import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { createInitialProgression } from '../domain/avatar/AvatarProgression.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
  LEVEL_UP_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import { setProgression } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { getSolutionMap } from './gameData.js';
import {
  flattenInventorySolutionIds,
  loadInventory,
  persistInventory,
  resolveInventoryContainer,
} from './inventoryService.js';
import { savePlayerAvatar } from './playerService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  leaveAllRoomsForPlayer,
  submitChoice,
  submitContinue,
  chooseLevelUpReward,
} from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

function countSolutionCharges(
  inventory: Awaited<ReturnType<typeof loadInventory>>,
  solutionId: number,
): number {
  return flattenInventorySolutionIds(inventory).filter((id) => id === solutionId).length;
}

function isEssenceReward(solutionId: number): boolean {
  const solution = getSolutionMap()[String(solutionId)];
  return solution !== undefined
    && resolveInventoryContainer(solution.mSolutionInventoryType) === 'essences';
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
      rollPrimaryA: index === slotIndex ? 1 : 96,
      // Every copy of the slot rolls this (no per-copy rolls), as the test intends.
      extraRolls: undefined,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  };
}

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(identityKeyPair, identityPublicJwk, `system-event-inventory-${Date.now()}`);

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
  // Misery at difficulty 2: two essence losses and two item losses. The air
  // essences are another element than this Rokur's fire, so each essence loss
  // takes two of them (Babuni, 2026-11-21): 4 essences + 2 items.
  assert.equal(actor?.preparedResult?.lostInventorySolutions?.length, 6);

  const afterContinue = await submitContinue(session.playerId, avatarId);
  assert.equal(afterContinue.roomState, 'active_encounter');
  assert.equal(afterContinue.systemEvent, undefined);

  const inventory = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventory, 10001), 0);
  assert.equal(totalEssenceUses(inventory), 1);
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

  // Solo system-event Continue commits the result and advances in one action,
  // as for level-up rewards; the inventory checks below confirm Atranor resolved.
  assert.equal(afterAtranorContinue.roomState, 'active_encounter');
  assert.equal(afterAtranorContinue.systemEvent, undefined);

  const inventoryAfterAtranor = await loadInventory(session.playerId, avatarId);
  assert.equal(totalEssenceUses(inventoryAfterAtranor), 3);
  assert.equal(countSolutionCharges(inventoryAfterAtranor, 10001), 0);
  assert.equal(totalItemUses(inventoryAfterAtranor), 2);
}

{
  await leaveAllRoomsForPlayer(session.playerId);
  await persistInventory(session.playerId, avatarId, {
    spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
    items: [
      { solutionId: 10005, solutionType: 6, uses: 2 },
      { solutionId: 10006, solutionType: 6, uses: 2 },
    ],
    essences: [
      { solutionId: 10010, solutionType: 15, uses: 2 },
      { solutionId: 10015, solutionType: 77, uses: 1 },
    ],
  });
  await setProgression(session.playerId, avatarId, createInitialProgression());

  let room = await createRoom(session.playerId, avatarId);
  room = readyEncounterRoom(room, room.participants[0]!.slotIndex);
  await saveEncounterRoom(room);

  await submitChoice(session.playerId, avatarId, 'A');
  const waiting = await loadEncounterRoom((await submitContinue(session.playerId, avatarId)).roomId);
  assert.equal(waiting?.roomState, 'system_event');
  const openedActor = waiting!.participants.find((entry) => entry.avatarId === avatarId);
  assert.equal(openedActor?.setPicks, undefined);
  assert.equal(openedActor?.setDiceRolls, undefined);

  const slotIndex = openedActor!.slotIndex;
  await saveEncounterRoom({
    ...waiting!,
    activeEncounterSnapshot: {
      ...waiting!.activeEncounterSnapshot,
      encounterDifficulty: 1,
      primarySolutionA: 10015,
      rollPrimaryA: 96,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: waiting!.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
      encounterDifficulty: 1,
      primarySolutionA: 10015,
      rollPrimaryA: index === slotIndex ? 96 : 50,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });

  const afterElixir = await submitChoice(session.playerId, avatarId, 'A');
  const elixirActor = afterElixir.participants.find((entry) => entry.avatarId === avatarId);
  assert.deepEqual(elixirActor?.preparedResult?.usedInventorySolutions, [10015]);

  const afterElixirContinue = await submitContinue(session.playerId, avatarId);
  assert.equal(afterElixirContinue.roomState, 'active_encounter');

  const inventoryAfterElixir = await loadInventory(session.playerId, avatarId);
  assert.equal(countSolutionCharges(inventoryAfterElixir, 10015), 0);
  assert.equal(totalEssenceUses(inventoryAfterElixir), 3);
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
      // Every copy of the slot rolls this (no per-copy rolls), as the test intends.
      extraRolls: undefined,
    },
    slotEncounterSnapshots: readyEncounterRoom(room, slotIndex).slotEncounterSnapshots.map(
      (snapshot, index) => ({
        ...snapshot,
        rollPrimaryA: index === slotIndex ? 96 : 50,
        // Every copy of the slot rolls this (no per-copy rolls), as the test intends.
        extraRolls: undefined,
        // The encounter's own rewards are drawn at random and could include an
        // essence or spell 10001, which would make the totals below vary between
        // runs. This scenario is about the level-up event, so the normal encounter
        // grants none; the success still adds its one-use Prosperity essence.
        rewardIds: [] as number[],
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
      // 12 gives two rolled rewards (race and role, D-049) and never the rare
      // type-15 item, which is an essence; a 20 or more always adds one.
      rollE: index === slotIndex ? 12 : 50,
      // Level-up rewards were drawn when the snapshot was created; keep this
      // test's rewards essence-free so the essence total below stays exact.
      rewardIds: snapshot.rewardIds?.filter((rewardId) => !isEssenceReward(rewardId)),
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });

  const levelUpRolled = await submitChoice(session.playerId, avatarId, 'dice');
  // D-049: Continue waits for one of the three offered rewards.
  const offered = levelUpRolled.participants.find((p) => p.playerId === session.playerId)?.preparedResult?.levelUpChoiceIds ?? [];
  assert.equal(offered.length, 3, 'a level-up offers three rewards');
  await assert.rejects(submitContinue(session.playerId, avatarId), /level-up reward/);
  // An essence among the choices would change the essence total checked below.
  const chosen = offered.find((rewardId) => !isEssenceReward(rewardId)) ?? offered[0]!;
  await chooseLevelUpReward(session.playerId, avatarId, chosen);
  const afterLevelUpContinue = await submitContinue(session.playerId, avatarId);

  // Single-action solo advance, as above; the inventory checks confirm the rewards.
  assert.equal(afterLevelUpContinue.roomState, 'active_encounter');
  assert.equal(afterLevelUpContinue.systemEvent, undefined);

  const inventoryAfterLevelUp = await loadInventory(session.playerId, avatarId);
  assert.ok(countSolutionCharges(inventoryAfterLevelUp, chosen) > 0, 'the chosen level-up reward is in the inventory');
  assert.equal(countSolutionCharges(inventoryAfterLevelUp, 10001), 0);
  assert.equal(totalEssenceUses(inventoryAfterLevelUp), 6);
  assert.ok(
    inventoryAfterLevelUp.spellbook.length + inventoryAfterLevelUp.items.length >= 1,
    'level-up system event should add rewards on top of committed normal-encounter inventory',
  );
}

console.log('systemEventInventory.test.ts: all assertions passed');
