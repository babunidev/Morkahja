import { getSolutionMap } from '../services/gameData.js';
import {
  WARRIOR_IMPROVISED_WEAPON_ID,
  buildInitialAvatarSeedIds,
  createInitialAvatarInventory,
  flattenInventorySolutionIds,
  randomSampleSolutionIds,
  type RandomIntFn,
} from '../services/inventoryService.js';
import type { AvatarProfile } from '../types/avatar.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const alwaysFirstPick: RandomIntFn = () => 0;

function solutionPredicate(
  solutionId: number,
  predicate: (solution: ReturnType<typeof getSolutionMap>[string]) => boolean,
): boolean {
  const solution = getSolutionMap()[String(solutionId)];

  return Boolean(solution && predicate(solution));
}

function assertInventoryShape(
  profile: AvatarProfile,
  inventory: ReturnType<typeof createInitialAvatarInventory>,
): void {
  assertEqual(inventory.spellbook.length, 5, 'spellbook entry count');
  assertEqual(inventory.items.length, isWarrior(profile) ? 6 : 5, 'item entry count');
  assertEqual(inventory.essences.length, 3, 'essence entry count');

  const spellbookIds = inventory.spellbook.map((item) => item.solutionId);
  const itemIds = inventory.items.map((item) => item.solutionId);
  const essenceIds = inventory.essences.map((item) => item.solutionId);
  const roleRewardType = profile.roleRewardType ?? 37;
  const raceRewardType = profile.raceRewardType ?? 40;

  assert(
    new Set(spellbookIds).size === spellbookIds.length,
    'spellbook must not contain duplicate solution ids',
  );
  assert(
    new Set(itemIds).size === itemIds.length,
    'items must not contain duplicate solution ids',
  );
  assert(
    new Set(essenceIds).size === essenceIds.length,
    'essences must not contain duplicate solution ids',
  );

  const roleSpellbook = spellbookIds.filter((solutionId) => solutionPredicate(
    solutionId,
    (solution) =>
      solution.mSolutionRewardType === roleRewardType &&
      solution.mSolutionInventoryType === 1,
  ));
  const raceSpellbook = spellbookIds.filter((solutionId) => solutionPredicate(
    solutionId,
    (solution) =>
      solution.mSolutionRewardType === raceRewardType &&
      solution.mSolutionInventoryType === 1,
  ));

  assertEqual(roleSpellbook.length, 2, 'role spellbook count');
  assertEqual(raceSpellbook.length, 3, 'race spellbook count');

  for (const solutionId of itemIds) {
    assert(
      solutionPredicate(
        solutionId,
        (solution) =>
          solution.mSolutionRewardType === 2 &&
          solution.mSolutionInventoryType === 2,
      ) || solutionId === WARRIOR_IMPROVISED_WEAPON_ID,
      `unexpected item solution id ${solutionId}`,
    );
  }

  for (const solutionId of essenceIds) {
    assert(
      solutionPredicate(
        solutionId,
        (solution) =>
          solution.mSolutionType === 15 &&
          solution.mSolutionInventoryType === 3,
      ),
      `unexpected essence solution id ${solutionId}`,
    );
  }
}

function isWarrior(profile: AvatarProfile): boolean {
  return profile.roleRewardType === 38;
}

function testRandomSampleWithoutReplacement(): void {
  const picks = randomSampleSolutionIds(
    (solution) =>
      solution.mSolutionRewardType === 2 &&
      solution.mSolutionInventoryType === 2,
    5,
    { randomInt: alwaysFirstPick },
  );

  assertEqual(picks.length, 5, 'item sample length');
  assert(
    new Set(picks).size === picks.length,
    'random item sample must not repeat ids',
  );

  const exhaustivePool = randomSampleSolutionIds(
    (solution) => solution.mSolutionID === 10062,
    1,
    { randomInt: alwaysFirstPick },
  );
  assertEqual(exhaustivePool.join(','), '10062', 'single-candidate pool');
}

function testDeterministicMageStarterPack(): void {
  const profile: AvatarProfile = {
    roleRewardType: 37,
    raceRewardType: 40,
  };
  const seedIds = buildInitialAvatarSeedIds(profile, { randomInt: alwaysFirstPick });
  const inventory = createInitialAvatarInventory(profile, { randomInt: alwaysFirstPick });

  assert(!seedIds.includes(WARRIOR_IMPROVISED_WEAPON_ID), 'mage starter must not include improvised weapon');
  assertInventoryShape(profile, inventory);
  assertEqual(
    flattenInventorySolutionIds(inventory).length,
    13,
    'mage total seeded solutions',
  );
}

function testWarriorGetsImprovisedWeapon(): void {
  const profile: AvatarProfile = {
    roleRewardType: 38,
    raceRewardType: 40,
  };
  const seedIds = buildInitialAvatarSeedIds(profile, { randomInt: alwaysFirstPick });
  const inventory = createInitialAvatarInventory(profile, { randomInt: alwaysFirstPick });

  assert(seedIds.includes(WARRIOR_IMPROVISED_WEAPON_ID), 'warrior seed must include improvised weapon');
  assert(
    inventory.items.some((item) => item.solutionId === WARRIOR_IMPROVISED_WEAPON_ID),
    'warrior inventory must contain improvised weapon in items',
  );
  assertInventoryShape(profile, inventory);
  assertEqual(
    flattenInventorySolutionIds(inventory).length,
    14,
    'warrior total seeded solutions',
  );
}

function testLiveRandomizationVaries(): void {
  const profile: AvatarProfile = {
    roleRewardType: 37,
    raceRewardType: 40,
  };
  const samples = new Set(
    Array.from({ length: 12 }, () => buildInitialAvatarSeedIds(profile).join(',')),
  );

  assert(samples.size > 1, 'live random starter packs should not all be identical');
}

async function main(): Promise<void> {
  getSolutionMap();
  testRandomSampleWithoutReplacement();
  testDeterministicMageStarterPack();
  testWarriorGetsImprovisedWeapon();
  testLiveRandomizationVaries();
  console.log('initialInventory.test.ts: all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
