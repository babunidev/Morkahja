import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  serverEncounters: path.join(root, 'server/game/encountersdata.json'),
  clientSrcEncounters: path.join(root, 'client/src/data/game/encountersdata.json'),
  clientPublicEncounters: path.join(root, 'client/public/game/encountersdata.json'),
};

function normalizedJson(filePath) {
  return JSON.stringify(JSON.parse(readFileSync(filePath, 'utf8')));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const hashes = Object.fromEntries(
  Object.entries(files).map(([name, filePath]) => {
    const normalized = normalizedJson(filePath);
    return [name, sha256(normalized)];
  }),
);

const expected = hashes.serverEncounters;
const mismatched = Object.entries(hashes).filter(([, hash]) => hash !== expected);

if (mismatched.length > 0) {
  console.error('[morkahja] Static game data drift detected.');
  console.error(JSON.stringify(hashes, null, 2));
  process.exit(1);
}

console.log('[morkahja] Static game data verified.');
