import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';
import { getPlayer, setPlayer, setProgression } from '../db/postgresDocumentStore.js';
import { loadAvatarProgression } from './avatarProgressionService.js';
import { readYellowRedGemBalance, savePlayerAvatar } from './playerService.js';
import { saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  getActiveRoomForPlayer,
  joinRoom,
  leaveAllRoomsForPlayer,
  RoomError,
  submitChoice,
  travelStatus,
  travelToExpansion,
} from './roomService.js';
import { DEATH_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';

// Travel (D-056): the base game costs 1 gem, an expansion a tenth of its price
// (Everwinter 1003: 50 → 5). The encounter is swapped before anyone chooses;
// a host takes the room along, a guest leaves and goes on alone.
async function bootstrapPlayer(prefix: string) {
  const identityKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const identityPublicJwk = JSON.stringify(identityKeyPair.publicKey.export({ format: 'jwk' }));
  return bootstrapTestSession(identityKeyPair, identityPublicJwk, `${prefix}-${Date.now()}`);
}
async function newAvatar(playerId: string, id: string): Promise<void> {
  await savePlayerAvatar(playerId, {
    id, name: 'Traveller', race: 'Aevis', role: 'Mage',
    portrait: 'avatar_200.webp', frame: 'frame_1.webp', createdAt: Date.now(),
  });
}
async function gems(playerId: string): Promise<number> {
  return readYellowRedGemBalance((await getPlayer<{ currencies?: Record<string, number> }>(playerId))?.currencies);
}
/** Play n encounters, as far as the travel wait is concerned. */
async function playEncounters(playerId: string, avatarId: string, n: number): Promise<void> {
  const progression = await loadAvatarProgression(playerId, avatarId);
  await setProgression(playerId, avatarId, { ...progression, encountersCompleted: progression.encountersCompleted + n } as never);
}
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof RoomError, String(error));
    return error.code ?? error.message;
  }
  assert.fail('expected a refusal');
}

const host = await bootstrapPlayer('travel-host');
const hostAvatar = `avatar-travel-host-${Date.now()}`;
await newAvatar(host.playerId, hostAvatar);

// Not in the game yet.
await setPlayer(host.playerId, { currencies: { yellow_red_gem: 1 } }, { merge: true });
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 0)), 'NOT_IN_GAME');

let room = await createRoom(host.playerId, hostAvatar);
const before = room.activeEncounterSnapshot.encounterId;

// Locked and unknown destinations.
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 1003)), 'REGION_LOCKED');
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 1002)), 'UNKNOWN_DESTINATION');
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 4242)), 'UNKNOWN_DESTINATION');

// Two trips at once with one gem: exactly one goes through.
const both = await Promise.allSettled([
  travelToExpansion(host.playerId, hostAvatar, 0),
  travelToExpansion(host.playerId, hostAvatar, 0),
]);
assert.equal(both.filter((entry) => entry.status === 'fulfilled').length, 1, 'one trip for one gem');
// The second is refused for the wait after a trip (or the gems, whichever it meets first).
assert.ok(['TRAVEL_COOLDOWN', 'INSUFFICIENT_GEMS'].includes(((both.find((entry) => entry.status === 'rejected') as PromiseRejectedResult).reason as RoomError).code ?? ''));
assert.equal(await gems(host.playerId), 0);
room = (await getActiveRoomForPlayer(host.playerId, hostAvatar))!;
assert.notEqual(room.activeEncounterSnapshot.encounterId, before, 'a new encounter, not the one left');
assert.equal(room.activeEncounterSnapshot.encounterExpansion, 0);
assert.ok(room.participants.every((participant) => participant.choiceState === 'choosing'));

