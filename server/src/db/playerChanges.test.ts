import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { pool, setPlayer, setRoomInvitation, withDocumentTransaction } from './postgresDocumentStore.js';
import { appendGameEvent } from './gameEventPersistence.js';
import { playerChangeVersions, waitForPlayerChange } from './playerChanges.js';
import { saveAchievementProgress } from '../domain/achievements/achievementPersistence.js';

// A waiting GET /player/changes answers when something the dashboard shows
// changes, and stays asleep for bookkeeping writes (2026-11-27).
const playerId = `player-changes-${randomUUID().slice(0, 8)}`;
const otherId = `player-changes-other-${randomUUID().slice(0, 8)}`;

async function wakes(label: string, change: () => Promise<unknown>): Promise<void> {
  const since = playerChangeVersions(playerId);
  const started = Date.now();
  const waiting = waitForPlayerChange(playerId, since, 5_000);
  await change();
  await waiting;
  assert.ok(Date.now() - started < 1_000, `${label} wakes the waiter`);
}

async function staysQuiet(label: string, change: () => Promise<unknown>): Promise<void> {
  const since = playerChangeVersions(playerId);
  await change();
  assert.deepEqual(playerChangeVersions(playerId), since, `${label} wakes nobody`);
}

try {
  await wakes('saving the player', () => setPlayer(playerId, { name: 'Changes test' }));
  await staysQuiet('a quiet bookkeeping save', () =>
    setPlayer(playerId, { lastInteractionAt: Date.now() }, { merge: true, quiet: true }));

  // Inside a transaction: after COMMIT only; a rollback announces nothing.
  let committed = false;
  await wakes('a committed transaction', () => withDocumentTransaction(async (transaction) => {
    await transaction.setPlayer(playerId, { gems: 1 }, { merge: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    committed = true;
  }));
  assert.ok(committed);
  await staysQuiet('a rolled-back transaction', () => withDocumentTransaction(async (transaction) => {
    await transaction.setPlayer(playerId, { gems: 2 }, { merge: true });
    throw new Error('rollback');
  }).catch(() => undefined));

  // A help invitation wakes the player it is sent to.
  await wakes('a help invitation', () => setRoomInvitation(`invite-${randomUUID()}`, {
    inviteId: 'x',
    roomId: 'room-x',
    fromPlayerId: otherId,
    toPlayerId: playerId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    status: 'pending',
  }));

  // Achievements: a real change wakes, re-saving the same values does not
  // (reading achievements re-saves some of them).
  const achievement = {
    playerId,
    achievementId: 'adventurer',
    rank: 0,
    progress: 1,
    updatedAt: Date.now(),
  };
  await wakes('new achievement progress', () => saveAchievementProgress(achievement));
  await staysQuiet('re-saving the same progress', () =>
    saveAchievementProgress({ ...achievement, updatedAt: Date.now() + 1 }));
  await wakes('more achievement progress', () =>
    saveAchievementProgress({ ...achievement, progress: 2, updatedAt: Date.now() + 2 }));

  // A global event wakes everyone (feed); a private one only its player.
  const event = (visibility: 'global' | 'private', owner: string) => ({
    eventId: randomUUID(),
    timestamp: Date.now(),
    playerId: owner,
    type: 'achievement_unlocked',
    visibility,
    importance: 'normal',
    payload: {},
  });
  await wakes('a global event', () => appendGameEvent(event('global', otherId) as never));
  await wakes('a private event of the player', () => appendGameEvent(event('private', playerId) as never));
  await staysQuiet('a private event of someone else', () =>
    appendGameEvent(event('private', otherId) as never));

  // A change before the wait began answers at once; otherwise the timeout ends it.
  const before = playerChangeVersions(playerId);
  await setPlayer(playerId, { name: 'Changed again' });
  let started = Date.now();
  await waitForPlayerChange(playerId, before, 5_000);
  assert.ok(Date.now() - started < 50, 'an earlier change answers at once');
  started = Date.now();
  await waitForPlayerChange(playerId, playerChangeVersions(playerId), 200);
  assert.ok(Date.now() - started >= 190, 'without a change the wait lasts until the timeout');
} finally {
  await pool.query('DELETE FROM game_events WHERE player_id = ANY($1::text[])', [[playerId, otherId]]);
  await pool.query('DELETE FROM player_achievements WHERE player_id = $1', [playerId]);
  await pool.query(`DELETE FROM room_invitations WHERE data->>'toPlayerId' = $1`, [playerId]);
  await pool.query('DELETE FROM players WHERE id = $1', [playerId]);
  await pool.end();
}
console.log('playerChanges.test.ts passed');
