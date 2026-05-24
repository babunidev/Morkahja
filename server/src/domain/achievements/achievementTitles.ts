export interface AchievementRankTitleSource {
  rank: number;
  title: string;
}

export interface AchievementTitleSource {
  achievementId: string;
  rank: number;
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

export function collectUnlockedTitlesFromAchievements(
  achievements: AchievementTitleSource[],
): UnlockedTitleOption[] {
  const options: UnlockedTitleOption[] = [];
  const seenTitles = new Set<string>();

  for (const achievement of achievements) {
    if (achievement.rank <= 0) {
      continue;
    }

    for (const rankEntry of achievement.ranks) {
      if (rankEntry.rank > achievement.rank || seenTitles.has(rankEntry.title)) {
        continue;
      }

      seenTitles.add(rankEntry.title);
      options.push({
        title: rankEntry.title,
        achievementId: achievement.achievementId,
        rank: rankEntry.rank,
      });
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
