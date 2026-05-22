import { loadPlayerAvatars } from '../../services/playerService.js';
import type { AchievementProgress } from './achievementProgress.js';
import {
  FIRESTARTER_ACHIEVEMENT_ID,
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

export async function loadFirestarterState(playerId: string): Promise<FirestarterState> {
  const avatars = await loadPlayerAvatars(playerId);
  const avatarCount = avatars.length;
  const levels = totalAvatarLevels(avatars);

  return {
    avatarCount,
    totalLevels: levels,
    rank: firestarterRankFromState(avatarCount, levels),
  };
}

export async function syncFirestarterAchievementProgress(
  playerId: string,
  timestamp = Date.now(),
): Promise<FirestarterState> {
  const state = await loadFirestarterState(playerId);
  const existing = await loadAchievementProgress(playerId, FIRESTARTER_ACHIEVEMENT_ID);
  const previousRank = existing?.rank ?? 0;

  const updated: AchievementProgress = {
    achievementId: FIRESTARTER_ACHIEVEMENT_ID,
    playerId,
    rank: state.rank,
    progress: state.avatarCount,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (state.rank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (state.rank > previousRank) {
    const rankDefinition = firestarterRankDefinition(state.rank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: FIRESTARTER_ACHIEVEMENT_ID,
      rank: state.rank,
      rankTitle: rankDefinition?.title ?? `Rank ${state.rank}`,
    });
  }

  return state;
}
