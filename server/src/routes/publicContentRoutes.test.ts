import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { publicContentRoutes } from './publicContentRoutes.js';
import {
  getEncounters, getGameRuntimeContentSnapshot, getPublishedContentSnapshot,
  getSolutionMap, invalidateGameDataCaches,
} from '../services/gameData.js';
import {
  publishContentRevision, readContentPointer, readPublishedContent,
} from '../services/contentPublication.js';

const gameDir = join(dirname(fileURLToPath(import.meta.url)), '../../game');
function source() {
  const files = {
    encounters: 'encountersdata.json', solutions: 'solutiondata.json',
    expansions: 'expansiondata.json', frames: 'frames.json', portraits: 'portraits.json',
  };
  return Object.fromEntries(Object.entries(files).map(([kind, file]) => [
    kind, JSON.parse(readFileSync(join(gameDir, file), 'utf8')) as unknown,
  ])) as Record<keyof typeof files, unknown>;
}
async function withHttpServer(work: (url: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use('/game-data', publicContentRoutes);
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Test server missing address');
  try {
    await work(`http://127.0.0.1:${address.port}/game-data/content`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}
async function withContentRoot(work: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-runtime-test-'));
  const previous = process.env.MORKAHJA_CONTENT_ROOT;
  try {
    delete process.env.MORKAHJA_CONTENT_ROOT;
    invalidateGameDataCaches();
    await work(root);
  } finally {
    if (previous === undefined) delete process.env.MORKAHJA_CONTENT_ROOT;
    else process.env.MORKAHJA_CONTENT_ROOT = previous;
    invalidateGameDataCaches();
    rmSync(root, { recursive: true, force: true });
  }
}

test('public content route is read-only and does not expose Git fallback when unconfigured', async () => {
  await withContentRoot(async () => {
    await withHttpServer(async url => {
      const response = await fetch(url);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.deepEqual(await response.json(), { error: 'CONTENT_NOT_CONFIGURED' });
      const post = await fetch(url, { method: 'POST' });
      assert.equal(post.status, 404);
    });
  });
});

test('public content is one canonical revision; ETag revalidation and immediate refresh work', async () => {
  await withContentRoot(async root => {
    const baseline = source();
    const first = publishContentRevision(root, {
      baseRevision: null, publicationId: 'http_baseline_001', content: baseline,
    });
    process.env.MORKAHJA_CONTENT_ROOT = root;
    invalidateGameDataCaches();
    await withHttpServer(async url => {
      const firstResponse = await fetch(url);
      assert.equal(firstResponse.status, 200);
      assert.equal(firstResponse.headers.get('cache-control'), 'no-cache');
      const firstTag = firstResponse.headers.get('etag');
      assert.equal(firstTag, `"${first.revision}"`);
      const firstBody = await firstResponse.json() as Record<string, any>;
      assert.equal(firstBody.revision, first.revision);
      assert.deepEqual(firstBody.encounters, baseline.encounters);
      assert.deepEqual(firstBody.solutions, baseline.solutions);
      assert.deepEqual(firstBody.expansions, baseline.expansions);
      assert.deepEqual(firstBody.frames, baseline.frames);
      assert.deepEqual(firstBody.portraits, baseline.portraits);
      assert.deepEqual(firstBody.assets, {});

      const unchanged = await fetch(url, { headers: { 'If-None-Match': firstTag! } });
      assert.equal(unchanged.status, 304);
      assert.equal(await unchanged.text(), '');

      const capturedBefore = getGameRuntimeContentSnapshot();
      assert.equal(capturedBefore.revision, first.revision);
      const altered = structuredClone(baseline) as typeof baseline;
      const encounters = altered.encounters as Record<string, Record<string, unknown>>;
      const solutions = altered.solutions as Record<string, Record<string, unknown>>;
      encounters['20001']!.mEncounterTitle = 'Fresh content without restart';
      solutions['10001']!.mSolutionName = 'Fresh skill without restart';

      const second = publishContentRevision(root, {
        baseRevision: first.revision, publicationId: 'http_update_002', content: altered,
      });
      const changedResponse = await fetch(url, { headers: { 'If-None-Match': firstTag! } });
      assert.equal(changedResponse.status, 200);
      assert.equal(changedResponse.headers.get('etag'), `"${second.revision}"`);
      const changed = await changedResponse.json() as Record<string, any>;
      assert.equal(changed.encounters['20001'].mEncounterTitle, 'Fresh content without restart');
      assert.equal(changed.solutions['10001'].mSolutionName, 'Fresh skill without restart');

      assert.equal(getGameRuntimeContentSnapshot().revision, second.revision);
      assert.equal(getEncounters()['20001']?.mEncounterTitle, 'Fresh content without restart');
      assert.equal(getSolutionMap()['10001']?.mSolutionName, 'Fresh skill without restart');
      assert.equal(capturedBefore.encounters['20001']?.mEncounterTitle,
        (baseline.encounters as Record<string, Record<string, unknown>>)['20001']?.mEncounterTitle);
    });
  });
});

test('selected readers do not mix revisions after an external pointer swap', async () => {
  await withContentRoot(async root => {
    const first = publishContentRevision(root, {
      baseRevision: null, publicationId: 'snapshot_initial_01', content: source(),
    });
    const oldPointer = readContentPointer(root);
    const changed = source();
    (changed.solutions as Record<string, Record<string, unknown>>)['10001']!.mSolutionName = 'Changed';
    const second = publishContentRevision(root, {
      baseRevision: first.revision, publicationId: 'snapshot_changed_02', content: changed,
    });
    assert.equal(readPublishedContent(root, oldPointer).revision, first.revision);
    assert.equal(readPublishedContent(root).revision, second.revision);
  });
});

test('configured but corrupt or absent published data fails closed without leaking paths', async () => {
  await withContentRoot(async root => {
    process.env.MORKAHJA_CONTENT_ROOT = root;
    invalidateGameDataCaches();
    await withHttpServer(async url => {
      let response = await fetch(url);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'CONTENT_UNAVAILABLE' });
      assert.throws(() => getPublishedContentSnapshot());

      const baseline = publishContentRevision(root, {
        baseRevision: null, publicationId: 'http_corruption_01', content: source(),
      });
      response = await fetch(url);
      assert.equal(response.status, 200);
      writeFileSync(join(root, 'current.json'), JSON.stringify({ revision: 'invalid' }));
      response = await fetch(url);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'CONTENT_UNAVAILABLE' });
      assert.throws(() => getEncounters());
      assert.equal(readPublishedContent(root, {
        revision: baseline.revision,
        manifestSha256: readFileSync(join(root, 'revisions', baseline.revision, 'manifest.json')).toString()
          ? requireValidManifestDigest(root, baseline.revision) : '',
      }).revision, baseline.revision);
    });
  });
});
function requireValidManifestDigest(root: string, revision: string): string {
  // Needed solely to verify that a damaged pointer does not damage intact revisions.
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha256')
    .update(readFileSync(join(root, 'revisions', revision, 'manifest.json'))).digest('hex');
}
