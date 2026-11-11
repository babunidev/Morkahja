import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { createInitialProgression } from '../domain/avatar/AvatarProgression.js';
import { LEVEL_UP_ENCOUNTER_NUMERIC_ID } from '../domain/rooms/RoomSystemEvent.js';
import type { EncounterRoom } from '../domain/rooms/EncounterRoom.js';
import { getProgression, pool, setProgression } from '../db/postgresDocumentStore.js';
import { ensureAvatar } from './encounterGenerator.js';
import { persistInventory } from './inventoryService.js';
import { savePlayerAvatar } from './playerService.js';
import { loadEncounterRoom, saveEncounterRoom } from './roomPersistence.js';
import {
  createRoom,
  getActiveRoomForPlayer,
  leaveAllRoomsForPlayer,
  processRoomAway,
  submitChoice,
  submitContinue,
} from './roomService.js';
import { bootstrapTestSession } from '../tests/sessionAuthTestHelpers.js';

// Regression (found 2026-11-11): choosing in a level-up event and then leaving
// the solo adventure, or only going away (page reload, hidden tab), committed
// the event on the leave path but left the room on it. On return the player
// could play the same level-up event again and received its rewards twice.

async function readyForAction(roomId: string): Promise<void> {
  const room = await loadEncounterRoom(roomId);
  assert.ok(room);
  await saveEncounterRoom({
    ...room,
    activeEncounterSnapshot: { ...room.activeEncounterSnapshot, actionReadyAt: Date.now() - 1 },
    slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot) => ({
      ...snapshot,
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  });
}

async function levelUpResolutions(playerId: string): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM game_events
     WHERE player_id = $1 AND type = 'encounter_resolved' AND payload->>'encounterId' = $2`,
    [playerId, String(LEVEL_UP_ENCOUNTER_NUMERIC_ID)],
  );
  return Number(result.rows[0]?.n ?? 0);
}

/** A player whose next successful encounter levels them up, left in the level-up event with a choice made. */
async function playerInLevelUpEventWithChoiceMade(label: string): Promise<{ playerId: string; avatarId: string }> {
  const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = JSON.stringify(identity.publicKey.export({ format: 'jwk' }));
  const session = await bootstrapTestSession(identity, publicKey, `${label}-${randomUUID().slice(0, 8)}`);
  const avatarId = `avatar-slot-1-${randomUUID()}`;
  await savePlayerAvatar(session.playerId, {
    id: avatarId,
    name: label,
    race: 'Rokur',
    role: 'Warrior',
    portrait: 'avatar_29.webp',
    frame: 'frame_1.webp',
    createdAt: Date.now(),
  } as never);
  await ensureAvatar(session.playerId, avatarId, {
    id: avatarId,
    name: label,
    profile: { raceRewardType: 40, roleRewardType: 37 },
  } as never);
  await persistInventory(session.playerId, avatarId, {
    spellbook: [{ solutionId: 10001, solutionType: 1, uses: 2 }],
    items: [],
    essences: [{ solutionId: 10010, solutionType: 15, uses: 5 }],
  });
  await setProgression(session.playerId, avatarId, { ...createInitialProgression(), experience: 6 });

  // A normal encounter the player is sure to win with solution 10001, worth a level.
  let room = await createRoom(session.playerId, avatarId);
  const slotIndex = room.participants[0]!.slotIndex;
  room = {
    ...room,
    activeEncounterSnapshot: {
      ...room.activeEncounterSnapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      rollPrimaryA: 96,
      actionReadyAt: Date.now() - 1,
    },
    slotEncounterSnapshots: room.slotEncounterSnapshots.map((snapshot, index) => ({
      ...snapshot,
      encounterDifficulty: 2,
      primarySolutionA: 10001,
      secondarySolutionTypeA: 1,
      rollPrimaryA: index === slotIndex ? 96 : 50,
      rewardIds: [] as number[],
      actionReadyAt: Date.now() - 1,
    })) as EncounterRoom['slotEncounterSnapshots'],
    updatedAt: Date.now(),
  };
  await saveEncounterRoom(room);
  await submitChoice(session.playerId, avatarId, 'A');
  const levelUpRoom = await submitContinue(session.playerId, avatarId);
  assert.equal(levelUpRoom.roomState, 'system_event');
  assert.equal(levelUpRoom.systemEvent?.queue[0]?.encounterId, LEVEL_UP_ENCOUNTER_NUMERIC_ID);

  await readyForAction(levelUpRoom.roomId);
  await submitChoice(session.playerId, avatarId, 'dice');
  return { playerId: session.playerId, avatarId };
}

async function assertResolvedOnceAndMovedOn(
  player: { playerId: string; avatarId: string },
  how: string,
): Promise<void> {
  const progression = await getProgression<{ level: number; experience: number; pendingLevelUpRewards?: boolean }>(
    player.playerId,
    player.avatarId,
  );
  assert.equal(progression?.pendingLevelUpRewards, false, `${how}: level-up rewards are granted`);
  assert.equal(progression?.level, 2, `${how}: level stays 2`);
  assert.equal(progression?.experience, 2, `${how}: the level-up event adds no room XP bonus`);
  assert.equal(await levelUpResolutions(player.playerId), 1, `${how}: the level-up event resolves exactly once`);

  // Coming back: the room has moved past the event, which cannot be played again.
  const roomBack = (await getActiveRoomForPlayer(player.playerId, player.avatarId))
    ?? await createRoom(player.playerId, player.avatarId);
  assert.notEqual(roomBack.roomState, 'system_event', `${how}: no level-up event on return`);
  assert.equal(await levelUpResolutions(player.playerId), 1, `${how}: still exactly one resolution after return`);
}

const leaver = await playerInLevelUpEventWithChoiceMade('LevelUpLeaver');
await leaveAllRoomsForPlayer(leaver.playerId);
await assertResolvedOnceAndMovedOn(leaver, 'leaving the solo adventure');

const away = await playerInLevelUpEventWithChoiceMade('LevelUpAway');
await processRoomAway(away.playerId, away.avatarId);
await assertResolvedOnceAndMovedOn(away, 'going away (reload or hidden tab)');

for (const player of [leaver, away]) {
  await leaveAllRoomsForPlayer(player.playerId);
}

console.log('systemEventLeaveOnce.test.ts: all assertions passed');
process.exit(0);
