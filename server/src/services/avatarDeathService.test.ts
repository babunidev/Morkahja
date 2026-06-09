import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import { savePlayerAvatar } from './playerService.js';
import { setPlayer } from '../db/postgresDocumentStore.js';
import {
  applyFailedDeathState,
  finalizeAvatarDeath,
  readAvatarLifeStatus,
  sacrificeFailedAvatar,
  sacrificeCostForLevel,
} from './avatarDeathService.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';

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

const session = await bootstrapSession({
  devicePublicKey: randomDeviceKey(),
  identityPublicKey: identityPublicJwk,
  playerName: `death-test-${Date.now()}`,
});

const avatarId = `death-avatar-${Date.now()}`;
const baseAvatar = await savePlayerAvatar(session.playerId, {
  id: avatarId,
  name: 'Death Tester',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

const failedAvatar = applyFailedDeathState(
  baseAvatar,
  baseAvatar.inventory,
  baseAvatar.progression,
);
await setPlayer(session.playerId, {
  currencies: { yellow_red_gem: sacrificeCostForLevel(failedAvatar.preDeathSnapshot!.level) + 5 },
}, { merge: true });
await saveAvatar(session.playerId, avatarId, failedAvatar);

const sacrificed = await sacrificeFailedAvatar(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(sacrificed.avatar), 'active');
assert.equal(sacrificed.spent, sacrificeCostForLevel(failedAvatar.preDeathSnapshot!.level));
assert.ok((sacrificed.currencies.yellow_red_gem ?? 0) >= 0);

const failedAgain = applyFailedDeathState(
  sacrificed.avatar,
  sacrificed.avatar.inventory,
  sacrificed.avatar.progression,
);
await saveAvatar(session.playerId, avatarId, failedAgain);

const deceased = await finalizeAvatarDeath(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(deceased), 'deceased');
assert.equal(deceased.preDeathSnapshot, undefined);

const stored = await loadAvatar(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(stored!), 'deceased');

console.log('avatarDeathService.test.ts passed');
