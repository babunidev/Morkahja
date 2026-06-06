/**
 * Add generic combat skill (9) and combat item (10) fallbacks only on empty
 * encounter slots. Never replaces existing primary IDs or secondary types.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLOTS = ['A', 'B', 'C', 'D'];
const COMBAT_SKILL_TYPE = 9;
const COMBAT_ITEM_TYPE = 10;

const encounterPaths = [
  join(root, 'server/game/encountersdata.json'),
  join(root, 'client/src/data/game/encountersdata.json'),
  join(root, 'client/public/game/encountersdata.json'),
];

const solutions = JSON.parse(
  readFileSync(join(root, 'server/game/solutiondata.json'), 'utf8'),
);
const solutionById = new Map(
  Object.values(solutions).map((entry) => [entry.mSolutionID, entry]),
);

function isEmptySlot(encounter, slot) {
  return (
    encounter[`mEncounterSolutiuon${slot}`] === 0
    && encounter[`mEncounterSolutiuonType${slot}`] === 0
  );
}

function acceptsCombatSkill(encounter, slot) {
  const typeId = encounter[`mEncounterSolutiuonType${slot}`];
  const primaryId = encounter[`mEncounterSolutiuon${slot}`];
  const primary = primaryId ? solutionById.get(primaryId) : null;

  return (
    typeId === COMBAT_SKILL_TYPE
    || primary?.mSolutionType === COMBAT_SKILL_TYPE
  );
}

function acceptsCombatItem(encounter, slot) {
  const typeId = encounter[`mEncounterSolutiuonType${slot}`];
  const primaryId = encounter[`mEncounterSolutiuon${slot}`];
  const primary = primaryId ? solutionById.get(primaryId) : null;

  return (
    typeId === COMBAT_ITEM_TYPE
    || primary?.mSolutionType === COMBAT_ITEM_TYPE
  );
}

function firstEmptySlot(encounter, preference) {
  return preference.find((slot) => isEmptySlot(encounter, slot)) ?? null;
}

function addCombatFallbacks(encounters) {
  const stats = {
    combatEncounters: 0,
    skillSlotsAdded: 0,
    itemSlotsAdded: 0,
    stillMissingSkill: [],
    stillMissingItem: [],
  };

  for (const encounter of Object.values(encounters)) {
    if (encounter.mEncounterType !== 1) {
      continue;
    }

    stats.combatEncounters += 1;

    const hasSkill = SLOTS.some((slot) => acceptsCombatSkill(encounter, slot));
    const hasItem = SLOTS.some((slot) => acceptsCombatItem(encounter, slot));

    if (!hasSkill) {
      const slot = firstEmptySlot(encounter, ['C', 'D', 'A', 'B']);
      if (slot) {
        encounter[`mEncounterSolutiuonType${slot}`] = COMBAT_SKILL_TYPE;
        stats.skillSlotsAdded += 1;
      } else {
        stats.stillMissingSkill.push({
          id: encounter.mEncounterID,
          title: encounter.mEncounterTitle,
        });
      }
    }

    if (!hasItem) {
      const slot = firstEmptySlot(encounter, ['A', 'D', 'B', 'C']);
      if (slot) {
        encounter[`mEncounterSolutiuonType${slot}`] = COMBAT_ITEM_TYPE;
        stats.itemSlotsAdded += 1;
      } else {
        stats.stillMissingItem.push({
          id: encounter.mEncounterID,
          title: encounter.mEncounterTitle,
        });
      }
    }
  }

  return stats;
}

const encounters = JSON.parse(readFileSync(encounterPaths[0], 'utf8'));
const stats = addCombatFallbacks(encounters);

const serialized = `${JSON.stringify(encounters, null, 2)}\n`;
for (const filePath of encounterPaths) {
  writeFileSync(filePath, serialized, 'utf8');
}

console.log('[morkahja] Added combat fallbacks on empty slots only.');
console.log(JSON.stringify(stats, null, 2));
