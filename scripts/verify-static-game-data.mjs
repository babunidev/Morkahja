/**
 * Checks the game content in server/game/*.json, the only copy of it
 * (the client loads it from GET /game-data/content).
 *
 * Fails on: invalid JSON, wrong structure, keys that do not match record ids,
 * encounter references to missing solutions/encounters/expansions, missing
 * encounter or solution images, and reintroduced client copies of the data.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = path.join(root, 'server/game');
const imageDir = path.join(root, 'client/public/game');
const SLOTS = ['A', 'B', 'C', 'D'];

const errors = [];

function readJson(name) {
  try {
    return JSON.parse(readFileSync(path.join(gameDir, name), 'utf8'));
  } catch (error) {
    errors.push(`${name}: ${error.message}`);
    return null;
  }
}

function isRecordMap(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkIndexedList(name, list, idField) {
  if (!Array.isArray(list) || list[0] !== null) {
    errors.push(`${name}: must be an array with index 0 set to null`);
    return;
  }
  list.forEach((entry, index) => {
    if (entry !== null && entry[idField] !== index) {
      errors.push(`${name}[${index}]: ${idField} is ${entry[idField]}`);
    }
  });
}

function webpName(name) {
  return name.endsWith('.webp') ? name : `${name}.webp`;
}

function listImages(subdir) {
  const dir = path.join(imageDir, subdir);
  return existsSync(dir) ? new Set(readdirSync(dir)) : new Set();
}

const encounters = readJson('encountersdata.json');
const solutions = readJson('solutiondata.json');
const expansionFile = readJson('expansiondata.json');
const frames = readJson('frames.json');
const portraits = readJson('portraits.json');

if (encounters && solutions && expansionFile && frames && portraits) {
  if (!isRecordMap(encounters) || Object.keys(encounters).length === 0) {
    errors.push('encountersdata.json: must be a non-empty object');
  }
  if (!isRecordMap(solutions) || Object.keys(solutions).length === 0) {
    errors.push('solutiondata.json: must be a non-empty object');
  }
  if (!isRecordMap(expansionFile.expansions)) {
    errors.push('expansiondata.json: must contain an expansions object');
  }
  checkIndexedList('frames.json Frames', frames.Frames, 'frameID');
  checkIndexedList('portraits.json Avatar', portraits.Avatar, 'avatarID');
}

if (errors.length === 0) {
  const solutionIds = new Set(Object.values(solutions).map((entry) => entry.mSolutionID));
  const encounterIds = new Set(Object.values(encounters).map((entry) => entry.mEncounterID));
  // Expansion 0 is the base game, which has no expansion record.
  const expansionIds = new Set([0, ...Object.values(expansionFile.expansions).map((entry) => entry.mExtensioID)]);
  const encounterImages = listImages('encounterimages');
  const solutionImages = listImages('solutionimages');

  for (const [key, entry] of Object.entries(solutions)) {
    if (String(entry.mSolutionID) !== key) {
      errors.push(`solution ${key}: mSolutionID is ${entry.mSolutionID}`);
    }
    if (entry.mSolutionIconName && !solutionImages.has(webpName(entry.mSolutionIconName))) {
      errors.push(`solution ${key}: image ${webpName(entry.mSolutionIconName)} not found`);
    }
  }

  for (const [key, entry] of Object.entries(encounters)) {
    if (String(entry.mEncounterID) !== key.replace(/^0+(?=\d)/, '')) {
      errors.push(`encounter ${key}: mEncounterID is ${entry.mEncounterID}`);
    }
    for (const slot of SLOTS) {
      const solutionId = entry[`mEncounterSolutiuon${slot}`];
      if (solutionId && !solutionIds.has(solutionId)) {
        errors.push(`encounter ${key}: slot ${slot} uses missing solution ${solutionId}`);
      }
    }
    if (entry.mEncounterFollow && !encounterIds.has(entry.mEncounterFollow)) {
      errors.push(`encounter ${key}: follow-up encounter ${entry.mEncounterFollow} not found`);
    }
    if (!expansionIds.has(entry.mEncounterExpansion)) {
      errors.push(`encounter ${key}: expansion ${entry.mEncounterExpansion} not found`);
    }
    if (entry.mEncounterImageName && !encounterImages.has(webpName(entry.mEncounterImageName))) {
      errors.push(`encounter ${key}: image ${webpName(entry.mEncounterImageName)} not found`);
    }
  }
}

// The old duplicated copies must not come back (e.g. an admin tool writing to
// client/public/game instead of server/game).
for (const stale of [
  'client/src/data/game',
  ...['encountersdata', 'solutiondata', 'expansiondata', 'frames', 'portraits']
    .map((name) => `client/public/game/${name}.json`),
]) {
  if (existsSync(path.join(root, stale))) {
    errors.push(`${stale}: stale copy of game data; server/game is the only source`);
  }
}

if (errors.length > 0) {
  console.error('[morkahja] Game data check failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('[morkahja] Game data verified (server/game is the single source).');
