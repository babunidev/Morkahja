import { recordAchievementUnlockedEvent } from '../../services/gameEventService.js';
import {
  loadAchievementProgress,
  saveAchievementProgress,
} from './achievementPersistence.js';
import {
  SPIRITGUIDE_ACHIEVEMENT_ID,
  spiritguideRankDefinition,
  spiritguideRankFromProgress,
} from './spiritguideAchievement.js';

/**
 * Grants a single Spiritguide progress point ("Gift of the Gods") to the soul-link
 * target. Lives in its own module so the daily-reward claim flow can award it without
 * importing the achievement engine (which would create a cycle).
 */
export async function awardSpiritguidePoint(
  playerId: string,
  timestamp = Date.now(),
): Promise<void> {
  const existing = await loadAchievementProgress(playerId, SPIRITGUIDE_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = spiritguideRankFromProgress(previousProgress);
  const nextProgress = previousProgress + 1;
  const nextRank = spiritguideRankFromProgress(nextProgress);

  await saveAchievementProgress({
    achievementId: SPIRITGUIDE_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  });

  if (nextRank > previousRank) {
    const rankDefinition = spiritguideRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: SPIRITGUIDE_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}
