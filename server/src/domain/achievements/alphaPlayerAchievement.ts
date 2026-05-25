import type { AchievementRankDefinition } from './adventurerAchievement.js';

export const ALPHA_PLAYER_ACHIEVEMENT_ID = 'alpha_player';

export const ALPHA_PLAYER_CHAIN_TITLE = 'Alpha Player';
export const ALPHA_PLAYER_CHAIN_TEXT =
  'You were among the first to step into the world of Morkahja.';

export const ALPHA_PLAYER_RANK_THRESHOLDS = [20, 40, 80, 160] as const;
export const ALPHA_PLAYER_MAX_RANK = 4;
export const ALPHA_PLAYER_RANK4_SLOT_CAP = 100;
export const ALPHA_PLAYER_DAILY_REWARD_GEMS_PER_RANK = 50;

export const ALPHA_PLAYER_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_alphaplayer.webp';

export const ALPHA_PLAYER_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Initiate',
    text: 'The world recognizes your first imprint upon it.',
  },
  {
    rank: 2,
    title: 'Seasoned Survivor',
    text: 'You endure what others have not yet learned to fear.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Worldwalker',
    text: 'Your path stretches across the shaping of the early world.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Legendborn',
    text: 'Few remain who remember the world before your footsteps marked it.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function alphaPlayerRankFromProgress(progress: number): number {
  if (progress >= ALPHA_PLAYER_RANK_THRESHOLDS[3]) {
    return ALPHA_PLAYER_MAX_RANK;
  }

  if (progress >= ALPHA_PLAYER_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= ALPHA_PLAYER_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= ALPHA_PLAYER_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function alphaPlayerRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return ALPHA_PLAYER_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function alphaPlayerDailyRewardGems(rank: number): number {
  const clamped = Math.max(0, Math.min(ALPHA_PLAYER_MAX_RANK, rank));
  return clamped * ALPHA_PLAYER_DAILY_REWARD_GEMS_PER_RANK;
}

export function alphaPlayerProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = alphaPlayerRankFromProgress(progress);

  if (rank >= ALPHA_PLAYER_MAX_RANK) {
    return {
      bandStart: ALPHA_PLAYER_RANK_THRESHOLDS[3],
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank === 0 ? 0 : ALPHA_PLAYER_RANK_THRESHOLDS[rank - 1];
  const bandEnd = ALPHA_PLAYER_RANK_THRESHOLDS[rank];
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
