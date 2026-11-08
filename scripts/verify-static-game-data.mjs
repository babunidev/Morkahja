import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasets = [
  'encountersdata.json',
  'solutiondata.json',
  'expansiondata.json',
  'frames.json',
  'portraits.json',
];
const locations = {
  server: path.join(root, 'server/game'),
  clientSource: path.join(root, 'client/src/data/game'),
  clientPublic: path.join(root, 'client/public/game'),
};

function normalizedJson(filePath) {
  return JSON.stringify(JSON.parse(readFileSync(filePath, 'utf8')));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const mismatches = [];
for (const dataset of datasets) {
  const hashes = Object.fromEntries(
    Object.entries(locations).map(([location, directory]) => [
      location,
      sha256(normalizedJson(path.join(directory, dataset))),
    ]),
  );
  const expected = hashes.server;
  for (const [location, hash] of Object.entries(hashes)) {
    if (hash !== expected) mismatches.push({ dataset, location, expected, actual: hash });
  }
}

if (mismatches.length > 0) {
  console.error('[morkahja] Static game data drift detected.');
  console.error(JSON.stringify(mismatches, null, 2));
  process.exit(1);
}

console.log(
  `[morkahja] Verified ${datasets.length} game datasets across server, client source, and public fallback.`,
);
