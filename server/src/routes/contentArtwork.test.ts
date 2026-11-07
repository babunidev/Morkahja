import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import express from 'express';
import { adminRoutes } from './adminRoutes.js';
import { publicContentRoutes } from './publicContentRoutes.js';
import { inspectWebp, stageWebpArtwork } from '../services/contentArtwork.js';
import {
  publishContentRevision, readPublishedContent, readContentPointer,
} from '../services/contentPublication.js';
import { invalidateGameDataCaches } from '../services/gameData.js';

const onePixel = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const red = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAAAcQ/Y/+ByKi/wEA', 'base64');
const blue = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAAAcQ0f/+ByKi/wEA', 'base64');
const key = 'artwork-test-admin-key-never-use-live';
const dir = join(dirname(fileURLToPath(import.meta.url)), '../../game');
const paths = {
  encounters: 'encountersdata.json', solutions: 'solutiondata.json',
  expansions: 'expansiondata.json', frames: 'frames.json', portraits: 'portraits.json',
};
function fixture(): any {
  return Object.fromEntries(Object.entries(paths).map(([kind, file]) =>
    [kind, JSON.parse(readFileSync(join(dir, file), 'utf8'))]));
}
interface Context {
  root: string; base: string;
  admin: (path: string, init?: RequestInit, authenticated?: boolean) => Promise<Response>;
  public: (path: string, init?: RequestInit) => Promise<Response>;
  stage: (kind: string, name: string, intent: string, revision: string, bytes?: Buffer, authenticated?: boolean) => Promise<Response>;
}
async function withServer(run: (context: Context) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-managed-webp-'));
  const oldRoot = process.env.MORKAHJA_CONTENT_ROOT;
  const oldKey = process.env.ADMIN_API_KEY;
  const oldEnabled = process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING;
  try {
    const base = publishContentRevision(root, {
      baseRevision: null, publicationId: 'artwork_baseline_01', content: fixture(),
    }).revision;
    process.env.MORKAHJA_CONTENT_ROOT = root;
    process.env.ADMIN_API_KEY = key;
    process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = '1';
    invalidateGameDataCaches();
    const app = express();
    app.use('/game-data/admin', adminRoutes);
    app.use('/game-data', publicContentRoutes);
    const server = createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address();
    if (!port || typeof port !== 'object') throw Error('Missing test port');
    const url = 'http://127.0.0.1:' + port.port;
    const admin = (path: string, init: RequestInit = {}, authenticated = true) => fetch(
      url + '/game-data/admin' + path,
      { ...init, headers: {
        ...(authenticated ? { Authorization: 'Bearer ' + key } : {}),
        ...(init.headers ?? {}),
      } },
    );
    const stage = (kind: string, name: string, intent: string, revision: string, bytes: Buffer = red, authenticated = true) =>
      admin('/content/assets/stage', {
        method: 'POST', headers: {
          'Content-Type': 'image/webp',
          'X-Asset-Kind': kind, 'X-Asset-Name': name,
          'X-Asset-Intent': intent, 'X-Asset-Base-Revision': revision,
        }, body: bytes as unknown as BodyInit,
      }, authenticated);
    try {
      await run({ root, base, admin, stage, public: (path, init) => fetch(url + path, init) });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    }
  } finally {
    if (oldRoot === undefined) delete process.env.MORKAHJA_CONTENT_ROOT;
    else process.env.MORKAHJA_CONTENT_ROOT = oldRoot;
    if (oldKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = oldKey;
    if (oldEnabled === undefined) delete process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING;
    else process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = oldEnabled;
    invalidateGameDataCaches();
    rmSync(root, { recursive: true, force: true });
  }
}
function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function newManagedRecords(): any[] {
  const src = fixture();
  return [
    { kind: 'encounters', key: '20001', operation: 'update',
      data: { ...src.encounters['20001'], mEncounterImageName: 'managed_fresh_landscape' } },
    { kind: 'frames', key: '100', operation: 'create',
      data: { ...src.frames.Frames[1], frameID: 100 } },
    { kind: 'portraits', key: '682', operation: 'create',
      data: { ...src.portraits.Avatar[1], avatarID: 682, avatarName: 'Managed portrait' } },
  ];
}

test('WebP inspection validates RIFF, actual chunk dimensions, size and rejects non-WebP/animation', () => {
  assert.deepEqual(inspectWebp(onePixel), { width: 1, height: 1 });
  assert.deepEqual(inspectWebp(red), { width: 2, height: 2 });
  assert.deepEqual(inspectWebp(blue), { width: 2, height: 2 });
  assert.throws(() => inspectWebp(Buffer.from('not-a-webp-image')), /CONTENT_INVALID_WEBP/);
  const mismatch = Buffer.from(red);
  mismatch.writeUInt32LE(mismatch.length + 1, 4);
  assert.throws(() => inspectWebp(mismatch), /CONTENT_INVALID_WEBP/);
  const tooWide = Buffer.from(red);
  tooWide[21] = 0xff;
  tooWide[22] = 0x3f; // VP8L width=16384, exceeds policy
  assert.throws(() => inspectWebp(tooWide), /CONTENT_INVALID_WEBP_DIMENSIONS/);
});

test('authenticated staging rejects collisions, missing replacement, unsafe names and payloads', async () => {
  await withServer(async ({ root, base, stage, admin }) => {
    const baseImage = fixture().encounters['20001'].mEncounterImageName as string;
    assert.equal((await stage('encounters', baseImage, 'create', base)).status, 409);
    assert.equal((await stage('encounters', 'brand_new_art', 'replace', base)).status, 409);
    assert.equal((await stage('encounters', '../escape', 'create', base)).status, 400);
    assert.equal((await stage('portraits', 'image_682', 'create', base)).status, 400);
    assert.equal((await stage('frames', 'frame_100', 'create', '00000000-0000-0000-0000-000000000000')).status, 409);
    assert.equal((await stage('encounters', 'new_image', 'create', base, Buffer.from('bad'))).status, 422);
    assert.equal((await stage('encounters', 'new_image', 'create', base, red, false)).status, 401);
    const existing = await stage('encounters', baseImage, 'replace', base);
    assert.equal(existing.status, 201);
    const staged = await existing.json() as any;
    assert.equal(staged.intent, 'replace');
    assert.equal(staged.name, baseImage);
    assert.equal(staged.width, 2);
    assert.equal(staged.height, 2);
    assert.equal(readPublishedContent(root).revision, base); // staging never changes the pointer
    delete process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING;
    assert.equal((await stage('encounters', 'yet_another_image', 'create', base)).status, 503);
    process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING = '1';
    const wrongMime = await admin('/content/assets/stage', {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: red,
    });
    assert.equal(wrongMime.status, 400);
  });
});

test('new JSON, portraits and frames publish together; versioned URLs refresh and historical bytes remain', async () => {
  await withServer(async ({ root, base, stage, admin, public: get }) => {
    const mediaRequests = [
      ['encounters', 'managed_fresh_landscape'],
      ['frames', 'frame_100'],
      ['portraits', 'avatar_682'],
    ] as const;
    const stages: string[] = [];
    for (const [kind, name] of mediaRequests) {
      const response = await stage(kind, name, 'create', base, red);
      assert.equal(response.status, 201, await response.clone().text());
      stages.push((await response.json() as any).stageId);
    }
    const edits = newManagedRecords();
    const incomplete = await admin('/content/validate', post({
      baseRevision: base, changes: edits, assetStages: stages.slice(0, 2),
    }));
    assert.equal(incomplete.status, 422);
    const checked = await admin('/content/validate', post({ baseRevision: base, changes: edits, assetStages: stages }));
    assert.equal(checked.status, 200, await checked.text());
    assert.equal(readPublishedContent(root).revision, base);

    const publish = await admin('/content/publish', post({
      baseRevision: base, changes: edits, assetStages: stages, publicationId: 'managed_first_0001',
    }));
    assert.equal(publish.status, 200, await publish.text());
    const first = readPublishedContent(root).revision;
    assert.notEqual(first, base);
    const bundleRes = await get('/game-data/content');
    assert.equal(bundleRes.status, 200);
    const bundle = await bundleRes.json() as any;
    assert.equal(bundle.revision, first);
    for (const [kind, name] of mediaRequests) {
      const url = bundle.assets[kind][name];
      assert.equal(url, '/game-data/media/' + first + '/' + kind + '/' + name + '.webp');
      const served = await get(url);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/webp');
      assert.match(served.headers.get('cache-control') ?? '', /immutable/);
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), red);
    }
    const firstUrl = bundle.assets.encounters.managed_fresh_landscape;
    assert.equal((await get('/game-data/media/' + base + '/encounters/managed_fresh_landscape.webp')).status, 404);

    const replacement = await stage('encounters', 'managed_fresh_landscape', 'replace', first, blue);
    assert.equal(replacement.status, 201);
    const replacementId = (await replacement.json() as any).stageId;
    const onlyArtwork = await admin('/content/publish', post({
      baseRevision: first, changes: [], assetStages: [replacementId], publicationId: 'managed_replace_0001',
    }));
    assert.equal(onlyArtwork.status, 200, await onlyArtwork.text());
    const second = readPublishedContent(root).revision;
    const nextBundle = await (await get('/game-data/content')).json() as any;
    const secondUrl = nextBundle.assets.encounters.managed_fresh_landscape;
    assert.notEqual(firstUrl, secondUrl);
    assert.deepEqual(Buffer.from(await (await get(firstUrl)).arrayBuffer()), red);
    const replaced = await get(secondUrl);
    assert.deepEqual(Buffer.from(await replaced.arrayBuffer()), blue);
    const tag = replaced.headers.get('etag');
    const cached = await get(secondUrl, { headers: { 'If-None-Match': tag! } });
    assert.equal(cached.status, 304);
    assert.equal(await cached.text(), '');

    const replay = await admin('/content/publish', post({
      baseRevision: first, changes: [], assetStages: [replacementId], publicationId: 'managed_replace_0001',
    }));
    assert.equal(replay.status, 200, await replay.text());
    assert.equal(readContentPointer(root).revision, second);

    const rollback = await admin('/content/rollback', post({
      baseRevision: second, targetRevision: first, publicationId: 'managed_restore_0001',
    }));
    assert.equal(rollback.status, 200, await rollback.text());
    const restoredBundle = await (await get('/game-data/content')).json() as any;
    const restoredUrl = restoredBundle.assets.encounters.managed_fresh_landscape;
    assert.notEqual(restoredUrl, secondUrl);
    assert.deepEqual(Buffer.from(await (await get(restoredUrl)).arrayBuffer()), red);
    assert.deepEqual(Buffer.from(await (await get(secondUrl)).arrayBuffer()), blue);
  });
});

