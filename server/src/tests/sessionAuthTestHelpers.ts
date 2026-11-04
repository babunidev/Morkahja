import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import {
  bootstrapSession,
  issueSessionChallenge,
  type BootstrapSessionResult,
} from '../services/sessionService.js';

type TestKeyPair = { privateKey: KeyObject; publicKey: KeyObject };

/** Use real signatures in integration tests; unsigned bootstrap is forbidden. */
export async function bootstrapTestSession(
  identity: TestKeyPair,
  identityPublicKey: string,
  playerName: string,
): Promise<BootstrapSessionResult> {
  const device = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const devicePublicKey = JSON.stringify(device.publicKey.export({ format: 'jwk' }));
  const { challenge } = await issueSessionChallenge({
    devicePublicKey,
    identityPublicKey,
    purpose: 'register',
  });

  const signature = (privateKey: KeyObject): string => sign(
    'sha256',
    Buffer.from(challenge, 'utf8'),
    { key: privateKey, dsaEncoding: 'ieee-p1363' },
  ).toString('base64url');

  return bootstrapSession({
    devicePublicKey,
    identityPublicKey,
    playerName,
    purpose: 'register',
    signedIdentityChallenge: { challenge, signature: signature(identity.privateKey) },
    signedDeviceChallenge: { challenge, signature: signature(device.privateKey) },
  });
}
