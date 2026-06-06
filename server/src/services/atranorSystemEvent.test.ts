import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { bootstrapSession } from './sessionService.js';
import { submitChoice, submitContinue } from './roomService.js';
import { savePlayerAvatar } from './playerService.js';
import { loadInventory } from './inventoryService.js';
import type { AvatarInventory } from '../types/avatar.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import {
  DEATH_ENCOUNTER_NUMERIC_ID,
} from '../domain/rooms/RoomSystemEvent.js';
import { createRoom } from './roomService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import { ensureAvatar } from './encounterGenerator.js';

function randomDeviceKey(): string {
  return `device-atranor-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function totalEssenceUses(inventory: AvatarInventory): number {
  return inventory.essences.reduce((total, item) => total + item.uses, 0);
}

function totalInventoryUses(inventory: AvatarInventory): number {
  return [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ].reduce((total, item) => total + item.uses, 0);
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
  playerName: `atranor-test-${Date.now()}`,
});

const actorAvatarId = `avatar-actor-${Date.now()}`;
const witnessAvatarId = `avatar-witness-${Date.now()}`;

await savePlayerAvatar(session.playerId, {
  id: actorAvatarId,
  name: 'Atranor Actor',
  race: 'Rokur',
  role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});
await savePlayerAvatar(session.playerId, {
  id: witnessAvatarId,
  name: 'Atranor Witness',
  race: 'Verdani',
  role: 'Mage',
  portrait: 'm_portrait_verdani_mage',
  frame: 'm_frame_01',
  createdAt: Date.now(),
});

await ensureAvatar(session.playerId, actorAvatarId, {
  id: actorAvatarId,
  name: 'Atranor Actor',
  profile: { raceRewardType: 40, roleRewardType: 37 },
} as never);
await ensureAvatar(session.playerId, witnessAvatarId, {
  id: witnessAvatarId,
  name: 'Atranor Witness',
  profile: { raceRewardType: 41, roleRewardType: 38 },
} as never);

const actorInventoryBefore = await loadInventory(session.playerId, actorAvatarId);
const witnessInventoryBefore = await loadInventory(session.playerId, witnessAvatarId);
const actorEssenceBefore = totalEssenceUses(actorInventoryBefore);
const witnessEssenceBefore = totalEssenceUses(witnessInventoryBefore);
const witnessTotalBefore = totalInventoryUses(witnessInventoryBefore);

let room = await createRoom(session.playerId, actorAvatarId);
room = {
  ...room,
  activeEncounterSnapshot: {
    ...room.activeEncounterSnapshot,
    actionReadyAt: Date.now() - 1,
  },
  slotEncounterSnapshots: room.slotEncounterSnapshots?.map((snapshot, slotIndex) => ({
    ...snapshot,
    encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    rollE: slotIndex === room.participants[0]!.slotIndex ? 96 : 50,
  })) as EncounterRoom['slotEncounterSnapshots'],
  participants: [
    {
      ...room.participants[0]!,
      choiceState: 'choosing',
    },
    {
      playerId: session.playerId,
      avatarId: witnessAvatarId,
      slotIndex: 1,
      joinedAt: Date.now(),
      choiceState: 'witnessing',
      focusState: 'none',
      continuePressed: false,
      lastInteractionAt: Date.now(),
    },
  ],
  roomState: 'system_event',
  systemEvent: {
    queue: [{
      actorPlayerId: session.playerId,
      encounterId: DEATH_ENCOUNTER_NUMERIC_ID,
    }],
    queueIndex: 0,
    lineage: {
      originEncounterId: room.activeEncounterSnapshot.encounterId,
      originEncounterFollow: room.activeEncounterSnapshot.encounterFollow,
      originRollOutcome: 'Misery',
      originSuccess: false,
    },
  },
  updatedAt: Date.now(),
};
await saveEncounterRoom(room);

const afterRoll = await submitChoice(session.playerId, actorAvatarId, 'dice');
assert.equal(afterRoll.roomState, 'system_event');
const actorAfterRoll = afterRoll.participants.find((entry) => entry.avatarId === actorAvatarId);
assert.equal(actorAfterRoll?.choiceState, 'ready_to_continue');
assert.equal(actorAfterRoll?.preparedResult?.success, true);
assert.equal(actorAfterRoll?.preparedResult?.rewards.length, 1);

const afterContinue = await submitContinue(session.playerId, actorAvatarId);
assert.equal(afterContinue.roomState, 'waiting_continue');
assert.equal(afterContinue.systemEvent?.lastEvent?.kind, 'atranor');
assert.equal(afterContinue.systemEvent?.lastEvent?.actorPlayerId, session.playerId);

const actorInventoryAfter = await loadInventory(session.playerId, actorAvatarId);
const witnessInventoryAfter = await loadInventory(session.playerId, witnessAvatarId);

assert.equal(
  totalEssenceUses(actorInventoryAfter),
  actorEssenceBefore + 3,
  'actor should gain 3 essence uses on Atranor Prosperity survival',
);
assert.equal(
  totalInventoryUses(witnessInventoryAfter),
  witnessTotalBefore,
  'witness inventory must not change when actor resolves Atranor',
);
assert.equal(
  totalEssenceUses(witnessInventoryAfter),
  witnessEssenceBefore,
  'witness essence must not change when actor resolves Atranor',
);

assert.equal(
  afterContinue.participants.find((entry) => entry.avatarId === actorAvatarId)?.preparedCommit,
  undefined,
  'actor preparedCommit must be cleared after system-event resolve',
);

console.log('atranorSystemEvent.test.ts: all assertions passed');
