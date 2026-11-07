import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  listContentRevisions, publishContentRevision, readContentPointer, readContentRevision,
} from '../server/src/services/contentPublication.js';
import { readArtworkObject, stageWebpArtwork } from '../server/src/services/contentArtwork.js';
import {
  createContentBackup, restoreContentBackup, verifyContentBackup,
} from './content-backup.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = join(repoRoot, 'server', 'game');
const onePixel = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
function baseline(): Record<string, any> {
  return {
    encounters: JSON.parse(readFileSync(join(fixtureRoot, 'encountersdata.json'), 'utf8')),
    solutions: JSON.parse(readFileSync(join(fixtureRoot, 'solutiondata.json'), 'utf8')),
    expansions: JSON.parse(readFileSync(join(fixtureRoot, 'expansiondata.json'), 'utf8')),
    frames: JSON.parse(readFileSync(join(fixtureRoot, 'frames.json'), 'utf8')),
    portraits: JSON.parse(readFileSync(join(fixtureRoot, 'portraits.json'), 'utf8')),
  };
}
function temporaryRoots(): { base: string; source: string; backups: string } {
  const base = mkdtempSync(join(tmpdir(), 'morkahja-content-recovery-'));
  const source = join(base, 'content');
  const backups = join(base, 'off-host-backup-mount');
  mkdirSync(source, { mode: 0o700 });
  mkdirSync(backups, { mode: 0o700 });
  return { base, source, backups };
}
function publish(root: string, baseRevision: string | null, publicationId: string, content: unknown, assetStages?: string[]) {
  return publishContentRevision(root, { baseRevision, publicationId, content, assetStages });
}

test('versioned backup preserves current and historical JSON, managed artwork and admin audit; restore verifies into a new root', () => {
  const roots = temporaryRoots();
  const previousRoot = process.env.MORKAHJA_CONTENT_ROOT;
  const previousWebRoot = process.env.MORKAHJA_DEPLOY_WEB_ROOT;
  delete process.env.MORKAHJA_CONTENT_ROOT;
  delete process.env.MORKAHJA_DEPLOY_WEB_ROOT;
  try {
    const data = baseline();
    const first = publish(roots.source, null, 'backup_initial_01', data);
    const encounterEntry = Object.entries(data.encounters).find(([, value]) =>
      value && typeof value === 'object' && typeof (value as Record<string, unknown>).mEncounterImageName === 'string');
    assert.ok(encounterEntry);
    const [encounterKey, encounterRecord] = encounterEntry as [string, Record<string, unknown>];
    const stage = stageWebpArtwork(roots.source, first, {
      kind: 'encounters', name: 'backup_recovery_scene', intent: 'create',
      baseRevision: first.revision, bytes: onePixel,
    });
    const changed = structuredClone(data);
    changed.encounters[encounterKey] = {
      ...encounterRecord, mEncounterImageName: 'backup_recovery_scene',
    };
    const second = publish(roots.source, first.revision, 'backup_artwork_01', changed, [stage.id]);
    writeFileSync(join(roots.source, 'admin-audit.jsonl'),
      '{"action":"publish","outcome":"success","revision":"' + second.revision + '"}\n');

    const backupPath = createContentBackup(roots.source, roots.backups, {
      confirmOffHost: true, repoRoot,
    });
    assert.match(backupPath, /morkahja-content-.*-[0-9a-f-]{36}$/);
    const verified = verifyContentBackup(backupPath);
    assert.equal(verified.currentRevision, second.revision);
    assert.equal(verified.revisions.length, 2);
    assert.equal(existsSync(join(backupPath, 'artwork', 'staged')), false);
    assert.equal(existsSync(join(backupPath, 'artwork', 'objects', stage.sha256 + '.webp')), true);
    assert.equal(readFileSync(join(backupPath, 'admin-audit.jsonl'), 'utf8').includes(second.revision), true);
    assert.equal(existsSync(join(roots.source, '.publication.lock')), false);

    const restoredPath = join(roots.base, 'restored-content');
    const restored = restoreContentBackup(backupPath, restoredPath, { repoRoot });
    assert.equal(restored.revision, second.revision);
    assert.deepEqual(listContentRevisions(restoredPath).map(item => item.revision).sort(),
      [first.revision, second.revision].sort());
    const historical = readContentRevision(restoredPath, second.revision);
    const asset = historical.manifest.assets?.encounters?.backup_recovery_scene;
    assert.ok(asset);
    assert.deepEqual(readArtworkObject(restoredPath, asset), onePixel);
    assert.equal(readFileSync(join(restoredPath, 'admin-audit.jsonl'), 'utf8'),
      readFileSync(join(roots.source, 'admin-audit.jsonl'), 'utf8'));
    assert.equal(readContentPointer(restoredPath).revision, second.revision);
  } finally {
    if (previousRoot === undefined) delete process.env.MORKAHJA_CONTENT_ROOT;
    else process.env.MORKAHJA_CONTENT_ROOT = previousRoot;
    if (previousWebRoot === undefined) delete process.env.MORKAHJA_DEPLOY_WEB_ROOT;
    else process.env.MORKAHJA_DEPLOY_WEB_ROOT = previousWebRoot;
    rmSync(roots.base, { recursive: true, force: true });
  }
});

