import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession, SessionError } from './sessionService.js';

function randomDeviceKey(): string {
  return `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const challenge = `morkahja-restore:${identityPublicJwk}`;
const signature = sign(
  'sha256',
  Buffer.from(challenge, 'utf8'),
  { key: identityKeyPair.privateKey, dsaEncoding: 'ieee-p1363' },
).toString('base64url');

const firstSession = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: identityPublicJwk,
  playerName: `session-auth-${Date.now()}`,
});

assert.ok(firstSession.playerId.length > 0);

let unsignedExistingError: unknown;
try {
  await bootstrapSession({
    devicePublicKey: randomDeviceKey(),
    identityPublicKey: identityPublicJwk,
  });
} catch (error) {
  unsignedExistingError = error;
}

assert.ok(unsignedExistingError instanceof SessionError);
assert.equal((unsignedExistingError as SessionError).statusCode, 401);

const restored = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: identityPublicJwk,
  signedIdentityChallenge: {
    challenge,
    signature,
  },
});

assert.equal(restored.playerId, firstSession.playerId);
console.log('sessionService.test.ts passed');
