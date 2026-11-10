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
    // Visible progress is not yet an earned avatar display title.
    if (achievement.rank <= 0) {
      continue;
    }

    if (achievement.chainTitle?.trim()) {
      pushTitle(achievement.chainTitle, achievement.achievementId, 0);
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

