import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';

import { resolveTrustProxySetting } from './trustProxy.js';

test('resolveTrustProxySetting defaults to loopback and accepts overrides', () => {
  assert.equal(resolveTrustProxySetting(undefined), 'loopback');
  assert.equal(resolveTrustProxySetting(''), 'loopback');
  assert.equal(resolveTrustProxySetting('  '), 'loopback');
  assert.equal(resolveTrustProxySetting('false'), false);
  assert.equal(resolveTrustProxySetting('FALSE'), false);
  assert.equal(resolveTrustProxySetting('loopback, 10.0.0.5'), 'loopback, 10.0.0.5');
});

async function ipSeenBehind(trust: string | false, forwardedFor?: string): Promise<string> {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/ip`, {
      headers: forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {},
    });
    return ((await response.json()) as { ip: string }).ip;
  } finally {
    server.close();
  }
}

test('a same-host proxy (loopback peer) exposes each player address', async () => {
  const trust = resolveTrustProxySetting(undefined);
  assert.equal(await ipSeenBehind(trust, '203.0.113.7'), '203.0.113.7');
  assert.equal(await ipSeenBehind(trust, '198.51.100.9'), '198.51.100.9');
  // Nginx appends the real peer: only the right-most untrusted hop is used.
  assert.equal(await ipSeenBehind(trust, '192.0.2.1, 203.0.113.7'), '203.0.113.7');
});

test('without trust every player collapses onto the proxy address', async () => {
  const ip = await ipSeenBehind(false, '203.0.113.7');
  assert.match(ip, /127\.0\.0\.1$/);
});

test('a non-loopback peer cannot spoof X-Forwarded-For under the default', async () => {
  // Trust only a documentation address that is not our peer.
  const ip = await ipSeenBehind('192.0.2.200', '203.0.113.7');
  assert.match(ip, /127\.0\.0\.1$/);
});
