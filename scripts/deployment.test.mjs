import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { repositoryRoot as repoRootForTest, verifyDeploymentIsolation } from './verify-deployment-isolation.mjs';
import { deployApplication } from './deploy-application.mjs';

test('deployment preflight accepts four independent existing roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-preflight-'));
  try {
    const repo = join(root, 'application');
    const content = join(root, 'persistent-content');
    const web = join(root, 'static-web');
    const backup = join(root, 'remote-backup');
    for (const path of [repo, content, web, backup]) mkdirSync(path);
    writeFileSync(join(web, '.morkahja-static-root'), 'morkahja-static-root-v1\\n');
    const result = verifyDeploymentIsolation({ repoRoot: repo, contentRoot: content, webRoot: web, backupRoot: backup });
    assert.throws(() => verifyDeploymentIsolation({
      repoRoot: repo, contentRoot: content, webRoot: web, backupRoot: backup, requireBackupMount: true,
    }), /DEPLOY_BACKUP_ROOT_NOT_MOUNTPOINT/);
    assert.equal(result.content, content);
    assert.equal(result.web, web);
    assert.equal(result.backup, backup);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deployment preflight rejects content inside the Git checkout or web root', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-overlap-'));
  try {
    const repo = join(root, 'application');
    const content = join(repo, 'published-content');
    const web = join(root, 'static-web');
    const backup = join(root, 'remote-backup');
    for (const path of [repo, content, web, backup]) mkdirSync(path, { recursive: true });
    assert.throws(() => verifyDeploymentIsolation({ repoRoot: repo, contentRoot: content, webRoot: web, backupRoot: backup }),
      /DEPLOY_CONTENT_ROOT_OVERLAPS_APPLICATION/);
    const externalContent = join(root, 'content');
    mkdirSync(externalContent);
    assert.throws(() => verifyDeploymentIsolation({ repoRoot: repo, contentRoot: externalContent, webRoot: externalContent, backupRoot: backup }),
      /DEPLOY_CONTENT_ROOT_OVERLAPS_WEB_ROOT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deployment preflight rejects a backup directory inside the published content root', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-backup-overlap-'));
  try {
    const repo = join(root, 'application');
    const content = join(root, 'content');
    const web = join(root, 'web');
    const backup = join(content, 'backups');
    for (const path of [repo, content, web, backup]) mkdirSync(path, { recursive: true });
    assert.throws(() => verifyDeploymentIsolation({ repoRoot: repo, contentRoot: content, webRoot: web, backupRoot: backup }),
      /DEPLOY_BACKUP_ROOT_OVERLAPS_CONTENT_ROOT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deployment preflight rejects symlinked roots and missing configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-symlink-'));
  try {
    const repo = join(root, 'application');
    const content = join(root, 'content');
    const web = join(root, 'web');
    const backup = join(root, 'backup');
    for (const path of [repo, content, web, backup]) mkdirSync(path);
    const alias = join(root, 'content-alias');
    symlinkSync(content, alias, 'dir');
    assert.throws(() => verifyDeploymentIsolation({ repoRoot: repo, contentRoot: alias, webRoot: web, backupRoot: backup }),
      /DEPLOY_CONTENT_ROOT_REQUIRED/);
    assert.throws(() => verifyDeploymentIsolation({ repoRoot: repo, contentRoot: content, webRoot: web }),
      /DEPLOY_BACKUP_ROOT_REQUIRED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deployment preflight refuses an unmarked static web root', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-unmarked-web-'));
  try {
    const repo = join(root, 'application');
    const content = join(root, 'content');
    const web = join(root, 'web');
    const backup = join(root, 'backup');
    for (const path of [repo, content, web, backup]) mkdirSync(path);
    assert.throws(() => verifyDeploymentIsolation({
      repoRoot: repo, contentRoot: content, webRoot: web, backupRoot: backup,
    }), /DEPLOY_WEB_ROOT_NOT_MARKED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('application deployment aborts at path preflight before any Git or filesystem deployment command', () => {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-deploy-runner-'));
  try {
    const web = join(root, 'web');
    mkdirSync(web);
    assert.throws(() => deployApplication({
      MORKAHJA_CONTENT_ROOT: repoRootForTest,
      MORKAHJA_DEPLOY_WEB_ROOT: web,
      MORKAHJA_CONTENT_BACKUP_ROOT: '/',
      MORKAHJA_BACKUP_OFF_HOST_CONFIRMED: '1',
    }), /DEPLOY_CONTENT_ROOT_OVERLAPS_APPLICATION/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