test('backup refuses to run without explicit off-host confirmation or while publication lock is held', () => {
  const roots = temporaryRoots();
  try {
    publish(roots.source, null, 'backup_lock_0001', baseline());
    assert.throws(() => createContentBackup(roots.source, roots.backups, {
      confirmOffHost: false, repoRoot,
    }), /CONTENT_BACKUP_OFF_HOST_CONFIRMATION_REQUIRED/);
    writeFileSync(join(roots.source, '.publication.lock'), 'active\n', { flag: 'wx' });
    assert.throws(() => createContentBackup(roots.source, roots.backups, {
      confirmOffHost: true, repoRoot,
    }), /CONTENT_PUBLICATION_LOCKED/);
  } finally { rmSync(roots.base, { recursive: true, force: true }); }
});

test('backup rejects path overlap and verifies every stored checksum before restore', () => {
  const roots = temporaryRoots();
  try {
    const published = publish(roots.source, null, 'backup_integrity_01', baseline());
    assert.throws(() => createContentBackup(roots.source, roots.source, {
      confirmOffHost: true, repoRoot,
    }), /CONTENT_BACKUP_PATH_OVERLAP/);
    const backupPath = createContentBackup(roots.source, roots.backups, {
      confirmOffHost: true, repoRoot,
    });
    const manifest = verifyContentBackup(backupPath);
    assert.equal(manifest.currentRevision, published.revision);
    const contentPath = join(backupPath, 'revisions', published.revision, 'encountersdata.json');
    writeFileSync(contentPath, '{}\n');
    assert.throws(() => verifyContentBackup(backupPath), /CONTENT_BACKUP_CHECKSUM_MISMATCH/);
    assert.throws(() => restoreContentBackup(backupPath, join(roots.base, 'invalid-restore'), { repoRoot }),
      /CONTENT_BACKUP_CHECKSUM_MISMATCH/);
  } finally { rmSync(roots.base, { recursive: true, force: true }); }
});

test('restore never overwrites an existing content root', () => {
  const roots = temporaryRoots();
  try {
    publish(roots.source, null, 'backup_no_overwrite_1', baseline());
    const backupPath = createContentBackup(roots.source, roots.backups, {
      confirmOffHost: true, repoRoot,
    });
    const destination = join(roots.base, 'existing-content');
    mkdirSync(destination);
    writeFileSync(join(destination, 'keep.txt'), 'untouched');
    assert.throws(() => restoreContentBackup(backupPath, destination, { repoRoot }),
      /CONTENT_RESTORE_DESTINATION_EXISTS/);
    assert.equal(readFileSync(join(destination, 'keep.txt'), 'utf8'), 'untouched');
  } finally { rmSync(roots.base, { recursive: true, force: true }); }
});
