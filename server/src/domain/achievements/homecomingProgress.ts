import {
  getAvatar,
  getPlayer,
  getProgression,
  pool,
  withDocumentTransaction,
} from '../../db/postgresDocumentStore.js';
import { recordAchievementUnlockedEvent } from '../../services/gameEventService.js';
import { getExpansions } from '../../services/gameData.js';
import { grantPlayerExpansion } from '../../services/playerService.js';
import type { PlayerDocument } from '../../types/player.js';
import { loadAchievementProgress, saveAchievementProgress } from './achievementPersistence.js';
import {
  HOMECOMING_ACHIEVEMENT_ID,
  HOMECOMING_ENCOUNTERS_REQUIRED,
  homecomingRankDefinition,
  homecomingRankFromProgress,
} from './homecomingAchievement.js';

/** The homeland expansion of a race, from the catalog's `mExtensioHomelandOf`. */
export function homelandForRace(race: unknown): number | null {
  if (typeof race !== 'string') {
    return null;
  }
  return getExpansions().find((entry) => entry.mExtensioHomelandOf?.includes(race))?.mExtensioID ?? null;
}

/** Keeps the achievement's progress equal to the homelands the account earned. */
async function syncHomecomingProgress(playerId: string, earned: readonly number[], timestamp: number): Promise<void> {
  const existing = await loadAchievementProgress(playerId, HOMECOMING_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  if (earned.length <= previousProgress) {
    return;
  }
  const previousRank = homecomingRankFromProgress(previousProgress);
  const nextRank = homecomingRankFromProgress(earned.length);
  await saveAchievementProgress({
    achievementId: HOMECOMING_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: earned.length,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  });
  if (nextRank > previousRank) {
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: HOMECOMING_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: homecomingRankDefinition(nextRank)?.title ?? `Rank ${nextRank}`,
    });
  }
}

/**
 * Called after an avatar's encounter: once it has played 100, its people's
 * homeland joins the account's expansions, and Homecoming counts it. Earning
 * is recorded on the player (`homecoming`) under the row lock, so parallel
 * rounds count a homeland once. Returns the homeland newly earned, if any.
 */
export async function tryEarnHomeland(
  playerId: string,
  avatarId: string,
  timestamp = Date.now(),
): Promise<number | null> {
  const progression = await getProgression<{ encountersCompleted?: number }>(playerId, avatarId);
  if ((progression?.encountersCompleted ?? 0) < HOMECOMING_ENCOUNTERS_REQUIRED) {
    return null;
  }
  const avatar = await getAvatar<{ race?: string }>(playerId, avatarId);
  const homeland = homelandForRace(avatar?.race);
  if (homeland === null) {
    return null;
  }

  const result = await withDocumentTransaction(async (transaction) => {
    const player = await transaction.getPlayer<Partial<PlayerDocument>>(playerId);
    if (!player) {
      return null;
    }
    const earned = Array.isArray(player.homecoming) ? player.homecoming : [];
    if (earned.includes(homeland)) {
      return { earned, added: false };
    }
    const next = [...earned, homeland].sort((left, right) => left - right);
    await grantPlayerExpansion(playerId, homeland, transaction);
    await transaction.setPlayer(playerId, { homecoming: next, updatedAt: timestamp }, { merge: true });
    return { earned: next, added: true };
  });
  if (!result) {
    return null;
  }
  await syncHomecomingProgress(playerId, result.earned, timestamp);
  return result.added ? homeland : null;
}

/**
 * At start-up: every avatar that already has 100 encounters earns its
 * homeland (Babuni: existing players count too). Returns how many were new.
 */
export async function syncHomecomingForAllAvatars(timestamp = Date.now()): Promise<number> {
  // Any store read creates missing tables first (ensureSchema), so the query below cannot fail on a fresh database.
  await getPlayer('homecoming-schema-check');
  const result = await pool.query<{ player_id: string; avatar_id: string }>(
    `SELECT p.player_id, p.avatar_id FROM progressions p
     WHERE p.id = 'current'
       AND COALESCE((p.data->>'encountersCompleted')::int, 0) >= $1`,
    [HOMECOMING_ENCOUNTERS_REQUIRED],
  );
  let added = 0;
  for (const row of result.rows) {
    if (await tryEarnHomeland(row.player_id, row.avatar_id, timestamp) !== null) {
      added += 1;
    }
  }
  return added;
}

export interface HomecomingState {
  /** Homelands the account has earned. */
  earned: number;
  /** The most encounters of an avatar whose homeland is not earned yet, up to 100. */
  towardNext: number;
}

/**
 * What the achievement panel shows (Babuni, 2026-11-26): from the first
 * encounter on, how far the account's best avatar has come toward the next
 * homeland it can open.
 */
export async function loadHomecomingState(playerId: string): Promise<HomecomingState> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const earnedIds = Array.isArray(player?.homecoming) ? player.homecoming : [];
  const rows = await pool.query<{ race: string | null; encounters: number | null }>(
    `SELECT a.data->>'race' AS race, (p.data->>'encountersCompleted')::int AS encounters
     FROM progressions p JOIN avatars a ON a.player_id = p.player_id AND a.id = p.avatar_id
     WHERE p.player_id = $1 AND p.id = 'current'`,
    [playerId],
  );
  let towardNext = 0;
  for (const row of rows.rows) {
    const homeland = homelandForRace(row.race);
    if (homeland !== null && !earnedIds.includes(homeland)) {
      towardNext = Math.max(towardNext, Math.min(HOMECOMING_ENCOUNTERS_REQUIRED, row.encounters ?? 0));
    }
  }
  return { earned: earnedIds.length, towardNext };
}
