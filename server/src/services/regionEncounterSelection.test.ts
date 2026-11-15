import assert from 'node:assert/strict';

import type { EncounterData, EncounterDataMap } from '../engine/types.js';
import { prepareNextEncounter, selectNextEncounter } from './encounterGenerator.js';

function encounter(id: number, expansion: number, follow = 0): EncounterData {
  return {
    mEncounterDifficulty: 1,
    mEncounterExpansion: expansion,
    mEncounterFollow: follow,
    mEncounterID: id,
    mEncounterImageName: 'img',
    mEncounterRewardAmount: 1,
    mEncounterRewardType: 1,
    mEncounterSolutiuonA: 0,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeA: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonTypeD: 0,
    mEncounterText: '',
    mEncounterTitle: `Encounter ${id}`,
    mEncounterType: 1,
  };
}

function mapOf(...encounters: EncounterData[]): EncounterDataMap {
  return Object.fromEntries(encounters.map((entry) => [String(entry.mEncounterID), entry]));
}

function scripted(values: number[]): (min: number, max: number) => number {
  const pending = [...values];
  return (min, max) => {
    const next = pending.shift();
    if (next === undefined || next < min || next > max) {
      throw new Error(`scripted roll ${String(next)} is outside ${min}..${max}`);
    }
    return next;
  };
}

const home = encounter(20010, 0);
const ridge = encounter(20011, 1001);
const ridgeAgain = encounter(20012, 1001);
const both = mapOf(home, ridge, ridgeAgain);
const unlocked = [0, 1001];

const followed = selectNextEncounter({
  unlockedExpansions: unlocked,
  previousEncounter: encounter(20010, 0, 20012),
  nextInt: () => {
    throw new Error('a written follow must not roll');
  },
}, both);
assert.equal(followed.mEncounterID, 20012);

const stayed = selectNextEncounter({
  unlockedExpansions: unlocked,
  currentExpansion: 1001,
  nextInt: scripted([14, 0]),
}, both);
assert.equal(stayed.mEncounterID, 20011);

const left = selectNextEncounter({
  unlockedExpansions: unlocked,
  currentExpansion: 1001,
  nextInt: scripted([15, 0]),
}, both);
assert.equal(left.mEncounterID, 20010);

const stayedHome = selectNextEncounter({
  unlockedExpansions: unlocked,
  currentExpansion: 0,
  nextInt: scripted([1, 0]),
}, both);
assert.equal(stayedHome.mEncounterExpansion, 0);

const onlyHome = mapOf(home, ridge);
const stayedBecauseNowhereElse = selectNextEncounter({
  unlockedExpansions: [0],
  currentExpansion: 0,
  nextInt: scripted([20, 0]),
}, onlyHome);
assert.equal(stayedBecauseNowhereElse.mEncounterID, 20010);

const fromLastEncounter = selectNextEncounter({
  unlockedExpansions: unlocked,
  previousEncounter: encounter(20011, 1001, 0),
  nextInt: scripted([14, 1]),
}, both);
assert.equal(fromLastEncounter.mEncounterID, 20012);

const preloaded = prepareNextEncounter(ridge, unlocked, both);
assert.equal(preloaded.followMode, 'random');
assert.ok(both[String(preloaded.encounterId)]);

console.log('regionEncounterSelection.test.ts passed');
