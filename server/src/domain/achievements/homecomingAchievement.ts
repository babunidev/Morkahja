import type { AchievementRankDefinition } from './adventurerAchievement.js';
import { standardAchievementDailyRewardGems } from './adventurerAchievement.js';

/**
 * Homecoming (Babuni, 2026-11-26, D-065): one avatar that has played 100
 * encounters opens its people's homeland for the whole account, once and for
 * good: Verdani → Evergrove, Rokur → Fyrskar Mountains, Aevis or Grimnir →
 * Celesterra. The rank is the number of homelands earned. A homeland cannot
 * be bought with gems; only an all-expansions bundle also includes it.
 */
export const HOMECOMING_ACHIEVEMENT_ID = 'homecoming';
export const HOMECOMING_ENCOUNTERS_REQUIRED = 100;

export const HOMECOMING_CHAIN_TITLE = 'Homecoming';
export const HOMECOMING_CHAIN_TEXT =
  'Play 100 encounters with one avatar to open the homeland of its people.';

export const HOMECOMING_RANK_THRESHOLDS = [1, 2, 3] as const;
export const HOMECOMING_MAX_RANK = 3;

/** An unused glyph from the achievement set: wings over a land. */
export const HOMECOMING_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_monthly_reward.webp';

export const HOMECOMING_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    // Not the chain's own name: a rank title is worn by the avatar (Babuni, 2026-11-26).
    title: 'Rootseeker',
    text: 'You have walked the land of your people.',
  },
  {
    rank: 2,
    title: 'Hearthfriend',
    text: 'A second people has welcomed you home.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 3,
    title: 'Child of Morkahja',
    text: 'Every homeland of Morkahja has opened its gates to you.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function homecomingRankFromProgress(progress: number): number {
  const earned = Math.max(0, Math.floor(progress));
  return Math.min(HOMECOMING_MAX_RANK, earned);
}

export function homecomingRankDefinition(rank: number): AchievementRankDefinition | null {
  return HOMECOMING_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function homecomingDailyRewardGems(rank: number): number {
  return standardAchievementDailyRewardGems(rank, HOMECOMING_MAX_RANK);
}

export function homecomingProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = homecomingRankFromProgress(progress);
  if (rank >= HOMECOMING_MAX_RANK) {
    return { bandStart: HOMECOMING_MAX_RANK, bandEnd: null, progressInBand: 1 };
  }
  return { bandStart: rank, bandEnd: rank + 1, progressInBand: 0 };
}
