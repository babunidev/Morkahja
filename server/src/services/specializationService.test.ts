import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { AvatarDocument } from '../types/avatar.js';
import { getAvatar, getPlayer, setAvatar, setInventory, setPlayer } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { readYellowRedGemBalance, savePlayerAvatar } from './playerService.js';
import { chooseAvatarSpecialization, SpecializationRequestError, syncSpecializationProgressForAllAvatars } from './specializationService.js';
import { toPersistedAvatarDto } from './avatarPresentation.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Specialization (D-056): the first choice is free, every change costs 1 gem,
// the same choice again costs nothing, and the gem and the change go together.
// Since 2026-11-26 (Babuni): only a type of skill the avatar holds can be
// chosen, and each type it holds for the first time gives a free change.
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

// Skills: Stealth 10065, Combat 10034, Heal 10033; Find 10003 has no charge left.
const skill = (solutionId: number, uses = 1) => ({ solutionId, uses });
async function holdSkills(...spellbook: Array<{ solutionId: number; uses: number }>): Promise<void> {
  const inventory = { spellbook, items: [], essences: [] };
  await setInventory(playerId, avatarId, inventory as never);
  await setAvatar(playerId, avatarId, { inventory } as never, { merge: true });
}
async function freeChanges(): Promise<number | undefined> {
  return toPersistedAvatarDto((await getAvatar<AvatarDocument>(playerId, avatarId))!)?.specializationFreeChanges;
}

await holdSkills(skill(10065), skill(10034), skill(10033), skill(10003, 0));
// A new avatar records its starting types; here the record is reset to what it holds now.
await setAvatar(playerId, avatarId, { specializationTypesSeen: [35, 9, 21], specializationFreeChanges: 0 } as never, { merge: true });
await setPlayer(playerId, { currencies: { yellow_red_gem: 1 } }, { merge: true });

// Unknown types are refused; Life (16) is not a specialization.
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 16)), 'UNKNOWN_SPECIALIZATION');
assert.equal(await refusal(chooseAvatarSpecialization(playerId, 'no-such-avatar', 35)), 'AVATAR_NOT_FOUND');
// Only types it holds: no Climb skill, and the Find skill has no charge.
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 13)), 'SPECIALIZATION_NOT_HELD');
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 5)), 'SPECIALIZATION_NOT_HELD');

// First choice: free, and no free change is used for it.
const first = await chooseAvatarSpecialization(playerId, avatarId, 35);
assert.equal(first.spent, 0);
assert.equal(first.freeChanges, 0);
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

// No gems and no free change: a change is refused and the specialization stays.
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 35)), 'INSUFFICIENT_GEMS');
assert.equal(await stored(), winner);

// Two new types (Climb, Speech) and the Find skill charged again (also new): three free changes.
await holdSkills(skill(10065), skill(10034), skill(10033), skill(10003), skill(10042), skill(10043));
assert.equal(await freeChanges(), 3, 'one free change per new type, shown before it is used');
const climb = await chooseAvatarSpecialization(playerId, avatarId, 13);
assert.equal(climb.spent, 0, 'a free change, not a gem');
assert.equal(climb.freeChanges, 2);
assert.equal(await stored(), 13);
assert.equal(await freeChanges(), 2, 'the new types are counted once');

// A type lost and found again gives no second free change.
await holdSkills(skill(10065), skill(10034), skill(10033), skill(10042), skill(10043));
await holdSkills(skill(10065), skill(10034), skill(10033), skill(10003), skill(10042), skill(10043));
assert.equal(await freeChanges(), 2);

// The free changes are used one by one, then gems are needed again.
assert.equal((await chooseAvatarSpecialization(playerId, avatarId, 17)).freeChanges, 1);
assert.equal((await chooseAvatarSpecialization(playerId, avatarId, 5)).freeChanges, 0);
assert.equal(await refusal(chooseAvatarSpecialization(playerId, avatarId, 9)), 'INSUFFICIENT_GEMS');

// Its current one stays even when no skill of it is left.
await holdSkills(skill(10065));
assert.equal(await stored(), 5);

// The avatar list carries it to the client.
const dto = toPersistedAvatarDto((await getAvatar<AvatarDocument>(playerId, avatarId))!);
assert.equal(dto?.specialization, 5);

// An avatar without a record gets one at start-up from what it holds, and no free change for it.
await setAvatar(playerId, avatarId, { specializationTypesSeen: null } as never, { merge: true });
const unrecorded = await getAvatar<Record<string, unknown>>(playerId, avatarId);
delete unrecorded!.specializationTypesSeen;
await setAvatar(playerId, avatarId, unrecorded as never);
assert.ok(await syncSpecializationProgressForAllAvatars() >= 1);
assert.deepEqual((await getAvatar<AvatarDocument>(playerId, avatarId))?.specializationTypesSeen, [35]);
assert.equal(await freeChanges(), 0);

// A new avatar records the types of its starting skills.
const newcomerId = `${avatarId}-new`;
const newcomer = await savePlayerAvatar(playerId, {
  id: newcomerId,
  name: 'Newcomer',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
assert.ok(Array.isArray(newcomer.specializationTypesSeen));
assert.equal(newcomer.specializationFreeChanges, 0);
assert.equal(toPersistedAvatarDto(newcomer)?.specializationFreeChanges, 0);

console.log('specializationService.test.ts: all assertions passed');
