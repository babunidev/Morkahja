import { recordAchievementUnlockedEvent } from '../../services/gameEventService.js';
import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  alphaPlayerRankDefinition,
  alphaPlayerRankFromProgress,
} from './alphaPlayerAchievement.js';
import {
  isAlphaPlayerGloballyLocked,
  loadAlphaPlayerGlobalState,
  tryClaimAlphaPlayerRank4Slot,
} from './alphaPlayerGlobalLock.js';
import { loadAchievementProgress, saveAchievementProgress } from './achievementPersistence.js';

/**
 * Alpha Player progress: one point per level-up or death, and
 * ALPHA_PLAYER_POINTS_PER_SOUL_LINK for each soul link that pays its gift
 * (Babuni, 2026-11-26, D-068). Lives in its own module so the soul-link gift
 * can award it without importing the achievement engine. Nothing counts once
 * the first 100 Legendborn places are taken.
 */
export async function addAlphaPlayerProgress(
  playerId: string,
  amount: number,
  timestamp = Date.now(),
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return;
  }

  const globalState = await loadAlphaPlayerGlobalState();
  if (isAlphaPlayerGloballyLocked(globalState)) {
    return;
  }

  const existing = await loadAchievementProgress(playerId, ALPHA_PLAYER_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = alphaPlayerRankFromProgress(previousProgress);
  const nextProgress = previousProgress + amount;
  let nextRank = alphaPlayerRankFromProgress(nextProgress);

  if (nextRank === 4 && previousRank < 4) {
    const claim = await tryClaimAlphaPlayerRank4Slot(timestamp);
    if (!claim.claimed) {
      nextRank = 3;
    }
  }

  const updated = {
    achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = alphaPlayerRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}