// Three encounters must be played before the next trip (Babuni, 2026-11-24).
await setPlayer(host.playerId, { currencies: { yellow_red_gem: 7 }, unlockedExpansions: [0, 1003] }, { merge: true });
assert.equal((await travelStatus(host.playerId, hostAvatar)).encountersUntilTravel, 3);
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 1003)), 'TRAVEL_COOLDOWN');
await playEncounters(host.playerId, hostAvatar, 2);
assert.equal((await travelStatus(host.playerId, hostAvatar)).encountersUntilTravel, 1);
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 1003)), 'TRAVEL_COOLDOWN');
await playEncounters(host.playerId, hostAvatar, 1);
assert.equal((await travelStatus(host.playerId, hostAvatar)).encountersUntilTravel, 0);
assert.equal(await gems(host.playerId), 7, 'refused trips cost nothing');

// Everwinter, once unlocked: 5 gems, an Everwinter encounter.
const everwinter = await travelToExpansion(host.playerId, hostAvatar, 1003);
assert.equal(everwinter.spent, 5);
assert.equal(await gems(host.playerId), 2);
assert.equal(everwinter.room.activeEncounterSnapshot.encounterExpansion, 1003);

// After a choice the outcome is known: no travel.
await playEncounters(host.playerId, hostAvatar, 3);
room = (await getActiveRoomForPlayer(host.playerId, hostAvatar))!;
await saveEncounterRoom({
  ...room,
  activeEncounterSnapshot: { ...room.activeEncounterSnapshot, actionReadyAt: Date.now() - 1 },
  slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot) => ({ ...snapshot, actionReadyAt: Date.now() - 1 })) as typeof room.slotEncounterSnapshots,
  updatedAt: Date.now(),
});
await submitChoice(host.playerId, hostAvatar, 'dice');
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 0)), 'TRAVEL_AFTER_CHOICE');
assert.equal(await gems(host.playerId), 2, 'a refused trip costs nothing');

// Not from Atranor. (A solo room only pauses when left, so a second avatar
// opens a fresh one for the rest.)
room = (await getActiveRoomForPlayer(host.playerId, hostAvatar))!;
await saveEncounterRoom({
  ...room,
  roomState: 'active_encounter',
  participants: room.participants.map((participant) => ({ ...participant, choiceState: 'choosing', selectedAction: undefined })),
  activeEncounterSnapshot: { ...room.activeEncounterSnapshot, encounterId: DEATH_ENCOUNTER_NUMERIC_ID },
  updatedAt: Date.now(),
});
assert.equal(await refusal(travelToExpansion(host.playerId, hostAvatar, 0)), 'TRAVEL_DURING_EVENT');

// A host takes the room along; a guest leaves it and goes on alone.
const partyAvatar = `avatar-travel-party-${Date.now()}`;
await newAvatar(host.playerId, partyAvatar);
await leaveAllRoomsForPlayer(host.playerId);
room = await createRoom(host.playerId, partyAvatar);
const guest = await bootstrapPlayer('travel-guest');
const guestAvatar = `avatar-travel-guest-${Date.now()}`;
await newAvatar(guest.playerId, guestAvatar);
room = await joinRoom(guest.playerId, guestAvatar, room.roomId);
assert.equal(room.participants.length, 2);

await setPlayer(host.playerId, { currencies: { yellow_red_gem: 1 } }, { merge: true });
const together = await travelToExpansion(host.playerId, partyAvatar, 0);
assert.equal(together.room.roomId, room.roomId, 'the host travels with the room');
assert.equal(together.room.participants.length, 2, 'the guest came along');

await setPlayer(guest.playerId, { currencies: { yellow_red_gem: 1 } }, { merge: true });
const alone = await travelToExpansion(guest.playerId, guestAvatar, 0);
assert.notEqual(alone.room.roomId, room.roomId, 'the guest left for a room of their own');
assert.equal(alone.room.participants.length, 1);
assert.equal(alone.room.leaderPlayerId, guest.playerId);
assert.equal(await gems(guest.playerId), 0);
const hostRoom = (await getActiveRoomForPlayer(host.playerId, partyAvatar))!;
assert.equal(hostRoom.participants.length, 1, 'the host stays, without the guest');

await leaveAllRoomsForPlayer(host.playerId);
await leaveAllRoomsForPlayer(guest.playerId);
console.log('roomTravel.test.ts: all assertions passed');
