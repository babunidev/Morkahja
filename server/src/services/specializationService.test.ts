import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { AvatarDocument } from '../types/avatar.js';
import { getAvatar, getPlayer, setPlayer } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { readYellowRedGemBalance, savePlayerAvatar } from './playerService.js';
import { chooseAvatarSpecialization, SpecializationRequestError } from './specializationService.js';
import { toPersistedAvatarDto } from './avatarPresentation.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Specialization (D-056): the first choice is free, every change costs 1 gem,
// the same choice again costs nothing, and the gem and the change go together.
const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(identityKeyPair, identityPublicJwk, `specialization-${Date.now()}`);
const playerId = session.playerId;
const avatarId = `avatar-specialization-${Date.now()}`;

await savePlayerAvatar(playerId, {
  id: avatarId,
  name: 'Specialist',
  race: 'Verdani',
  role: 'Rogue',
  portrait: 'm_portrait_verdani_rogue',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await ensureAvatar(playerId, avatarId, {
  id: avatarId,
  name: 'Specialist',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);

async function gems(): Promise<number> {
  const player = await getPlayer<{ currencies?: Record<string, number> }>(playerId);
  return readYellowRedGemBalance(player?.currencies);
}
async function stored(): Promise<number | null | undefined> {
  return (await getAvatar<AvatarDocument>(playerId, avatarId))?.specialization;
}
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SpecializationRequestError);
    return error.code;
  }
  assert.fail('expected a refusal');
}

await setPlayer(playerId, { currencies: { yellow_red_gem: 1 } }, { merge: true });

// Unknown types are refused; Life (16) is not a specialization.
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 16)), 'UNKNOWN_SPECIALIZATION');
assert.equal(await refusal(chooseAvatarSpecialization(playerId, 'no-such-avatar', 35)), 'AVATAR_NOT_FOUND');

// First choice: free.
const first = await chooseAvatarSpecialization(playerId, avatarId, 35);
assert.equal(first.spent, 0);
assert.equal(await stored(), 35);
assert.equal(await gems(), 1);

// The same again: nothing changes, nothing is spent.
assert.equal((await chooseAvatarSpecialization(playerId, avatarId, 35)).spent, 0);
assert.equal(await gems(), 1);

// Two changes at the same moment with one gem: exactly one goes through.
const results = await Promise.allSettled([
  chooseAvatarSpecialization(playerId, avatarId, 9),
  chooseAvatarSpecialization(playerId, avatarId, 21),
]);
const fulfilled = results.filter((result) => result.status === 'fulfilled');
const rejected = results.filter((result) => result.status === 'rejected');
assert.equal(fulfilled.length, 1, 'one change is paid with the one gem');
assert.equal(rejected.length, 1);
assert.equal((rejected[0] as PromiseRejectedResult).reason.code, 'INSUFFICIENT_GEMS');
assert.equal(await gems(), 0);
const winner = (fulfilled[0] as PromiseFulfilledResult<{ specialization: number }>).value.specialization;
assert.equal(await stored(), winner);

// No gems left: a change is refused and the specialization stays.
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 5)), 'INSUFFICIENT_GEMS');
assert.equal(await stored(), winner);

// The avatar list carries it to the client.
const dto = toPersistedAvatarDto((await getAvatar<AvatarDocument>(playerId, avatarId))!);
assert.equal(dto?.specialization, winner);

console.log('specializationService.test.ts: all assertions passed');
