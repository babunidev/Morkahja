import assert from 'node:assert/strict';

import type { AvatarInventory } from '../types/avatar.js';
import {
  equipmentRegainCharges,
  isEquippableSolution,
  normalizeEquipmentSlots,
} from '@shared/equipment.js';
import { allocateSolutionSet, slotFaces } from '@shared/solutionSet.js';
import { getSolutionMap } from './gameData.js';
import {
  applyEncounterInventoryChanges,
  applyFailurePenaltyToInventoryState,
  equipItemInInventoryState,
  EquipmentError,
} from './inventoryService.js';

// Real items from the game data: an Explorer's Chart and a Shadowgate Key.
const CHART = 10007;
const KEY = 10012;
const SKILL = 10001;
const ESSENCE = 10010;
const ATRANOR_ELIXIR = 10015;

function inventory(
  items: Array<[number, number]>,
  equipped?: (number | null)[],
  essences: Array<[number, number]> = [],
): AvatarInventory {
  return {
    spellbook: [{ solutionId: SKILL, solutionType: 1, uses: 1 }],
    items: items.map(([solutionId, uses]) => ({ solutionId, solutionType: 6, uses })),
    essences: essences.map(([solutionId, uses]) => ({ solutionId, solutionType: 15, uses })),
    ...(equipped ? { equipped } : {}),
  };
}

function uses(inv: AvatarInventory, solutionId: number): number {
  return [...inv.items, ...inv.essences, ...inv.spellbook]
    .filter((item) => item.solutionId === solutionId)
    .reduce((sum, item) => sum + item.uses, 0);
}

function expectEquipError(run: () => unknown, code: EquipmentError['code']): void {
  assert.throws(run, (error: unknown) => error instanceof EquipmentError && error.code === code);
}

// Regain by the total as shown: below 12 nothing, 12–19 one, 20 or more two.
assert.equal(equipmentRegainCharges(11), 0);
assert.equal(equipmentRegainCharges(12), 1);
assert.equal(equipmentRegainCharges(19), 1);
assert.equal(equipmentRegainCharges(20), 2);
assert.equal(equipmentRegainCharges(26), 2);
assert.equal(equipmentRegainCharges(-2), 0);

// Two slots, never the same item twice.
assert.deepEqual(normalizeEquipmentSlots(undefined), [null, null]);
assert.deepEqual(normalizeEquipmentSlots([CHART, CHART]), [CHART, null]);
assert.deepEqual(normalizeEquipmentSlots([0, 'x', KEY]), [null, null]);

// Items only: not skills, essences or Atranor items.
const solutions = getSolutionMap();
assert.equal(isEquippableSolution(solutions[String(CHART)]), true);
assert.equal(isEquippableSolution(solutions[String(SKILL)]), false);
assert.equal(isEquippableSolution(solutions[String(ESSENCE)]), false);
assert.equal(isEquippableSolution(solutions[String(ATRANOR_ELIXIR)]), false);

// Equipping brings all charges plus one for the slot.
{
  const next = equipItemInInventoryState(inventory([[CHART, 2]]), 0, CHART);
  assert.deepEqual(next.equipped, [CHART, null]);
  assert.equal(uses(next, CHART), 3);
}

// A full slot stays as it is until its item breaks: no swapping.
expectEquipError(
  () => equipItemInInventoryState(inventory([[CHART, 3], [KEY, 1]], [CHART, null]), 0, KEY),
  'SLOT_OCCUPIED',
);
// The other, empty slot takes it.
{
  const next = equipItemInInventoryState(inventory([[CHART, 3], [KEY, 1]], [CHART, null]), 1, KEY);
  assert.deepEqual(next.equipped, [CHART, KEY]);
  assert.equal(uses(next, CHART), 3);
  assert.equal(uses(next, KEY), 2);
}
// A slot whose item broke is empty again.
{
  const next = equipItemInInventoryState(inventory([[KEY, 1]], [CHART, null]), 0, KEY);
  assert.deepEqual(next.equipped, [KEY, null]);
}

// Refusals.
expectEquipError(() => equipItemInInventoryState(inventory([[CHART, 1]]), 2, CHART), 'INVALID_EQUIPMENT_SLOT');
expectEquipError(() => equipItemInInventoryState(inventory([[CHART, 1]]), 0, SKILL), 'NOT_EQUIPPABLE');
expectEquipError(() => equipItemInInventoryState(inventory([[CHART, 1]]), 0, KEY), 'NOT_IN_INVENTORY');
expectEquipError(
  () => equipItemInInventoryState(inventory([[CHART, 2]], [CHART, null]), 1, CHART),
  'ALREADY_EQUIPPED',
);