test('staged object hashes are checked at publish time, failed commit does not reveal new art', async () => {
  await withServer(async ({ root, base, public: get }) => {
    const id = stageWebpArtwork(root, readPublishedContent(root), {
      kind: 'encounters', name: 'unpublished_scene', intent: 'create',
      baseRevision: base, bytes: red,
    }).id;
    const edits = [{
      kind: 'encounters', key: '20001', operation: 'update',
      data: { ...fixture().encounters['20001'], mEncounterImageName: 'unpublished_scene' },
    }];
    // Invalid JSON relationship has no chance to publish an image.
    const invalid = structuredClone(edits);
    (invalid[0].data as any).mEncounterFollow = 999999;
    const current = readPublishedContent(root);
    assert.throws(() => publishContentRevision(root, {
      baseRevision: base, publicationId: 'managed_invalid_0001',
      content: { ...current.content, encounters: {
        ...(current.content.encounters as Record<string, unknown>),
        '20001': invalid[0].data,
      } }, assetStages: [id],
    }), /CONTENT_MISSING_FOLLOW/);
    assert.equal(readContentPointer(root).revision, base);
    assert.equal((await get('/game-data/media/' + base + '/encounters/unpublished_scene.webp')).status, 404);

    const meta = readPublishedContent(root);
    assert.throws(() => publishContentRevision(root, {
      baseRevision: base, publicationId: 'managed_crash_0001',
      content: { ...meta.content, encounters: {
        ...(meta.content.encounters as Record<string, unknown>),
        '20001': edits[0].data,
      } }, assetStages: [id],
      beforePointerSwap: () => { throw new Error('SIMULATED_CRASH'); },
    }), /SIMULATED_CRASH/);
    assert.equal(readContentPointer(root).revision, base);
    // Even a committed stage cannot be published if its immutable bytes are damaged.
    const stage = stageWebpArtwork(root, readPublishedContent(root), {
      kind: 'encounters', name: 'another_unpublished_scene', intent: 'create',
      baseRevision: base, bytes: blue,
    });
    const duplicate = stageWebpArtwork(root, readPublishedContent(root), {
      kind: 'encounters', name: 'another_unpublished_scene', intent: 'create',
      baseRevision: base, bytes: red,
    });
    assert.throws(() => publishContentRevision(root, {
      baseRevision: base, publicationId: 'managed_duplicate_0001',
      content: { ...meta.content, encounters: {
        ...(meta.content.encounters as Record<string, unknown>),
        '20001': { ...edits[0].data, mEncounterImageName: 'another_unpublished_scene' },
      } }, assetStages: [stage.id, duplicate.id],
    }), /CONTENT_DUPLICATE_ASSET_NAME/);
    writeFileSync(join(root, 'artwork', 'objects', stage.sha256 + '.webp'), Buffer.from('corrupted'));
    assert.throws(() => publishContentRevision(root, {
      baseRevision: base, publicationId: 'managed_corrupt_0001',
      content: { ...meta.content, encounters: {
        ...(meta.content.encounters as Record<string, unknown>),
        '20001': { ...edits[0].data, mEncounterImageName: 'another_unpublished_scene' },
      } }, assetStages: [stage.id],
    }), /CONTENT_(ARTWORK_CHECKSUM_MISMATCH|UNSAFE_ARTWORK_FILE)/);
    assert.equal(readContentPointer(root).revision, base);
    // No public URL is added until the pointer is committed.
  });
});
