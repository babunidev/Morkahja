/**
 * Primary encounter slots (mEncounterSolutiuonA–D) must reference item/essence
 * solutions only (mSolutionInventoryType !== 1). Skills live in secondary type
 * slots (mEncounterSolutiuonTypeA–D).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLOTS = ['A', 'B', 'C', 'D'];

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

function isSpellbookSkill(solution) {
  return solution.mSolutionInventoryType === 1;
}

function migrateEncounters(encounters) {
  let clearedPrimary = 0;
  let backfilledType = 0;
  let updatedType = 0;

  for (const encounter of Object.values(encounters)) {
    for (const slot of SLOTS) {
      const primaryKey = `mEncounterSolutiuon${slot}`;
      const typeKey = `mEncounterSolutiuonType${slot}`;
      const primaryId = encounter[primaryKey];

      if (!primaryId) {
        continue;
      }

      const solution = solutionById.get(primaryId);
      if (!solution || !isSpellbookSkill(solution)) {
        continue;
      }

      const skillType = solution.mSolutionType;
      encounter[primaryKey] = 0;
      clearedPrimary += 1;

      if (encounter[typeKey] === 0) {
        encounter[typeKey] = skillType;
        backfilledType += 1;
      } else if (encounter[typeKey] !== skillType) {
        encounter[typeKey] = skillType;
        updatedType += 1;
      }
    }
  }

  return { clearedPrimary, backfilledType, updatedType };
}

const encounters = JSON.parse(readFileSync(encounterPaths[0], 'utf8'));
const stats = migrateEncounters(encounters);

const serialized = `${JSON.stringify(encounters, null, 2)}\n`;
for (const filePath of encounterPaths) {
  writeFileSync(filePath, serialized, 'utf8');
}

console.log('[morkahja] Encounter primary-slot migration complete.');
console.log(JSON.stringify(stats, null, 2));

// Post-check: no spellbook skills left in primary slots
let remaining = 0;
for (const encounter of Object.values(encounters)) {
  for (const slot of SLOTS) {
    const primaryId = encounter[`mEncounterSolutiuon${slot}`];
    if (!primaryId) {
      continue;
    }
    const solution = solutionById.get(primaryId);
    if (solution && isSpellbookSkill(solution)) {
      remaining += 1;
    }
  }
}

if (remaining > 0) {
  console.error(`[morkahja] ${remaining} spellbook skills still in primary slots.`);
  process.exit(1);
}

console.log('[morkahja] Verified: primary slots contain no spellbook skills.');
