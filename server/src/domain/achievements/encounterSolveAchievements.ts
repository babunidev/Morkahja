import type { AchievementRankDefinition } from './adventurerAchievement.js';
import { EncounterType } from '../../engine/types.js';

export const ENCOUNTER_SOLVE_RANK_THRESHOLDS = [50, 250, 1000, 5000] as const;
export const ENCOUNTER_SOLVE_MAX_RANK = 4;

export interface EncounterSolveAchievementConfig {
  achievementId: string;
  encounterType: number;
  chainTitle: string;
  chainText: string;
  baseIcon: string;
  progressLabel: string;
  ranks: AchievementRankDefinition[];
}

export const COMBATANT_ACHIEVEMENT_ID = 'combatant';
export const TRICKSTER_ACHIEVEMENT_ID = 'trickster';
export const HELPER_ACHIEVEMENT_ID = 'helper';

export const ENCOUNTER_SOLVE_ACHIEVEMENTS: EncounterSolveAchievementConfig[] = [
  {
    achievementId: COMBATANT_ACHIEVEMENT_ID,
    encounterType: EncounterType.Combat,
    chainTitle: 'Combatant',
    chainText: 'You successfully solved a combat encounter.',
    baseIcon: 'UI/04_ACHIEVEMENTS/im_glyph_combatant.webp',
    progressLabel: 'combat encounters',
    ranks: [
      {
        rank: 1,
        title: 'Initiate of Steel',
        text: 'Your first victories carve a place for you in the clash of blades.',
      },
      {
        rank: 2,
        title: 'Warbound',
        text: 'The rhythm of battle begins to answer to you.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
      },
      {
        rank: 3,
        title: 'Iron Veteran',
        text: 'You move through conflict like a remembered storm.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
      },
      {
        rank: 4,
        title: 'Warlord Eternal',
        text: 'Battle itself recognizes your return.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
      },
    ],
  },
  {
    achievementId: TRICKSTER_ACHIEVEMENT_ID,
    encounterType: EncounterType.Trick,
    chainTitle: 'Trickster',
    chainText: 'You successfully solved a trick encounter.',
    baseIcon: 'UI/04_ACHIEVEMENTS/im_glyph_trickster.webp',
    progressLabel: 'trick encounters',
    ranks: [
      {
        rank: 1,
        title: 'Quickhand',
        text: 'You learn that wit can move faster than force.',
      },
      {
        rank: 2,
        title: 'Illusion Breaker',
        text: 'What once deceived others now bends before your perception.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
      },
      {
        rank: 3,
        title: 'Shadow Thinker',
        text: 'Every puzzle begins to feel like a conversation.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
      },
      {
        rank: 4,
        title: 'Master of Paradox',
        text: 'The impossible becomes familiar in your presence.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
      },
    ],
  },
  {
    achievementId: HELPER_ACHIEVEMENT_ID,
    encounterType: EncounterType.Help,
    chainTitle: 'Helper',
    chainText: 'You successfully solved a help encounter.',
    baseIcon: 'UI/04_ACHIEVEMENTS/im_glyph_helper.webp',
    progressLabel: 'help encounters',
    ranks: [
      {
        rank: 1,
        title: 'Kind Stranger',
        text: 'Small acts of aid begin to shape your path.',
      },
      {
        rank: 2,
        title: 'Trusted Hand',
        text: 'Others begin to rely on your steady presence.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_bronze_achievement.webp',
      },
      {
        rank: 3,
        title: 'Guardian Presence',
        text: 'Your help becomes a quiet force moving through the world.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_silver_achievement.webp',
      },
      {
        rank: 4,
        title: 'Beacon of Aid',
        text: 'Where you arrive, suffering finds less room to remain.',
        rankOverlayPath: 'UI/04_ACHIEVEMENTS/im_rank_gold_achievement.webp',
      },
    ],
  },
];

const ENCOUNTER_SOLVE_BY_ID = new Map(
  ENCOUNTER_SOLVE_ACHIEVEMENTS.map((config) => [config.achievementId, config]),
);

const ENCOUNTER_SOLVE_BY_TYPE = new Map(
  ENCOUNTER_SOLVE_ACHIEVEMENTS.map((config) => [config.encounterType, config]),
);

export function getEncounterSolveAchievementById(
  achievementId: string,
): EncounterSolveAchievementConfig | undefined {
  return ENCOUNTER_SOLVE_BY_ID.get(achievementId);
}

export function getEncounterSolveAchievementByType(
  encounterType: number,
): EncounterSolveAchievementConfig | undefined {
  return ENCOUNTER_SOLVE_BY_TYPE.get(encounterType);
}

export function encounterSolveRankFromProgress(
  config: EncounterSolveAchievementConfig,
  progress: number,
): number {
  if (progress >= ENCOUNTER_SOLVE_RANK_THRESHOLDS[3]) {
    return ENCOUNTER_SOLVE_MAX_RANK;
  }

  if (progress >= ENCOUNTER_SOLVE_RANK_THRESHOLDS[2]) {
    return 3;
  }

  if (progress >= ENCOUNTER_SOLVE_RANK_THRESHOLDS[1]) {
    return 2;
  }

  if (progress >= ENCOUNTER_SOLVE_RANK_THRESHOLDS[0]) {
    return 1;
  }

  return 0;
}

export function encounterSolveRankDefinition(
  config: EncounterSolveAchievementConfig,
  rank: number,
): AchievementRankDefinition | null {
  if (rank <= 0) {
    return null;
  }

  return config.ranks.find((entry) => entry.rank === rank) ?? null;
}

function encounterSolveRankFromProgressValue(progress: number): number {
  return encounterSolveRankFromProgress(ENCOUNTER_SOLVE_ACHIEVEMENTS[0], progress);
}

export function encounterSolveProgressBand(progress: number): {
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
} {
  const rank = encounterSolveRankFromProgressValue(progress);

  if (rank >= ENCOUNTER_SOLVE_MAX_RANK) {
    return {
      bandStart: ENCOUNTER_SOLVE_RANK_THRESHOLDS[3],
      bandEnd: null,
      progressInBand: 1,
    };
  }

  const bandStart = rank === 0 ? 0 : ENCOUNTER_SOLVE_RANK_THRESHOLDS[rank - 1];
  const bandEnd = ENCOUNTER_SOLVE_RANK_THRESHOLDS[rank];
  const span = bandEnd - bandStart;

  return {
    bandStart,
    bandEnd,
    progressInBand: span > 0 ? Math.min(1, Math.max(0, (progress - bandStart) / span)) : 0,
  };
}