// A use at 12 or higher gives the charge back; 20 or higher one more; each use by its own roll.
{
  const start = inventory([[CHART, 2]], [CHART, null]);
  const kept = applyEncounterInventoryChanges(start, [CHART], [], true, 'Fortune', 1, 0, { usedSolutionRolls: [14] });
  assert.equal(uses(kept.inventory, CHART), 2);
  assert.deepEqual(kept.equipmentRegain, [{ solutionId: CHART, charges: 1 }]);

  const ahead = applyEncounterInventoryChanges(start, [CHART], [], true, 'Prosperity', 1, 0, { usedSolutionRolls: [21] });
  assert.equal(uses(ahead.inventory, CHART), 3);

  const set = applyEncounterInventoryChanges(start, [CHART, CHART], [], true, 'Fortune', 2, 0, {
    usedSolutionRolls: [9, 14],
  });
  assert.equal(uses(set.inventory, CHART), 1, 'one charge lost at 9, one given back at 14');
  assert.deepEqual(set.equipmentRegain, [{ solutionId: CHART, charges: 1 }]);
}

// The last charge used at 12 or higher comes back: the item stays equipped.
{
  const next = applyEncounterInventoryChanges(
    inventory([[CHART, 1]], [CHART, null]), [CHART], [], true, 'Fortune', 1, 0, { usedSolutionRolls: [15] },
  );
  assert.equal(uses(next.inventory, CHART), 1);
  assert.deepEqual(next.inventory.equipped, [CHART, null]);
}

// The last charge used below 12 breaks the item and frees its slot.
{
  const next = applyEncounterInventoryChanges(
    inventory([[CHART, 1]], [CHART, null]), [CHART], [], false, 'Disengage', 1, 0, { usedSolutionRolls: [8] },
  );
  assert.equal(uses(next.inventory, CHART), 0);
  assert.deepEqual(next.inventory.equipped, [null, null]);
  assert.deepEqual(next.equipmentRegain, []);
}

// An item that is not equipped gets nothing back.
{
  const next = applyEncounterInventoryChanges(
    inventory([[CHART, 2]]), [CHART], [], true, 'Prosperity', 1, 0, { usedSolutionRolls: [22] },
  );
  assert.equal(uses(next.inventory, CHART), 1);
  assert.deepEqual(next.equipmentRegain, []);
}

// Misery cannot take an equipped item's charges.
{
  const result = applyFailurePenaltyToInventoryState(
    inventory([[CHART, 1], [KEY, 1]], [CHART, null], [[ESSENCE, 3]]),
    'Misery',
    2,
    { randomInt: () => 0 },
  );
  assert.equal(uses(result.inventory, CHART), 1, 'the equipped chart is protected');
  assert.equal(uses(result.inventory, KEY), 0, 'the key is not equipped and is lost');
  assert.equal(result.lostSolutionIds.includes(CHART), false);
}

// With only equipped items left, Misery takes no item at all.
{
  const result = applyFailurePenaltyToInventoryState(
    inventory([[CHART, 2]], [CHART, null], [[ESSENCE, 3]]),
    'Misery',
    1,
    { randomInt: () => 0 },
  );
  assert.equal(uses(result.inventory, CHART), 2);
}

// A slot that accepts several items takes the equipped one first, then the lowest id.
{
  const typeOf = () => 6;
  const requirements = {
    A: { primarySolutionId: 0, secondarySolutionType: 6 },
    B: { primarySolutionId: 0, secondarySolutionType: 0 },
    C: { primarySolutionId: 0, secondarySolutionType: 0 },
    D: { primarySolutionId: 0, secondarySolutionType: 0 },
  };
  assert.equal(slotFaces(requirements, [CHART, KEY], typeOf).A?.solutionId, CHART);
  assert.equal(slotFaces(requirements, [CHART, KEY], typeOf, [KEY]).A?.solutionId, KEY);
  // The refill after the equipped item is spent also prefers it, then the lowest id.
  const allocation = allocateSolutionSet(['A', 'A'], requirements, [CHART, KEY], typeOf, [KEY]);
  assert.deepEqual(allocation?.map((pick) => pick.solutionId), [KEY, CHART]);
}

console.log('equipment tests passed');
