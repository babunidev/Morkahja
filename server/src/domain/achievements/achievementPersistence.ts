import { pool } from '../../db/postgresDocumentStore.js';
import {
  ADVENTURER_ACHIEVEMENT_ID,
  adventurerRankFromProgress,
} from './adventurerAchievement.js';
import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  alphaPlayerRankFromProgress,
} from './alphaPlayerAchievement.js';
import {
  CONTRIBUTOR_ACHIEVEMENT_ID,
  contributorRankFromProgress,
} from './contributorAchievement.js';
import {
  BLESSED_ACHIEVEMENT_ID,
  blessedRankFromProgress,
} from './blessedAchievement.js';
import {
  decodeFirestarterProgress,
  FIRESTARTER_ACHIEVEMENT_ID,
  firestarterRankFromState,
} from './firestarterAchievement.js';
import {
  encounterSolveRankFromProgress,
  getEncounterSolveAchievementById,
} from './encounterSolveAchievements.js';
import type { AchievementProgress } from './achievementProgress.js';

export function achievementRankFromProgress(achievementId: string, progress: number): number {
  if (achievementId === ADVENTURER_ACHIEVEMENT_ID) {
    return adventurerRankFromProgress(progress);
  }

  if (achievementId === ALPHA_PLAYER_ACHIEVEMENT_ID) {
    return alphaPlayerRankFromProgress(progress);
  }

  if (achievementId === CONTRIBUTOR_ACHIEVEMENT_ID) {
    return contributorRankFromProgress(progress);
  }

  if (achievementId === BLESSED_ACHIEVEMENT_ID) {
    return blessedRankFromProgress(progress);
  }

  if (achievementId === FIRESTARTER_ACHIEVEMENT_ID) {
    const { peakAvatarCount, peakTotalLevels } = decodeFirestarterProgress(progress);
    return firestarterRankFromState(peakAvatarCount, peakTotalLevels);
  }

  const encounterSolve = getEncounterSolveAchievementById(achievementId);
  if (encounterSolve) {
    return encounterSolveRankFromProgress(encounterSolve, progress);
  }

  return 0;
}

/** Re-apply rank thresholds to stored progress (e.g. after threshold changes). */
export async function reconcileAchievementProgress(
  record: AchievementProgress,
): Promise<AchievementProgress> {
  const derivedRank = achievementRankFromProgress(record.achievementId, record.progress);
  const rank = record.achievementId === FIRESTARTER_ACHIEVEMENT_ID
    ? Math.max(record.rank, derivedRank)
    : derivedRank;

  if (record.rank === rank) {
    return record;
  }

  const updated: AchievementProgress = {
    ...record,
    rank,
    updatedAt: Date.now(),
  };

  await saveAchievementProgress(updated);
  return updated;
}

let schemaReady: Promise<void> | null = null;

export async function ensurePlayerAchievementsReady(): Promise<void> {
  schemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS player_achievements (
      player_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      rank INTEGER NOT NULL DEFAULT 0,
      progress INTEGER NOT NULL DEFAULT 0,
      unlocked_at BIGINT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (player_id, achievement_id)
    );

    CREATE INDEX IF NOT EXISTS player_achievements_player_id_idx
      ON player_achievements (player_id);
  `).then(() => undefined);

  await schemaReady;
}

function rowToAchievementProgress(row: {
  player_id: string;
  achievement_id: string;
  rank: number;
  progress: number;
  unlocked_at: string | null;
  updated_at: string;
}): AchievementProgress {
  return {
    achievementId: row.achievement_id,
    playerId: row.player_id,
    rank: Number(row.rank),
    progress: Number(row.progress),
    unlockedAt: row.unlocked_at === null ? undefined : Number(row.unlocked_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function loadAllAchievementProgressForPlayer(
  playerId: string,
): Promise<AchievementProgress[]> {
  await ensurePlayerAchievementsReady();

  const result = await pool.query<{
    player_id: string;
    achievement_id: string;
    rank: number;
    progress: number;
    unlocked_at: string | null;
    updated_at: string;
  }>(
    `SELECT player_id, achievement_id, rank, progress, unlocked_at, updated_at
     FROM player_achievements
     WHERE player_id = $1`,
    [playerId],
  );

  return result.rows.map(rowToAchievementProgress);
}

export async function loadAchievementProgress(
  playerId: string,
  achievementId: string,
): Promise<AchievementProgress | null> {
  await ensurePlayerAchievementsReady();

  const result = await pool.query<{
    player_id: string;
    achievement_id: string;
    rank: number;
    progress: number;
    unlocked_at: string | null;
    updated_at: string;
  }>(
    `SELECT player_id, achievement_id, rank, progress, unlocked_at, updated_at
     FROM player_achievements
     WHERE player_id = $1 AND achievement_id = $2`,
    [playerId, achievementId],
  );

  const row = result.rows[0];
  return row ? rowToAchievementProgress(row) : null;
}

export async function saveAchievementProgress(progress: AchievementProgress): Promise<void> {
  await ensurePlayerAchievementsReady();

  await pool.query(
    `INSERT INTO player_achievements (
      player_id,
      achievement_id,
      rank,
      progress,
      unlocked_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (player_id, achievement_id) DO UPDATE SET
      rank = EXCLUDED.rank,
      progress = EXCLUDED.progress,
      unlocked_at = COALESCE(player_achievements.unlocked_at, EXCLUDED.unlocked_at),
      updated_at = EXCLUDED.updated_at`,
    [
      progress.playerId,
      progress.achievementId,
      progress.rank,
      progress.progress,
      progress.unlockedAt ?? null,
      progress.updatedAt,
    ],
  );
}
