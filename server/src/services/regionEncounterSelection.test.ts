import assert from 'node:assert/strict';

import type { EncounterData, EncounterDataMap } from '../engine/types.js';
import { ENCOUNTER_REPEAT_GAP, prepareNextEncounter, recentAfter, selectNextEncounter } from './encounterGenerator.js';

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

// Babuni (2026-11-17): an encounter waits for three others before it can return.
{
  assert.equal(ENCOUNTER_REPEAT_GAP, 3);
  assert.deepEqual(recentAfter([20001, 20002, 20003], 20004), [20002, 20003, 20004], 'only the last three are kept');
  assert.deepEqual(recentAfter([20001], 1), [20001], 'Atranor is not remembered');
  assert.deepEqual(recentAfter([20001], 2), [20001], 'the level-up is not remembered');
  assert.deepEqual(recentAfter(undefined, undefined), []);

  const valley = mapOf(...[20020, 20021, 20022, 20023, 20024].map((id) => encounter(id, 0)));
  // Draw many times in a row, always the first candidate: no repeat inside four.
  let recent: number[] = [];
  const played: number[] = [];
  for (let turn = 0; turn < 12; turn += 1) {
    const next = selectNextEncounter({ unlockedExpansions: [0], currentExpansion: 0, avoidEncounterIds: recent, nextInt: (min) => min }, valley);
    played.push(next.mEncounterID);
    recent = recentAfter(recent, next.mEncounterID);
  }
  for (let index = 0; index < played.length; index += 1) {
    const window = played.slice(Math.max(0, index - 3), index);
    assert.ok(!window.includes(played[index]!), `encounter ${played[index]} came back within three (${played.join(',')})`);
  }

  // A land with too few encounters still draws: the rule gives way rather than stalls.
  const tiny = mapOf(encounter(20030, 0), encounter(20031, 0));
  const forced = selectNextEncounter({ unlockedExpansions: [0], currentExpansion: 0, avoidEncounterIds: [20030, 20031], nextInt: (min) => min }, tiny);
  assert.ok([20030, 20031].includes(forced.mEncounterID));

  // The region roll still decides the land; the recent ones sit out inside it.
  const stayFresh = selectNextEncounter({ unlockedExpansions: unlocked, currentExpansion: 1001, avoidEncounterIds: [20011], nextInt: scripted([14, 0]) }, both);
  assert.equal(stayFresh.mEncounterID, 20012);

  // A written follow is a story, not a draw: it comes even if recent.
  const story = selectNextEncounter({ unlockedExpansions: unlocked, previousEncounter: encounter(20010, 0, 20012), avoidEncounterIds: [20012] }, both);
  assert.equal(story.mEncounterID, 20012);
}

console.log('regionEncounterSelection.test.ts passed');
