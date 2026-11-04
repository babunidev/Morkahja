import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

import {
  getAvatar,
  getPlayer,
  setAvatar,
  setPlayer,
  withDocumentTransaction,
} from '../db/postgresDocumentStore.js';
import { recordDailyEncounterPlayed } from '../domain/achievements/dailyRewardService.js';
import {
  addPlayerYellowRedGems,
  donatePlayerYellowRedGems,
} from '../services/playerService.js';
import { heartbeatSession, logoutSession, SessionError } from '../services/sessionService.js';
import { bootstrapTestSession } from './sessionAuthTestHelpers.js';
import type { PlayerDocument } from '../types/player.js';

const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicKey = JSON.stringify(identity.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(
  identity,
  identityPublicKey,
  `atomic-persistence-${randomUUID()}`,
);
const playerId = session.playerId;
const avatarId = `atomic-avatar-${randomUUID()}`;

// Independent top-level patches must all survive parallel UPSERTs.
const playerPatches = Array.from({ length: 32 }, (_, index) =>
  setPlayer(playerId, { [`atomicField${index}`]: index }, { merge: true }));
await Promise.all(playerPatches);
const patchedPlayer = await getPlayer<Record<string, unknown>>(playerId);
assert.ok(patchedPlayer);
for (let index = 0; index < 32; index += 1) {
  assert.equal(patchedPlayer[`atomicField${index}`], index);
}

// Avatar patches must be just as safe across concurrent writers.
await setAvatar(playerId, avatarId, { id: avatarId, progression: { experience: 0 } });
await Promise.all(Array.from({ length: 32 }, (_, index) =>
  setAvatar(playerId, avatarId, { [`avatarField${index}`]: index }, { merge: true }),
));
const patchedAvatar = await getAvatar<Record<string, unknown>>(playerId, avatarId);
assert.ok(patchedAvatar);
for (let index = 0; index < 32; index += 1) {
  assert.equal(patchedAvatar[`avatarField${index}`], index);
}

// A nested counter requires an explicit locked read-modify-write transaction.
await Promise.all(Array.from({ length: 24 }, () =>
  withDocumentTransaction(async (transaction) => {
    const avatar = await transaction.getAvatar<{ progression?: { experience?: number } }>(
      playerId,
      avatarId,
    );
    const experience = avatar?.progression?.experience ?? 0;
    await transaction.setAvatar(
      playerId,
      avatarId,
      { progression: { ...avatar?.progression, experience: experience + 1 } },
      { merge: true },
    );
  }),
));
const countedAvatar = await getAvatar<{ progression?: { experience?: number } }>(
  playerId,
  avatarId,
);
assert.equal(countedAvatar?.progression?.experience, 24);

// Encounter progress must not drop any simultaneous updates.
await Promise.all(Array.from({ length: 24 }, () => recordDailyEncounterPlayed(playerId)));
const afterEncounters = await getPlayer<PlayerDocument>(playerId);
assert.equal(afterEncounters?.dailyReward?.encountersPlayed, 24);

// Real currency flows and heartbeats contend for the same player record.
// All grants have unique claim keys and all donations are intentional.
await setPlayer(
  playerId,
  { currencies: { yellow_red_gem: 100 } },
  { merge: true },
);
const nonce = randomUUID();
const operations = [
  ...Array.from({ length: 12 }, (_, index) =>
    addPlayerYellowRedGems(playerId, 1, `atomic-test-${nonce}-${index}`)),
  ...Array.from({ length: 12 }, () => donatePlayerYellowRedGems(playerId, 1)),
  ...Array.from({ length: 8 }, () => heartbeatSession(session.accessToken)),
];
await Promise.all(operations);
const finalPlayer = await getPlayer<PlayerDocument>(playerId);
assert.equal(finalPlayer?.currencies?.yellow_red_gem, 100);
assert.equal(finalPlayer?.activeSessionId, session.sessionId);
assert.ok(typeof finalPlayer?.lastInteractionAt === 'number');
assert.equal(finalPlayer?.dailyReward?.encountersPlayed, 24);
assert.equal(
  Object.keys(finalPlayer?.loreGemClaims ?? {}).filter((key) => key.startsWith(`atomic-test-${nonce}-`)).length,
  12,
);

// Logout must clear session state without reverting currency or daily progress.
await logoutSession(session.accessToken);
const loggedOut = await getPlayer<PlayerDocument>(playerId);
assert.equal(loggedOut?.activeSessionId, null);
assert.equal(loggedOut?.currencies?.yellow_red_gem, 100);
assert.equal(loggedOut?.dailyReward?.encountersPlayed, 24);
await assert.rejects(
  heartbeatSession(session.accessToken),
  (error: unknown) => error instanceof SessionError && error.statusCode === 401,
);

console.log('atomicDocumentWrites.test.ts passed');
