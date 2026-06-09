import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import { savePlayerAvatar, loadPlayer } from './playerService.js';
import { setPlayer, setSoloRoomCheckpoint } from '../db/postgresDocumentStore.js';
import {
  applyFailedDeathState,
  finalizeAvatarDeath,
  readAvatarLifeStatus,
  sacrificeFailedAvatar,
  sacrificeCostForLevel,
} from './avatarDeathService.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';
import { createRoom, RoomError } from './roomService.js';
import {
  findActiveRoomIdForPlayerAvatar,
  saveEncounterRoom,
} from './roomPersistence.js';
import { checkpointFromRoom, loadSoloRoomCheckpoint } from './soloRoomCheckpointService.js';
import { DEATH_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';

function randomDeviceKey(): string {
  return `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function totalEssenceUses(inventory: { essences?: Array<{ uses?: number }> } | undefined): number {
  return (inventory?.essences ?? []).reduce((sum, entry) => sum + (entry.uses ?? 0), 0);
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

const preSacrificeUses = totalEssenceUses(failedAvatar.preDeathSnapshot!.inventory);
const sacrificed = await sacrificeFailedAvatar(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(sacrificed.avatar), 'active');
assert.equal(sacrificed.spent, sacrificeCostForLevel(failedAvatar.preDeathSnapshot!.level));
assert.ok((sacrificed.currencies.yellow_red_gem ?? 0) >= 0);
assert.ok(
  totalEssenceUses(sacrificed.avatar.inventory) >= preSacrificeUses + 2,
  'sacrifice should apply Fortune-tier essence reward',
);

await setPlayer(session.playerId, { activeAvatarId: avatarId }, { merge: true });
let deathRoom = await createRoom(session.playerId, avatarId);
const deathParticipant = deathRoom.participants[0]!;
deathRoom = {
  ...deathRoom,
  roomState: 'waiting_continue',
  activeEncounterSnapshot: {
    ...deathRoom.activeEncounterSnapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    encounterTitle: 'Atranor',
  },
  participants: [{
    ...deathParticipant,
    choiceState: 'resolved',
    continuePressed: true,
    resolutionSummary: {
      success: false,
      message: 'Atranor claims this life',
      rewards: [],
      avatarDied: true,
      selectedRoll: 4,
    },
  }],
  updatedAt: Date.now(),
};
await saveEncounterRoom(deathRoom);
const checkpoint = checkpointFromRoom(deathRoom);
assert.ok(checkpoint);
await setSoloRoomCheckpoint(session.playerId, avatarId, checkpoint);

const failedForResume = applyFailedDeathState(
  sacrificed.avatar,
  sacrificed.avatar.inventory,
  sacrificed.avatar.progression,
);
await setPlayer(session.playerId, {
  currencies: { yellow_red_gem: sacrificeCostForLevel(failedForResume.preDeathSnapshot!.level) + 5 },
}, { merge: true });
await saveAvatar(session.playerId, avatarId, failedForResume);

const resumedSacrifice = await sacrificeFailedAvatar(session.playerId, avatarId);
assert.ok(resumedSacrifice.room, 'sacrifice should return an advanced room');
assert.equal(resumedSacrifice.room!.roomState, 'active_encounter');
assert.notEqual(
  resumedSacrifice.room!.activeEncounterSnapshot.encounterId,
  DEATH_ENCOUNTER_NUMERIC_ID,
);

const failedAgain = applyFailedDeathState(
  resumedSacrifice.avatar,
  resumedSacrifice.avatar.inventory,
  resumedSacrifice.avatar.progression,
);
await saveAvatar(session.playerId, avatarId, failedAgain);
await setPlayer(session.playerId, { activeAvatarId: avatarId }, { merge: true });

try {
  await createRoom(session.playerId, avatarId);
  assert.fail('expected failed avatar to be rejected from createRoom');
} catch (error) {
  assert.ok(error instanceof RoomError);
  assert.equal(error.code, 'AVATAR_FAILED');
}

assert.ok(await findActiveRoomIdForPlayerAvatar(session.playerId, avatarId));
assert.ok(await loadSoloRoomCheckpoint(session.playerId, avatarId));

const deceased = await finalizeAvatarDeath(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(deceased), 'deceased');
assert.equal(deceased.preDeathSnapshot, undefined);
assert.equal(await findActiveRoomIdForPlayerAvatar(session.playerId, avatarId), null);
assert.equal(await loadSoloRoomCheckpoint(session.playerId, avatarId), null);

const stored = await loadAvatar(session.playerId, avatarId);
assert.equal(readAvatarLifeStatus(stored!), 'deceased');

const playerAfter = await loadPlayer(session.playerId);
assert.notEqual(playerAfter?.activeAvatarId, avatarId);

try {
  await createRoom(session.playerId, avatarId);
  assert.fail('expected deceased avatar to be rejected from createRoom');
} catch (error) {
  assert.ok(error instanceof RoomError);
  assert.equal(error.code, 'AVATAR_DECEASED');
}

console.log('avatarDeathService.test.ts passed');
