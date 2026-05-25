import type { AchievementProgressDto } from '@shared/contracts';

export interface AchievementRankUnlock {
  achievement: AchievementProgressDto;
  previousRank: number;
  newRank: number;
}

export function findNewRankUnlocks(
  previous: AchievementProgressDto[] | null,
  current: AchievementProgressDto[],
): AchievementRankUnlock[] {
  if (!previous) {
    return [];
  }

  const previousById = new Map(
    previous.map((achievement) => [achievement.achievementId, achievement]),
  );

  return current.flatMap((achievement) => {
    const prior = previousById.get(achievement.achievementId);
    if (!prior || achievement.rank <= prior.rank) {
      return [];
    }

    return [{
      achievement,
      previousRank: prior.rank,
      newRank: achievement.rank,
    }];
  });
}

export function pickPrimaryUnlock(
  unlocks: AchievementRankUnlock[],
): AchievementRankUnlock | null {
  if (unlocks.length === 0) {
    return null;
  }

  return unlocks.reduce((best, unlock) => (
    unlock.newRank > best.newRank ? unlock : best
  ));
}

export function rankTitleForAchievement(achievement: AchievementProgressDto): string {
  const rankEntry = achievement.ranks.find((entry) => entry.rank === achievement.rank);
  if (rankEntry?.title) {
    return rankEntry.title;
  }

  if (achievement.chainTitle && achievement.rank <= 0) {
    return achievement.chainTitle;
  }

  return achievement.title;
}
