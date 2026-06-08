export interface AchievementRankTitleSource {
  rank: number;
  title: string;
}

export interface AchievementTitleSource {
  achievementId: string;
  rank: number;
  progress: number;
  chainTitle?: string;
  ranks: AchievementRankTitleSource[];
}

export interface UnlockedTitleOption {
  title: string;
  achievementId: string;
  rank: number;
}

export function readAvatarDisplayTitle(
  avatar: { profile?: { displayTitle?: unknown } },
): string | null {
  const title = avatar.profile?.displayTitle;
  if (typeof title !== 'string') {
    return null;
  }

  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstRankTitle(ranks: AchievementRankTitleSource[]): string | undefined {
  return ranks.find((entry) => entry.rank === 1)?.title ?? ranks[0]?.title;
}

export function collectUnlockedTitlesFromAchievements(
  achievements: AchievementTitleSource[],
): UnlockedTitleOption[] {
  const options: UnlockedTitleOption[] = [];
  const seenTitles = new Set<string>();

  const pushTitle = (title: string, achievementId: string, rank: number): void => {
    const normalized = title.trim();
    if (!normalized || seenTitles.has(normalized)) {
      return;
    }

    seenTitles.add(normalized);
    options.push({
      title: normalized,
      achievementId,
      rank,
    });
  };

  for (const achievement of achievements) {
    if (achievement.progress <= 0 && achievement.rank <= 0) {
      continue;
    }

    if (achievement.progress > 0 && achievement.chainTitle?.trim()) {
      pushTitle(achievement.chainTitle, achievement.achievementId, 0);
    } else if (achievement.progress > 0 && achievement.rank < 1) {
      const starterTitle = firstRankTitle(achievement.ranks);
      if (starterTitle) {
        pushTitle(starterTitle, achievement.achievementId, 0);
      }
    }

    if (achievement.rank <= 0) {
      continue;
    }

    for (const rankEntry of achievement.ranks) {
      if (rankEntry.rank > achievement.rank) {
        continue;
      }

      pushTitle(rankEntry.title, achievement.achievementId, rankEntry.rank);
    }
  }

  return options.sort((left, right) => (
    left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
  ));
}

export function formatAvatarDisplayName(
  name: string,
  displayTitle: string | null | undefined,
): string {
  const baseName = name.trim() || 'Adventurer';
  const title = typeof displayTitle === 'string' ? displayTitle.trim() : '';

  if (title.length === 0) {
    return baseName;
  }

  return `${title} ${baseName}`;
}
