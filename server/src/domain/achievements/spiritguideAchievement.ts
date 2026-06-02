import {
  type AchievementRankDefinition,
  standardAchievementDailyRewardGems,
} from './adventurerAchievement.js';

export const SPIRITGUIDE_ACHIEVEMENT_ID = 'spiritguide';

export const SPIRITGUIDE_CHAIN_TITLE = 'Spiritguide';
export const SPIRITGUIDE_CHAIN_TEXT =
  'You have begun to lead others into the world of Morkahja.';

/** Soul-links received: rank up at 3 / 9 / 21 / 54. */
export const SPIRITGUIDE_RANK_THRESHOLDS = [3, 9, 21, 54] as const;
export const SPIRITGUIDE_MAX_RANK = 4;

export const SPIRITGUIDE_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_multiplayer_refferal.webp';

export const SPIRITGUIDE_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Spiritguide',
    text: 'You have begun to lead others into the world of Morkahja.',
  },
  {
    rank: 2,
    title: 'Bondforger',
    text: 'Your connections grow strong, uniting kindred spirits.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Soulwarden',
    text: 'Many souls walk in your footsteps, guided by your wisdom.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Elder',
    text: 'Your legacy shines bright, drawing adventurers to your side.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function spiritguideRankFromProgress(progress: number): number {
  if (progress >= SPIRITGUIDE_RANK_THRESHOLDS[3]) {
    return SPIRITGUIDE_MAX_RANK;
  }

  if (progress >= SPIRITGUIDE_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= SPIRITGUIDE_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= SPIRITGUIDE_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function spiritguideRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return SPIRITGUIDE_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function spiritguideDailyRewardGems(rank: number): number {
  return standardAchievementDailyRewardGems(rank, SPIRITGUIDE_MAX_RANK);
}

export function spiritguideProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = spiritguideRankFromProgress(progress);

  if (rank >= SPIRITGUIDE_MAX_RANK) {
    return {
      bandStart: SPIRITGUIDE_RANK_THRESHOLDS[3],
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank === 0 ? 0 : SPIRITGUIDE_RANK_THRESHOLDS[rank - 1];
  const bandEnd = SPIRITGUIDE_RANK_THRESHOLDS[rank];
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
