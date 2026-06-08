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

    if (!prior) {
      if (achievement.progress > 0 || achievement.rank > 0) {
        return [{
          achievement,
          previousRank: 0,
          newRank: achievement.rank,
        }];
      }

      return [];
    }

    if (achievement.rank > prior.rank) {
      return [{
        achievement,
        previousRank: prior.rank,
        newRank: achievement.rank,
      }];
    }

    if (prior.progress <= 0 && achievement.progress > 0) {
      return [{
        achievement,
        previousRank: prior.rank,
        newRank: achievement.rank,
      }];
    }

    return [];
  });
}

export function pickPrimaryUnlock(
  unlocks: AchievementRankUnlock[],
): AchievementRankUnlock | null {
  if (unlocks.length === 0) {
    return null;
  }

  return unlocks.reduce((best, unlock) => {
    if (unlock.newRank !== best.newRank) {
      return unlock.newRank > best.newRank ? unlock : best;
    }

    return unlock.previousRank > best.previousRank ? unlock : best;
  });
}

export function rankTitleForAchievement(achievement: AchievementProgressDto): string {
  if (achievement.rank > 0) {
    const rankEntry = achievement.ranks.find((entry) => entry.rank === achievement.rank);
    if (rankEntry?.title) {
      return rankEntry.title;
    }
  }

  if (achievement.chainTitle?.trim()) {
    return achievement.chainTitle.trim();
  }

  const firstRankTitle = achievement.ranks.find((entry) => entry.rank === 1)?.title
    ?? achievement.ranks[0]?.title;

  if (firstRankTitle) {
    return firstRankTitle;
  }

  return achievement.title;
}
