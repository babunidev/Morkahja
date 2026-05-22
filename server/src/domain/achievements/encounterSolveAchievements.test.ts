import assert from 'node:assert/strict';
import { EncounterType } from '../../engine/types.js';
import {
  COMBATANT_ACHIEVEMENT_ID,
  encounterSolveProgressBand,
  encounterSolveRankFromProgress,
  getEncounterSolveAchievementByType,
} from './encounterSolveAchievements.js';

const combatant = getEncounterSolveAchievementByType(EncounterType.Combat);
const trickster = getEncounterSolveAchievementByType(EncounterType.Trick);
const helper = getEncounterSolveAchievementByType(EncounterType.Help);

assert.ok(combatant);
assert.ok(trickster);
assert.ok(helper);
assert.equal(combatant?.achievementId, COMBATANT_ACHIEVEMENT_ID);

assert.equal(encounterSolveRankFromProgress(combatant!, 49), 0);
assert.equal(encounterSolveRankFromProgress(combatant!, 50), 1);
assert.equal(encounterSolveRankFromProgress(trickster!, 250), 2);
assert.equal(encounterSolveRankFromProgress(helper!, 5000), 4);

assert.equal(encounterSolveProgressBand(25).progressInBand, 0.5);

console.log('encounterSolveAchievements.test.ts passed');
