import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { addPlayerFriend } from './friendService.js';
import { touchPlayerInteraction } from './playerInteractionService.js';
import { savePlayerAvatar } from './playerService.js';
import {
  broadcastCallForHelp,
  createRoom,
  leaveAllRoomsForPlayer,
  listPendingHelpInvitations,
  respondHelp,
} from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Call for help must reach players who are on the welcome screen, even when
// they left a solo adventure earlier: leaving only pauses that solo room, and
// the player stays listed as its participant. Players who are really playing
// must still not be invited.

async function newPlayer(label: string): Promise<{ playerId: string; avatarId: string }> {
  const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = JSON.stringify(identity.publicKey.export({ format: 'jwk' }));
  const session = await bootstrapTestSession(identity, publicKey, `${label}-${randomUUID().slice(0, 8)}`);
  const avatarId = `avatar-slot-1-${randomUUID()}`;
  await savePlayerAvatar(session.playerId, {
    id: avatarId,
    name: label,
    race: 'Verdani',
    role: 'Mage',
    portrait: 'avatar_16.webp',
    frame: 'frame_1.webp',
    createdAt: Date.now(),
  } as never);
  await touchPlayerInteraction(session.playerId);
  return { playerId: session.playerId, avatarId };
}

async function invitedBy(playerId: string, fromPlayerId: string): Promise<boolean> {
  const invitations = await listPendingHelpInvitations(playerId);
  return invitations.some((invite) => invite.fromPlayerId === fromPlayerId);
}

const caller = await newPlayer('HelpCaller');
const pausedSolo = await newPlayer('PausedSolo');
const playingSolo = await newPlayer('PlayingSolo');

// PausedSolo played alone and went back to the welcome screen.
await createRoom(pausedSolo.playerId, pausedSolo.avatarId);
await leaveAllRoomsForPlayer(pausedSolo.playerId);
await touchPlayerInteraction(pausedSolo.playerId);

// PlayingSolo is in the middle of its own adventure.
await createRoom(playingSolo.playerId, playingSolo.avatarId);
await touchPlayerInteraction(playingSolo.playerId);

await addPlayerFriend(caller.playerId, pausedSolo.playerId);
await addPlayerFriend(caller.playerId, playingSolo.playerId);
const callerRoom = await createRoom(caller.playerId, caller.avatarId);
await broadcastCallForHelp(caller.playerId, caller.avatarId);

assert.equal(
  await invitedBy(pausedSolo.playerId, caller.playerId),
  true,
  'a player whose only room is a paused solo adventure must receive Call for help',
);
assert.equal(
  await invitedBy(playingSolo.playerId, caller.playerId),
  false,
  'a player who is playing their own adventure must not receive Call for help',
);

// The helper joins; the caller leaves, so the helper is alone and its leave
// only pauses the room. It must be reachable by the next Call for help.
const invite = (await listPendingHelpInvitations(pausedSolo.playerId))
  .find((entry) => entry.fromPlayerId === caller.playerId);
assert.ok(invite);
const joined = await respondHelp(pausedSolo.playerId, invite.inviteId, true, pausedSolo.avatarId);
assert.equal(joined?.roomId, callerRoom.roomId);
await leaveAllRoomsForPlayer(caller.playerId);
await leaveAllRoomsForPlayer(pausedSolo.playerId);
await touchPlayerInteraction(pausedSolo.playerId);

const secondCaller = await newPlayer('SecondCaller');
await addPlayerFriend(secondCaller.playerId, pausedSolo.playerId);
await createRoom(secondCaller.playerId, secondCaller.avatarId);
await broadcastCallForHelp(secondCaller.playerId, secondCaller.avatarId);
assert.equal(
  await invitedBy(pausedSolo.playerId, secondCaller.playerId),
  true,
  'a helper left alone after the caller departed must be reachable again',
);

for (const player of [caller, pausedSolo, playingSolo, secondCaller]) {
  await leaveAllRoomsForPlayer(player.playerId);
}

console.log('helpInviteAvailability.test.ts: all assertions passed');
process.exit(0);
