import { loadPlayerAvatars } from '../../services/playerService.js';
import type { AchievementProgress } from './achievementProgress.js';
import {
  FIRESTARTER_ACHIEVEMENT_ID,
  decodeFirestarterProgress,
  encodeFirestarterProgress,
  firestarterRankDefinition,
  firestarterRankFromState,
  totalAvatarLevels,
} from './firestarterAchievement.js';
import {
  loadAchievementProgress,
  saveAchievementProgress,
} from './achievementPersistence.js';
import { recordAchievementUnlockedEvent } from '../../services/gameEventService.js';

export interface FirestarterState {
  avatarCount: number;
  totalLevels: number;
  rank: number;
}

export function mergeFirestarterPeaks(
  storedProgress: number | undefined,
  storedRank: number | undefined,
  liveAvatarCount: number,
  liveTotalLevels: number,
): {
  peakAvatarCount: number;
  peakTotalLevels: number;
  rank: number;
  progress: number;
} {
  const peaks = decodeFirestarterProgress(storedProgress ?? 0, storedRank ?? 0);
  const peakAvatarCount = Math.max(peaks.peakAvatarCount, liveAvatarCount);
  const peakTotalLevels = Math.max(peaks.peakTotalLevels, liveTotalLevels);
  const computedRank = firestarterRankFromState(peakAvatarCount, peakTotalLevels);
  const rank = Math.max(storedRank ?? 0, computedRank);

  return {
    peakAvatarCount,
    peakTotalLevels,
    rank,
    progress: encodeFirestarterProgress(peakAvatarCount, peakTotalLevels),
  };
}

export async function loadFirestarterState(playerId: string): Promise<FirestarterState> {
  const avatars = await loadPlayerAvatars(playerId);
  const liveAvatarCount = avatars.length;
  const liveTotalLevels = totalAvatarLevels(avatars);
  const existing = await loadAchievementProgress(playerId, FIRESTARTER_ACHIEVEMENT_ID);
  const merged = mergeFirestarterPeaks(
    existing?.progress,
    existing?.rank,
    liveAvatarCount,
    liveTotalLevels,
  );

  return {
    avatarCount: merged.peakAvatarCount,
    totalLevels: merged.peakTotalLevels,
    rank: merged.rank,
  };
}

export async function syncFirestarterAchievementProgress(
  playerId: string,
  timestamp = Date.now(),
): Promise<FirestarterState> {
  const avatars = await loadPlayerAvatars(playerId);
  const liveAvatarCount = avatars.length;
  const liveTotalLevels = totalAvatarLevels(avatars);
  const existing = await loadAchievementProgress(playerId, FIRESTARTER_ACHIEVEMENT_ID);
  const previousRank = existing?.rank ?? 0;
  const merged = mergeFirestarterPeaks(
    existing?.progress,
    existing?.rank,
    liveAvatarCount,
    liveTotalLevels,
  );

  const updated: AchievementProgress = {
    achievementId: FIRESTARTER_ACHIEVEMENT_ID,
    playerId,
    rank: merged.rank,
    progress: merged.progress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (merged.rank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (merged.rank > previousRank) {
    const rankDefinition = firestarterRankDefinition(merged.rank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: FIRESTARTER_ACHIEVEMENT_ID,
      rank: merged.rank,
      rankTitle: rankDefinition?.title ?? `Rank ${merged.rank}`,
    });
  }

  return {
    avatarCount: merged.peakAvatarCount,
    totalLevels: merged.peakTotalLevels,
    rank: merged.rank,
  };
}
