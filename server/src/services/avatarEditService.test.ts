import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import type { AvatarDocument } from '../types/avatar.js';
import { getAvatar, getPlayer, setPlayer } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { readYellowRedGemBalance, savePlayerAvatar } from './playerService.js';
import { AvatarEditRequestError, editAvatarLook } from './avatarEditService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Edit avatar (D-056): a portrait of the same race, role and gender, a frame
// and a name; only what changes is paid, and the gems and the change go together.
// Verdani Rogue female portraits: 10 and 11 cost 0, 384 costs 49, 385 costs 36.
// Frames: 1 and 2 cost 42, 3 costs 27. Portrait 25 is a Rokur.
const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
const session = await bootstrapTestSession(identityKeyPair, identityPublicJwk, `avatar-edit-${Date.now()}`);
const playerId = session.playerId;
const avatarId = `avatar-edit-${Date.now()}`;

await savePlayerAvatar(playerId, {
  id: avatarId,
  name: 'Lyra',
  race: 'Verdani',
  role: 'Rogue',
  portrait: 'avatar_10.webp',
  frame: 'frame_1.webp',
  createdAt: Date.now(),
});
await ensureAvatar(playerId, avatarId, {
  id: avatarId,
  name: 'Lyra',
  profile: { raceRewardType: 41, roleRewardType: 39 },
} as never);

async function gems(): Promise<number> {
  const player = await getPlayer<{ currencies?: Record<string, number> }>(playerId);
  return readYellowRedGemBalance(player?.currencies);
}
async function stored(): Promise<AvatarDocument> {
  return (await getAvatar<AvatarDocument>(playerId, avatarId))!;
}
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AvatarEditRequestError);
    return error.code;
  }
  assert.fail('expected a refusal');
}

await setPlayer(playerId, { currencies: { yellow_red_gem: 100 } }, { merge: true });

// Refusals change nothing.
assert.equal(await refusal(editAvatarLook(playerId, avatarId, { portraitId: 25, frameId: 1, name: 'Lyra' })), 'PORTRAIT_MISMATCH');
assert.equal(await refusal(editAvatarLook(playerId, avatarId, { portraitId: 999999, frameId: 1, name: 'Lyra' })), 'UNKNOWN_PORTRAIT');
assert.equal(await refusal(editAvatarLook(playerId, avatarId, { portraitId: 10, frameId: 999999, name: 'Lyra' })), 'UNKNOWN_FRAME');
assert.equal(await refusal(editAvatarLook(playerId, avatarId, { portraitId: 10, frameId: 1, name: '   ' })), 'NAME_REQUIRED');
assert.equal(await gems(), 100);

// Nothing changed: free.
assert.equal((await editAvatarLook(playerId, avatarId, { portraitId: 10, frameId: 1, name: ' Lyra ' })).spent, 0);

// A free portrait of the same kind: 0 gems, but it changes.
assert.equal((await editAvatarLook(playerId, avatarId, { portraitId: 11, frameId: 1, name: 'Lyra' })).spent, 0);
assert.equal((await stored()).portrait, 'avatar_11.webp');

// Portrait 385 (36) and frame 3 (27): 63, the name kept.
const look = await editAvatarLook(playerId, avatarId, { portraitId: 385, frameId: 3, name: 'Lyra' });
assert.equal(look.spent, 63);
assert.equal(await gems(), 37);
assert.equal((await stored()).frame, 'frame_3.webp');

// Not enough for a new name (50): refused, name kept.
assert.equal(await refusal(editAvatarLook(playerId, avatarId, { portraitId: 385, frameId: 3, name: 'Lyriel' })), 'INSUFFICIENT_GEMS');
assert.equal((await stored()).name, 'Lyra');

// Two renames at once with gems for one: exactly one goes through.
await setPlayer(playerId, { currencies: { yellow_red_gem: 60 } }, { merge: true });
const results = await Promise.allSettled([
  editAvatarLook(playerId, avatarId, { portraitId: 385, frameId: 3, name: 'Lyriel' }),
  editAvatarLook(playerId, avatarId, { portraitId: 385, frameId: 3, name: 'Lysandra' }),
]);
const fulfilled = results.filter((result) => result.status === 'fulfilled');
assert.equal(fulfilled.length, 1, 'one rename is paid with the 60 gems');
assert.equal(await gems(), 10);
const winner = (fulfilled[0] as PromiseFulfilledResult<{ avatar: AvatarDocument }>).value.avatar.name;
assert.equal((await stored()).name, winner);
const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
assert.equal(rejected.reason.code, 'INSUFFICIENT_GEMS');

console.log('avatarEditService.test.ts: all assertions passed');
