import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import express from 'express';
import { adminRoutes } from './adminRoutes.js';
import {
  listContentRevisions, publishContentRevision, readPublishedContent,
} from '../services/contentPublication.js';
import { invalidateGameDataCaches } from '../services/gameData.js';
import { stageWebpArtwork } from '../services/contentArtwork.js';

const key = 'admin-content-test-only-secret-do-not-deploy';
const sampleWebp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const paths = {
  encounters: 'encountersdata.json', solutions: 'solutiondata.json',
  expansions: 'expansiondata.json', frames: 'frames.json', portraits: 'portraits.json',
};
type Data = Record<keyof typeof paths, any>;
const gameDir = join(dirname(fileURLToPath(import.meta.url)), '../../game');
function fixture(): Data {
  return Object.fromEntries(Object.entries(paths).map(([kind, path]) => [
    kind, JSON.parse(readFileSync(join(gameDir, path), 'utf8')),
  ])) as Data;
}
async function setup(run: (ctx: {
  root: string;
  base: string;
  fetchAdmin: (path: string, init?: RequestInit, auth?: string) => Promise<Response>;
  fetchPublic: (path: string, init?: RequestInit) => Promise<Response>;
}) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-admin-test-'));
  const original = {
    root: process.env.MORKAHJA_CONTENT_ROOT,
    auth: process.env.ADMIN_API_KEY,
    enabled: process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING,
  };
  const base = publishContentRevision(root, {
    baseRevision: null, publicationId: 'admin_test_init_0001', content: fixture(),
  }).revision;
  process.env.MORKAHJA_CONTENT_ROOT = root;
  process.env.ADMIN_API_KEY = key;
  delete process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING;
  invalidateGameDataCaches();
  const app = express();
  app.use('/game-data/admin', adminRoutes);
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('No test address');
  const origin = `http://127.0.0.1:${address.port}`;
  const fetchAdmin = (path: string, init: RequestInit = {}, auth = key) => fetch(
    `${origin}/game-data/admin${path}`, {
      ...init, headers: { authorization: `Bearer ${auth}`, ...(init.headers ?? {}) },
    },
  );
  const fetchPublic = (path: string, init: RequestInit = {}) => fetch(
    `${origin}${path}`, init,
  );
  try {
    await run({ root, base, fetchAdmin, fetchPublic });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    if (original.root === undefined) delete process.env.MORKAHJA_CONTENT_ROOT;
    else process.env.MORKAHJA_CONTENT_ROOT = original.root;
    if (original.auth === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = original.auth;
    if (original.enabled === undefined) delete process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING;
    else process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = original.enabled;
    invalidateGameDataCaches();
    rmSync(root, { recursive: true, force: true });
  }
}
function stageNewAvatarAndFrame(root: string, base: string): string[] {
  const current = readPublishedContent(root);
  return ([
    ['frames', 'frame_100'],
    ['portraits', 'avatar_682'],
  ] as const).map(([kind, name]) => stageWebpArtwork(root, current, {
    baseRevision: base, kind, name, intent: 'create', bytes: sampleWebp,
  }).id);
}
function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function updateAllFive(): Array<Record<string, unknown>> {
  const data = fixture();
  return [
    { kind: 'encounters', operation: 'update', key: '20001',
      data: { ...data.encounters['20001'], mEncounterText: 'Admin-edited encounter lore' } },
    { kind: 'solutions', operation: 'update', key: '10001',
      data: { ...data.solutions['10001'], mSolutionName: 'Admin-edited solution' } },
    { kind: 'expansions', operation: 'update', key: '1001',
      data: { ...data.expansions.expansions['1001'], mExtensioSummaryText: 'Admin-edited expansion' } },
    { kind: 'frames', operation: 'update', key: '1',
      data: { ...data.frames.Frames[1], frameGem: 9 } },
    { kind: 'portraits', operation: 'update', key: '1',
      data: { ...data.portraits.Avatar[1], avatarName: 'Admin-edited portrait' } },
    { kind: 'encounters', operation: 'create', key: '20999',
      data: { ...data.encounters['20001'], mEncounterID: 20999, mEncounterFollow: 0, mEncounterTitle: 'New encounter' } },
    { kind: 'solutions', operation: 'create', key: '19999',
      data: { ...data.solutions['10001'], mSolutionID: 19999, mSolutionName: 'New solution' } },
    { kind: 'expansions', operation: 'create', key: '1099',
      data: { ...data.expansions.expansions['1001'], mExtensioID: 1099, mExtensioName: 'New expansion' } },
    { kind: 'frames', operation: 'create', key: '100',
      data: { ...data.frames.Frames[1], frameID: 100 } },
    { kind: 'portraits', operation: 'create', key: '682',
      data: { ...data.portraits.Avatar[1], avatarID: 682, avatarName: 'New portrait' } },
  ];
}

test('admin endpoints require a configured bearer key, reject wrong keys, and never allow legacy writes', async () => {
  await setup(async ({ root, base, fetchAdmin, fetchPublic }) => {
    const wrong = await fetchAdmin('/content', {}, 'wrong-secret');
    assert.equal(wrong.status, 401);
    const raw = await fetchPublic('/game-data/admin/content');
    assert.equal(raw.status, 401);
    delete process.env.ADMIN_API_KEY;
    const notConfigured = await fetchAdmin('/content');
    assert.equal(notConfigured.status, 503);
    process.env.ADMIN_API_KEY = key;
    delete process.env.MORKAHJA_CONTENT_ROOT;
    invalidateGameDataCaches();
    const noRoot = await fetchAdmin('/content');
    assert.equal(noRoot.status, 503); // never read Git data through admin
    process.env.MORKAHJA_CONTENT_ROOT = root;
    invalidateGameDataCaches();

    for (const kind of ['encounters', 'solutions', 'expansions', 'frames', 'portraits']) {
      const deprecated = await fetchAdmin(`/content/${kind}`, post({ key: '1', data: {} }));
      assert.equal(deprecated.status, 410, kind);
    }
    assert.equal(readPublishedContent(root).revision, base);
  });
});

test('five-category record edits, validation, publication, current read, idempotency and audit', async () => {
  await setup(async ({ root, base, fetchAdmin }) => {
    const current = await fetchAdmin('/content');
    assert.equal(current.status, 200);
    assert.equal((await current.json() as any).revision, base);

    const changes = updateAllFive();
    const assetStages = stageNewAvatarAndFrame(root, base);
    const edit = { baseRevision: base, changes, assetStages };
    const validated = await fetchAdmin('/content/validate', post(edit));
    assert.equal(validated.status, 200, await validated.text());
    const disabled = await fetchAdmin('/content/publish', post({ ...edit, publicationId: 'admin_publish_0001' }));
    assert.equal(disabled.status, 503);
    process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = '1';

    const published = await fetchAdmin('/content/publish', post({ ...edit, publicationId: 'admin_publish_0001' }));
    assert.equal(published.status, 200, await published.text());
    // Response body is intentionally consumed only in this test.
    const newest = readPublishedContent(root);
    assert.notEqual(newest.revision, base);
    assert.equal((newest.content.encounters as any)['20999'].mEncounterTitle, 'New encounter');
    assert.equal((newest.content.solutions as any)['19999'].mSolutionName, 'New solution');
    assert.equal((newest.content.expansions as any).expansions['1099'].mExtensioName, 'New expansion');
    assert.equal((newest.content.frames as any).Frames[100].frameID, 100);
    assert.equal((newest.content.portraits as any).Avatar[682].avatarID, 682);

    const same = await fetchAdmin('/content/publish', post({ ...edit, publicationId: 'admin_publish_0001' }));
    assert.equal(same.status, 200, await same.text());
    assert.equal(listContentRevisions(root).length, 2);

    const stale = await fetchAdmin('/content/publish', post({ ...edit, publicationId: 'admin_stale_0002' }));
    assert.equal(stale.status, 409);
    const alteredId = await fetchAdmin('/content/publish', post({
      baseRevision: base, changes: changes.slice(0, 1), publicationId: 'admin_publish_0001',
    }));
    assert.equal(alteredId.status, 409);

    const history = await fetchAdmin('/content/revisions');
    assert.equal(history.status, 200);
    const hist = await history.json() as any;
    assert.equal(hist.revisions.length, 2);
    const receipt = await fetchAdmin('/content/publications/admin_publish_0001');
    assert.equal((await receipt.json() as any).status, 'current');
    const archived = await fetchAdmin(`/content/revisions/${base}`);
    assert.equal((await archived.json() as any).revision, base);
    const currentEncounters = await fetchAdmin('/content/encounters');
    assert.equal((await currentEncounters.json() as any)['20999'].mEncounterTitle, 'New encounter');
    const audit = readFileSync(join(root, 'admin-audit.jsonl'), 'utf8');
    assert.match(audit, /"action":"publish"/);
    assert.match(audit, /"outcome":"success"/);
    assert.doesNotMatch(audit, new RegExp(key));
  });
});

test('oversized admin bodies are rejected before storage writes', async () => {
  await setup(async ({ root, base, fetchAdmin }) => {
    const res = await fetchAdmin('/content/validate', post({
      baseRevision: base, changes: [], padding: 'x'.repeat(300_000),
    }));
    assert.equal(res.status, 413);
    assert.equal(readPublishedContent(root).revision, base);
  });
});

test('validation rejects missing relations, mismatched IDs and unknown asset references', async () => {
  await setup(async ({ root, base, fetchAdmin }) => {
    const changes = updateAllFive().slice(0, 5);
    const badRelationship = structuredClone(changes);
    (badRelationship[0]!.data as Record<string, unknown>).mEncounterFollow = 999999;
    const bad = await fetchAdmin('/content/validate', post({ baseRevision: base, changes: badRelationship }));
    assert.equal(bad.status, 422);

    const badId = structuredClone(changes);
    (badId[0]!.data as Record<string, unknown>).mEncounterID = 42;
    const invalid = await fetchAdmin('/content/validate', post({ baseRevision: base, changes: badId }));
    assert.equal(invalid.status, 400);

    const repurposed = structuredClone(changes);
    (repurposed[1]!.data as Record<string, unknown>).mSolutionInventoryType =
      (repurposed[1]!.data as Record<string, number>).mSolutionInventoryType === 1 ? 2 : 1;
    const incompatible = await fetchAdmin('/content/validate', post({ baseRevision: base, changes: repurposed }));
    assert.equal(incompatible.status, 422);
    assert.deepEqual(await incompatible.json(), { error: 'CONTENT_IDENTITY_CHANGE_NOT_SUPPORTED' });

    const missingAsset = structuredClone(changes);
    (missingAsset[0]!.data as Record<string, unknown>).mEncounterImageName = 'nonexistent_new_art';
    const unapproved = await fetchAdmin('/content/validate', post({ baseRevision: base, changes: missingAsset }));
    assert.equal(unapproved.status, 422);
    assert.deepEqual(await unapproved.json(), { error: 'CONTENT_UNSTAGED_ASSET_REFERENCE' });
    assert.equal(readPublishedContent(root).revision, base);
  });
});

test('rollback creates a new checked revision, preserves immutable history and rejects destructive rollback', async () => {
  await setup(async ({ root, base, fetchAdmin }) => {
    process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = '1';
    const edits = updateAllFive().slice(0, 5); // no new IDs, so restoring is safe
    const first = await fetchAdmin('/content/publish', post({
      baseRevision: base, publicationId: 'edit_before_restore_01', changes: edits,
    }));
    assert.equal(first.status, 200);
    const newer = readPublishedContent(root).revision;
    const rollback = await fetchAdmin('/content/rollback', post({
      baseRevision: newer, targetRevision: base, publicationId: 'restore_to_initial_01',
    }));
    assert.equal(rollback.status, 200, await rollback.text());
    const restored = readPublishedContent(root);
    assert.equal(restored.manifest.operation, 'rollback');
    assert.equal(restored.manifest.restoredFrom, base);
    assert.equal((restored.content.encounters as any)['20001'].mEncounterText,
      (fixture().encounters as any)['20001'].mEncounterText);
    const replay = await fetchAdmin('/content/rollback', post({
      baseRevision: newer, targetRevision: base, publicationId: 'restore_to_initial_01',
    }));
    assert.equal(replay.status, 200);
    assert.equal(listContentRevisions(root).length, 3);

    const changes = updateAllFive().slice(5); // create five new IDs
    const assetStages = stageNewAvatarAndFrame(root, restored.revision);
    const added = await fetchAdmin('/content/publish', post({
      baseRevision: restored.revision, publicationId: 'create_after_restore_01', changes, assetStages,
    }));
    assert.equal(added.status, 200, await added.text());
    const afterAdd = readPublishedContent(root).revision;
    const blocked = await fetchAdmin('/content/rollback', post({
      baseRevision: afterAdd, targetRevision: base, publicationId: 'unsafe_restore_0001',
    }));
    assert.equal(blocked.status, 422);
    assert.equal(readPublishedContent(root).revision, afterAdd);
  });
});

test('admin mutation requests are rate limited before parsing, and media upload remains disabled', async () => {
  await setup(async ({ root, base, fetchAdmin }) => {
    const media = await fetchAdmin('/content/assets/stage', post({ filename: 'new.webp' }));
    assert.ok([429, 503].includes(media.status)); // disabled until the explicit publishing flag is enabled
    let observedLimit = media.status === 429;
    for (let i = 0; i < 25; i += 1) {
      const response = await fetchAdmin('/content/encounters', post({ key: '20001', data: {} }));
      if (response.status === 429) {
        observedLimit = true;
        assert.ok(Number(response.headers.get('retry-after')) > 0);
        break;
      }
      assert.equal(response.status, 410);
    }
    assert.equal(observedLimit, true);
    assert.equal(readPublishedContent(root).revision, base);
  });
});
