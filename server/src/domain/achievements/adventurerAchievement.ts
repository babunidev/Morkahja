export const ADVENTURER_ACHIEVEMENT_ID = 'adventurer';

export const ADVENTURER_ENCOUNTERS_PER_RANK = 42;
export const ADVENTURER_MAX_RANK = 4;

export interface AchievementRankDefinition {
  rank: number;
  title: string;
  text: string;
  rankOverlayPath?: string;
}

export const ADVENTURER_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_daily_reward.webp';

export const ADVENTURER_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Adventurer',
    text: 'Each day brings new challenges and new rewards.',
  },
  {
    rank: 2,
    title: 'Explorer',
    text: 'The road stretches far, but your feet never tire.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Wayfarer',
    text: 'The world is vast, and you have made it your home.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Trailblazer',
    text: 'Where others see obstacles, you carve new paths.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function adventurerRankFromProgress(progress: number): number {
  if (progress >= ADVENTURER_ENCOUNTERS_PER_RANK * 4) {
    return ADVENTURER_MAX_RANK;
  }

  if (progress >= ADVENTURER_ENCOUNTERS_PER_RANK * 3) {
    return 3;
  }

  if (progress >= ADVENTURER_ENCOUNTERS_PER_RANK * 2) {
    return 2;
  }

  if (progress >= ADVENTURER_ENCOUNTERS_PER_RANK) {
    return 1;
  }

  return 0;
}

export function adventurerRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return ADVENTURER_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function adventurerDailyRewardGems(rank: number): number {
  const clamped = Math.max(0, Math.min(ADVENTURER_MAX_RANK, rank));
  return clamped + 1;
}

export function adventurerProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = adventurerRankFromProgress(progress);

  if (rank >= ADVENTURER_MAX_RANK) {
    const bandStart = ADVENTURER_ENCOUNTERS_PER_RANK * ADVENTURER_MAX_RANK;
    return {
      bandStart,
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank * ADVENTURER_ENCOUNTERS_PER_RANK;
  const bandEnd = bandStart + ADVENTURER_ENCOUNTERS_PER_RANK;
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
