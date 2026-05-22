import type { AchievementRankDefinition } from './adventurerAchievement.js';

export const CONTRIBUTOR_ACHIEVEMENT_ID = 'contributor';

/** Cumulative gems donated: rank 1 on first gem, then 200 / 400 / 800. */
export const CONTRIBUTOR_RANK_THRESHOLDS = [100, 300, 700, 1500] as const;
export const CONTRIBUTOR_MAX_RANK = 4;

export const CONTRIBUTOR_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_donator.webp';

export const CONTRIBUTOR_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Contributor',
    text: 'You give to sustain the lands of Morkahja.',
  },
  {
    rank: 2,
    title: 'Benefactor',
    text: 'Your generosity helps shape the very fabric of this world.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Guardian',
    text: 'Your offerings fuel the fires that keep Morkahja alive.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Patron',
    text: 'Your name is forever etched into the legend of Morkahja.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function contributorRankFromProgress(progress: number): number {
  if (progress >= CONTRIBUTOR_RANK_THRESHOLDS[3]) {
    return CONTRIBUTOR_MAX_RANK;
  }

  if (progress >= CONTRIBUTOR_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= CONTRIBUTOR_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= CONTRIBUTOR_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function contributorRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return CONTRIBUTOR_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function contributorProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = contributorRankFromProgress(progress);

  if (rank >= CONTRIBUTOR_MAX_RANK) {
    return {
      bandStart: CONTRIBUTOR_RANK_THRESHOLDS[3],
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank === 0 ? 0 : CONTRIBUTOR_RANK_THRESHOLDS[rank - 1];
  const bandEnd = CONTRIBUTOR_RANK_THRESHOLDS[rank];
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
