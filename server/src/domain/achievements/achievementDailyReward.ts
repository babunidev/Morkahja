import { adventurerDailyRewardGems } from './adventurerAchievement.js';
import { alphaPlayerDailyRewardGems } from './alphaPlayerAchievement.js';

/** Upper bound for a single daily claim (all chains maxed + Alpha Player). */
export const MAX_DAILY_REWARD_GEMS = 300;

export interface DailyRewardAchievementRanks {
  adventurer: number;
  firestarter: number;
  blessed: number;
  combatant: number;
  trickster: number;
  helper: number;
  contributor: number;
  alphaPlayer: number;
}

export function sumAchievementRanks(ranks: DailyRewardAchievementRanks): number {
  return ranks.adventurer
    + ranks.firestarter
    + ranks.blessed
    + ranks.combatant
    + ranks.trickster
    + ranks.helper
    + ranks.contributor
    + ranks.alphaPlayer;
}

export function computeDailyRewardGems(ranks: DailyRewardAchievementRanks): number {
  const raw = adventurerDailyRewardGems(ranks.adventurer)
    + adventurerDailyRewardGems(ranks.firestarter)
    + adventurerDailyRewardGems(ranks.blessed)
    + adventurerDailyRewardGems(ranks.combatant)
    + adventurerDailyRewardGems(ranks.trickster)
    + adventurerDailyRewardGems(ranks.helper)
    + adventurerDailyRewardGems(ranks.contributor)
    + alphaPlayerDailyRewardGems(ranks.alphaPlayer);

  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }

  return Math.min(MAX_DAILY_REWARD_GEMS, Math.floor(raw));
}
