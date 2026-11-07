import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contentImageUrl, getClientContent, getClientContentState,
  refreshClientContent, resetClientContentForTests,
} from './clientContent.js';

const firstRevision = '11111111-1111-4111-8111-111111111111';
const secondRevision = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
function payload(revision: string): Record<string, unknown> {
  const old = getClientContent();
  return structuredClone({
    revision, encounters: old.encounters, solutions: old.solutions,
    expansions: old.expansions, frames: old.frames, portraits: old.portraits,
    assets: {},
  });
}
function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

test('legacy fallback is used only when the server explicitly reports no configured publication', async () => {
  resetClientContentForTests();
  const calls: string[] = [];
  try {
    globalThis.fetch = async (_url, init) => {
      calls.push(String((init as RequestInit)?.cache));
      return response({ error: 'CONTENT_NOT_CONFIGURED' }, 503);
    };
    const fallback = await refreshClientContent();
    assert.equal(fallback.source, 'legacy');
    assert.equal(getClientContentState().status, 'ready');
    assert.equal(calls[0], 'no-cache');
    assert.match(contentImageUrl('portraits', 'avatar_1.webp'), /avatar_1\.webp$/);
    assert.equal(contentImageUrl('encounters', '../unsafe'), '');
  } finally {
    globalThis.fetch = originalFetch;
    resetClientContentForTests();
  }
});

test('a full published response replaces all five categories and subsequent 304 retains the exact snapshot', async () => {
  resetClientContentForTests();
  let queries = 0;
  const headers: RequestInit[] = [];
  try {
    const revision = firstRevision;
    const initial = payload(revision);
    globalThis.fetch = async (_url, init) => {
      headers.push(init as RequestInit);
      return queries++ === 0 ? response(initial) : new Response(null, { status: 304 });
    };
    const first = await refreshClientContent();
    assert.equal(first.source, 'published');
    assert.equal(first.revision, revision);
    assert.equal(getClientContentState().status, 'ready');
    assert.ok(Object.keys(first.encounters).length > 10);
    assert.ok(Object.keys(first.solutions).length > 10);
    assert.ok(Object.keys(first.expansions.expansions).length > 0);
    assert.ok(first.portraits.Avatar.length > 2);
    assert.ok(first.frames.Frames.length > 2);
    assert.equal(await refreshClientContent(), first);
    assert.equal((headers[1].headers as Record<string, string>)['If-None-Match'], '"' + revision + '"');
  } finally {
    globalThis.fetch = originalFetch;
    resetClientContentForTests();
  }
});

test('new revision images update atomically; corrupt/unavailable responses keep the last valid content', async () => {
  resetClientContentForTests();
  const first = payload(firstRevision);
  const second = structuredClone(first);
  second.revision = secondRevision;
  const encounters = second.encounters as Record<string, any>;
  encounters['20999'] = { ...encounters['20001'], mEncounterID: 20999,
    mEncounterImageName: 'new_client_scene', mEncounterFollow: 0 };
  second.assets = { encounters: {
    new_client_scene: '/game-data/media/' + secondRevision + '/encounters/new_client_scene.webp',
  } };
  let next: unknown = first;
  try {
    globalThis.fetch = async () => response(next);
    await refreshClientContent();
    assert.equal(getClientContent().revision, firstRevision);
    next = second;
    const updated = await refreshClientContent();
    assert.equal(updated.revision, secondRevision);
    assert.equal(updated.encounters['20999'].mEncounterImageName, 'new_client_scene');
    assert.equal(contentImageUrl('encounters', 'new_client_scene'),
      '/game-data/media/' + secondRevision + '/encounters/new_client_scene.webp');

    const invalid = structuredClone(second);
    delete (invalid as any).solutions;
    next = invalid;
    await assert.rejects(() => refreshClientContent(), /Incomplete or invalid/);
    assert.equal(getClientContentState().status, 'error');
    assert.equal(getClientContent().revision, secondRevision);
    assert.equal(getClientContent(), updated);

    const incompleteRecord = structuredClone(second);
    delete (incompleteRecord.encounters as any)['20001'].mEncounterText;
    next = incompleteRecord;
    await assert.rejects(() => refreshClientContent(), /Incomplete or invalid published game records/);
    assert.equal(getClientContent(), updated);

    const missingRelation = structuredClone(second);
    (missingRelation.encounters as any)['20001'].mEncounterFollow = 999999;
    next = missingRelation;
    await assert.rejects(() => refreshClientContent(), /references incomplete content/);
    assert.equal(getClientContent(), updated);

    next = { error: 'CONTENT_UNAVAILABLE' };
    globalThis.fetch = async () => response(next, 503);
    await assert.rejects(() => refreshClientContent(), /unavailable/i);
    assert.equal(getClientContent().revision, secondRevision);

    next = second;
    (next as any).assets.encounters.new_client_scene = 'https://untrusted.invalid/pixel.webp';
    globalThis.fetch = async () => response(next);
    await assert.rejects(() => refreshClientContent(), /image URL/);
    assert.equal(getClientContent().revision, secondRevision);
  } finally {
    globalThis.fetch = originalFetch;
    resetClientContentForTests();
  }
});

test('network/HTTP failures never convert published mode into an apparent legacy revision', async () => {
  resetClientContentForTests();
  try {
    globalThis.fetch = async () => response({ error: 'CONTENT_NOT_CONFIGURED' }, 503);
    await refreshClientContent();
    globalThis.fetch = async () => response({}, 500);
    await assert.rejects(() => refreshClientContent(), /500/);
    assert.equal(getClientContentState().status, 'error');
    // The only fallback is the previously selected, explicitly unconfigured legacy snapshot.
    assert.equal(getClientContent().source, 'legacy');

    globalThis.fetch = async () => response(payload(firstRevision));
    await refreshClientContent();
    globalThis.fetch = async () => response({ error: 'CONTENT_NOT_CONFIGURED' }, 503);
    await assert.rejects(() => refreshClientContent(), /unavailable/i);
    assert.equal(getClientContent().source, 'published');
  } finally {
    globalThis.fetch = originalFetch;
    resetClientContentForTests();
  }
});
