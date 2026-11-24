import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createRoom } from './roomService.js';
import { toEncounterRoomSnapshotDto } from './roomDtoMapper.js';
import { getProgression, pool, setPlayer, setProgression } from '../db/postgresDocumentStore.js';
import { savePlayerAvatar } from './playerService.js';

// The in-game avatar card read 0 encounters (Babuni, 2026-11-24): the room's
// avatar must carry the same count as the menu's card (`GET /avatars`).
const playerId = `room-stats-${randomUUID()}`;
const avatarId = `room-stats-avatar-${randomUUID()}`;
await setPlayer(playerId, {
  playerId, playerName: 'Room Stats Test', unlockedExpansions: [0],
  currencies: { yellow_red_gem: 0 },
});
await savePlayerAvatar(playerId, {
  id: avatarId, name: 'Counter', race: 'Rokur', role: 'Warrior',
  portrait: 'm_portrait_rokur_warrior', frame: 'm_frame_01', createdAt: Date.now(),
});
const room = await createRoom(playerId, avatarId);
const progression = await getProgression<Record<string, unknown>>(playerId, avatarId);
await setProgression(playerId, avatarId, { ...(progression ?? {}), encountersCompleted: 7 });

const dto = await toEncounterRoomSnapshotDto(room, playerId);
const local = dto.participants.find((participant) => participant.isLocal);
assert.equal(local?.avatar.encountersPlayed, 7);

await pool.end();
console.log('roomAvatarStats.test.ts passed');
