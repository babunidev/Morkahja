import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readPublishedContent } from '../src/services/contentPublication.js';
import {
  initializeLegacyContent,
  inspectLegacyContent,
  LEGACY_CONTENT_FILES,
} from './contentInitialize.js';

function sandbox(callback: (paths: {
  root: string;
  sourceRoot: string;
  contentRoot: string;
  backupRoot: string;
  repositoryRoot: string;
  webRoot: string;
}) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-content-initialize-'));
  const paths = {
    root,
    sourceRoot: join(root, 'legacy'),
    contentRoot: join(root, 'content'),
    backupRoot: join(root, 'backup'),
    repositoryRoot: join(root, 'application'),
    webRoot: join(root, 'web'),
  };

  for (const directory of Object.values(paths)) mkdirSync(directory, { recursive: true });
  const checkedInGame = join(dirname(fileURLToPath(import.meta.url)), '../game');
  for (const file of LEGACY_CONTENT_FILES) {
    copyFileSync(join(checkedInGame, file.name), join(paths.sourceRoot, file.name));
  }

  try {
    callback(paths);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function initializationOptions(paths: {
  sourceRoot: string;
  contentRoot: string;
  backupRoot: string;
  repositoryRoot: string;
  webRoot: string;
}) {
  return {
    ...paths,
    publicationId: 'migration_test_initial_001',
    environment: 'staging' as const,
    confirmOffHostBackup: true,
    requireMountpoint: false,
  };
}

test('dry-run validates all five legacy datasets without writing either destination', () => {
  sandbox(paths => {
    const inspection = inspectLegacyContent(paths.sourceRoot);
    assert.equal(inspection.files.length, 5);
    assert.ok(inspection.counts.encounters > 0);
    assert.ok(inspection.counts.solutions > 0);
    assert.ok(inspection.counts.expansions > 0);
    assert.ok(inspection.counts.frames > 0);
    assert.ok(inspection.counts.portraits > 0);
    assert.deepEqual(readdirSync(paths.contentRoot), []);
    assert.deepEqual(readdirSync(paths.backupRoot), []);
  });
});

test('initial import verifies an off-host source backup before publishing the first revision', () => {
  sandbox(paths => {
    const sourceBytes = new Map(
      LEGACY_CONTENT_FILES.map(file => [
        file.name,
        readFileSync(join(paths.sourceRoot, file.name)),
      ]),
    );

    const result = initializeLegacyContent(initializationOptions(paths));
    const published = readPublishedContent(paths.contentRoot);
    const manifest = JSON.parse(
      readFileSync(join(result.backupDirectory, 'manifest.json'), 'utf8'),
    ) as { format: string; files: Array<{ name: string; bytes: number; sha256: string }> };

    assert.equal(published.revision, result.revision);
    assert.deepEqual(published.content, inspectLegacyContent(paths.sourceRoot).bundle);
    assert.equal(manifest.format, 'morkahja-legacy-content-backup-v1');
    assert.equal(manifest.files.length, 5);
    assert.equal(readdirSync(result.backupDirectory).length, 6);

    for (const file of LEGACY_CONTENT_FILES) {
      const source = sourceBytes.get(file.name)!;
      const backup = readFileSync(join(result.backupDirectory, file.name));
      assert.deepEqual(backup, source);
      assert.deepEqual(readFileSync(join(paths.sourceRoot, file.name)), source);
    }

    assert.ok(existsSync(join(paths.contentRoot, 'current.json')));
  });
});

test('invalid cross-references fail before a backup or initial content revision is written', () => {
  sandbox(paths => {
    const filePath = join(paths.sourceRoot, 'encountersdata.json');
    const encounters = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, Record<string, unknown>>;
    const firstKey = Object.keys(encounters)[0]!;
    encounters[firstKey]!.mEncounterSolutiuonA = 987654321;
    writeFileSync(filePath, JSON.stringify(encounters));

    assert.throws(() => initializeLegacyContent(initializationOptions(paths)));
    assert.deepEqual(readdirSync(paths.backupRoot), []);
    assert.deepEqual(readdirSync(paths.contentRoot), []);
  });
});

test('non-empty content roots are never overwritten and no backup is created', () => {
  sandbox(paths => {
    writeFileSync(join(paths.contentRoot, 'keep.txt'), 'preserve');
    assert.throws(() => initializeLegacyContent(initializationOptions(paths)));
    assert.deepEqual(readdirSync(paths.backupRoot), []);
    assert.equal(readFileSync(join(paths.contentRoot, 'keep.txt'), 'utf8'), 'preserve');
  });
});

test('initialization requires off-host confirmation and separate production approval', () => {
  sandbox(paths => {
    assert.throws(() => initializeLegacyContent({
      ...initializationOptions(paths),
      confirmOffHostBackup: false,
    }), /off-host backup confirmation/i);

    assert.throws(() => initializeLegacyContent({
      ...initializationOptions(paths),
      environment: 'production',
      confirmProductionCutover: false,
    }), /separate cutover approval/i);

    assert.deepEqual(readdirSync(paths.backupRoot), []);
    assert.deepEqual(readdirSync(paths.contentRoot), []);
  });
});
