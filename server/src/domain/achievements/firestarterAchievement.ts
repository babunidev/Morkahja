import type { AchievementRankDefinition } from './adventurerAchievement.js';

export const FIRESTARTER_ACHIEVEMENT_ID = 'firestarter';
export const FIRESTARTER_BASE_ICON = 'UI/04_ACHIEVEMENTS/im_glyph_created_avatar.webp';
export const FIRESTARTER_AVATAR_RANK_THRESHOLDS = [1, 2, 3] as const;
export const FIRESTARTER_TOTAL_LEVELS_RANK4 = 30;
export const FIRESTARTER_MAX_RANK = 4;

/** Encodes peak avatar count and total levels in one progress integer (legacy: raw avatar count). */
export const FIRESTARTER_PROGRESS_LEVEL_MULTIPLIER = 1000;

export const FIRESTARTER_RANKS: AchievementRankDefinition[] = [
  {
    rank: 1,
    title: 'Firestarter',
    text: 'You have taken your first steps into the unknown.',
  },
  {
    rank: 2,
    title: 'Pathfinder',
    text: 'Your journey continues as you carve your own path.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
  },
  {
    rank: 3,
    title: 'Wayseeker',
    text: 'Your presence leaves a mark on the world of Morkahja.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
  },
  {
    rank: 4,
    title: 'Fateforger',
    text: 'You no longer just travel through the world—you shape its destiny.',
    rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
  },
];

export function encodeFirestarterProgress(
  peakAvatarCount: number,
  peakTotalLevels: number,
): number {
  const avatars = Math.max(0, Math.floor(peakAvatarCount));
  const levels = Math.max(0, Math.floor(peakTotalLevels));

  return avatars * FIRESTARTER_PROGRESS_LEVEL_MULTIPLIER + levels;
}

export function decodeFirestarterProgress(
  progress: number,
  storedRank = 0,
): { peakAvatarCount: number; peakTotalLevels: number } {
  const safe = Math.max(0, Math.floor(progress));

  if (safe < FIRESTARTER_PROGRESS_LEVEL_MULTIPLIER) {
    return {
      peakAvatarCount: safe,
      peakTotalLevels: storedRank >= FIRESTARTER_MAX_RANK
        ? FIRESTARTER_TOTAL_LEVELS_RANK4
        : 0,
    };
  }

  return {
    peakAvatarCount: Math.floor(safe / FIRESTARTER_PROGRESS_LEVEL_MULTIPLIER),
    peakTotalLevels: safe % FIRESTARTER_PROGRESS_LEVEL_MULTIPLIER,
  };
}

export function firestarterRankFromState(
  avatarCount: number,
  totalLevels: number,
): number {
  if (totalLevels >= FIRESTARTER_TOTAL_LEVELS_RANK4) {
    return FIRESTARTER_MAX_RANK;
  }

  if (avatarCount >= FIRESTARTER_AVATAR_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (avatarCount >= FIRESTARTER_AVATAR_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (avatarCount >= FIRESTARTER_AVATAR_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function firestarterRankDefinition(rank: number): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return FIRESTARTER_RANKS.find((entry) => entry.rank === rank) ?? null;
}

export function firestarterProgressBand(
  avatarCount: number,
  totalLevels: number,
): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = firestarterRankFromState(avatarCount, totalLevels);

  if (rank >= FIRESTARTER_MAX_RANK) {
    return {
      bandStart: FIRESTARTER_TOTAL_LEVELS_RANK4,
      bandEnd: null,
      progressInBand: 1,
    };
  }

  if (rank === 3) {
    const span = FIRESTARTER_TOTAL_LEVELS_RANK4 - FIRESTARTER_AVATAR_RANK_THRESHOLDS[2];

    return {
      bandStart: FIRESTARTER_AVATAR_RANK_THRESHOLDS[2],
      bandEnd: FIRESTARTER_TOTAL_LEVELS_RANK4,
      progressInBand: span > 0
        ? Math.min(1, Math.max(0, (totalLevels - FIRESTARTER_AVATAR_RANK_THRESHOLDS[2]) / span))
        : 0,
    };
  }

  const avatarBandEnd = FIRESTARTER_AVATAR_RANK_THRESHOLDS[2];

  return {
    bandStart: 0,
    bandEnd: avatarBandEnd,
    progressInBand: avatarBandEnd > 0
      ? Math.min(1, Math.max(0, avatarCount / avatarBandEnd))
      : 0,
  };
}

export function totalAvatarLevels(
  avatars: Array<{ level?: number }>,
): number {
  return avatars.reduce((sum, avatar) => sum + (avatar.level ?? 1), 0);
}
