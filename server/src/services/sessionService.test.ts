import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import { pool } from '../db/postgresDocumentStore.js';
import {
  bootstrapSession,
  issueSessionChallenge,
  SessionError,
  type BootstrapSessionInput,
  type SessionChallengePurpose,
} from './sessionService.js';

function keyPair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

type Pair = ReturnType<typeof keyPair>;

function publicKeyString(keys: Pair): string {
  return JSON.stringify(keys.publicKey.export({ format: 'jwk' }));
}

function signature(key: KeyObject, challenge: string): string {
  return sign(
    'sha256',
    Buffer.from(challenge, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
  ).toString('base64url');
}

async function signedBootstrap(
  identity: Pair,
  device: Pair,
  purpose: SessionChallengePurpose,
  playerName?: string,
): Promise<BootstrapSessionInput> {
  const identityPublicKey = publicKeyString(identity);
  const devicePublicKey = publicKeyString(device);
  const { challenge, expiresAt } = await issueSessionChallenge({
    devicePublicKey,
    identityPublicKey,
    purpose,
  });

  assert.ok(expiresAt > Date.now());
  assert.ok(expiresAt <= Date.now() + 120_000);

  return {
    identityPublicKey,
    devicePublicKey,
    purpose,
    playerName,
    signedIdentityChallenge: { challenge, signature: signature(identity.privateKey, challenge) },
    signedDeviceChallenge: { challenge, signature: signature(device.privateKey, challenge) },
  };
}

async function rejects401(input: BootstrapSessionInput): Promise<void> {
  await assert.rejects(
    bootstrapSession(input),
    (error: unknown) => error instanceof SessionError && error.statusCode === 401,
  );
}

const identity = keyPair();
const device = keyPair();
const register = await signedBootstrap(identity, device, 'register', `session-auth-${Date.now()}`);
const firstSession = await bootstrapSession(register);
assert.ok(firstSession.playerId);
await rejects401(register); // Registration challenge cannot be replayed.

await rejects401({
  identityPublicKey: register.identityPublicKey,
  devicePublicKey: register.devicePublicKey,
}); // Public keys alone do not prove possession.

const restoreDevice = keyPair();
const restore = await signedBootstrap(identity, restoreDevice, 'restore');
const restored = await bootstrapSession(restore);
assert.equal(restored.playerId, firstSession.playerId);
await rejects401(restore); // Recovery signature cannot be reused.

const otherIdentity = keyPair();
const otherDevice = keyPair();
const bound = await signedBootstrap(identity, restoreDevice, 'restore');
const challenge = bound.signedIdentityChallenge!.challenge;

await rejects401({
  ...bound,
  signedIdentityChallenge: {
    challenge,
    signature: signature(otherIdentity.privateKey, challenge),
  },
});
await rejects401({
  ...bound,
  signedDeviceChallenge: {
    challenge,
    signature: signature(otherDevice.privateKey, challenge),
  },
});
await rejects401({
  ...bound,
  devicePublicKey: publicKeyString(otherDevice),
  signedDeviceChallenge: {
    challenge,
    signature: signature(otherDevice.privateKey, challenge),
  },
});
await rejects401({ ...bound, purpose: 'register' });
await bootstrapSession(bound); // Invalid attempts must not consume a valid challenge.

const expired = await signedBootstrap(identity, keyPair(), 'restore');
const expiredHash = createHash('sha256')
  .update(expired.signedIdentityChallenge!.challenge)
  .digest('hex');
await pool.query(
  'UPDATE session_auth_challenges SET expires_at = $1 WHERE challenge_hash = $2',
  [Date.now() - 1, expiredHash],
);
await rejects401(expired);

const concurrent = await signedBootstrap(identity, keyPair(), 'restore');
const outcomes = await Promise.allSettled([
  bootstrapSession(concurrent),
  bootstrapSession(concurrent),
]);
assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);

const missingIdentity = keyPair();
const missing = await signedBootstrap(missingIdentity, keyPair(), 'restore');
await assert.rejects(
  bootstrapSession(missing),
  (error: unknown) => error instanceof SessionError && error.statusCode === 404,
);

await assert.rejects(
  issueSessionChallenge({
    devicePublicKey: 'not-a-public-key',
    identityPublicKey: publicKeyString(identity),
    purpose: 'restore',
  }),
  (error: unknown) => error instanceof SessionError && error.statusCode === 400,
);

const issued1 = await issueSessionChallenge({
  identityPublicKey: publicKeyString(identity),
  devicePublicKey: publicKeyString(device),
  purpose: 'restore',
});
const issued2 = await issueSessionChallenge({
  identityPublicKey: publicKeyString(identity),
  devicePublicKey: publicKeyString(device),
  purpose: 'restore',
});
assert.notEqual(issued1.challenge, issued2.challenge);

console.log('sessionService.test.ts passed');
