import type { AchievementRankDefinition } from './adventurerAchievement.js';

export const BLESSED_ACHIEVEMENT_ID = 'blessed';

/** Lucky dice outcomes (Fortune / Prosperity) toward each rank. */
export const BLESSED_RANK_THRESHOLDS = [50, 250, 1000, 5000] as const;
export const BLESSED_MAX_RANK = 4;

export const BLESSED_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_lucker.webp';

export const BLESSED_LUCKY_OUTCOMES = new Set(['fortune', 'prosperity']);

export const BLESSED_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Fortunate',
    text: 'Luck begins to recognize your presence.',
  },
  {
    rank: 2,
    title: 'Favored',
    text: 'Chance bends gently around your choices.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Serendipity Bound',
    text: 'What others call luck has become a pattern in your path.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Divine Gambler',
    text: 'The dice no longer fall by chance when your hand is near them.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export const BLESSED_CHAIN_TEXT = 'You got lucky rolling the dice.';

export function isBlessedLuckyOutcome(outcome: string | undefined): boolean {
  if (!outcome) {
    return false;
  }

  return BLESSED_LUCKY_OUTCOMES.has(outcome.toLowerCase());
}

export function blessedRankFromProgress(progress: number): number {
  if (progress >= BLESSED_RANK_THRESHOLDS[3]) {
    return BLESSED_MAX_RANK;
  }

  if (progress >= BLESSED_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= BLESSED_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= BLESSED_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function blessedRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return BLESSED_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function blessedProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = blessedRankFromProgress(progress);

  if (rank >= BLESSED_MAX_RANK) {
    return {
      bandStart: BLESSED_RANK_THRESHOLDS[3],
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank === 0 ? 0 : BLESSED_RANK_THRESHOLDS[rank - 1];
  const bandEnd = BLESSED_RANK_THRESHOLDS[rank];
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
