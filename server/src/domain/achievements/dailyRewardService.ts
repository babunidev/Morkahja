import { getPlayer, setPlayer } from '../../db/postgresDocumentStore.js';
import { addPlayerYellowRedGems } from '../../services/playerService.js';
import { recordDailyRewardClaimedEvent } from '../../services/gameEventService.js';
import type { PlayerDocument } from '../../types/player.js';
import { ADVENTURER_ACHIEVEMENT_ID } from './adventurerAchievement.js';
import { ALPHA_PLAYER_ACHIEVEMENT_ID } from './alphaPlayerAchievement.js';
import { BLESSED_ACHIEVEMENT_ID } from './blessedAchievement.js';
import { CONTRIBUTOR_ACHIEVEMENT_ID } from './contributorAchievement.js';
import {
  COMBATANT_ACHIEVEMENT_ID,
  HELPER_ACHIEVEMENT_ID,
  TRICKSTER_ACHIEVEMENT_ID,
} from './encounterSolveAchievements.js';
import { FIRESTARTER_ACHIEVEMENT_ID } from './firestarterAchievement.js';
import { loadFirestarterState } from './firestarterProgress.js';
import {
  achievementRankFromProgress,
  loadAllAchievementProgressForPlayer,
} from './achievementPersistence.js';
import {
  computeDailyRewardGems,
  sumAchievementRanks,
  type DailyRewardAchievementRanks,
} from './achievementDailyReward.js';

export { computeDailyRewardGems, type DailyRewardAchievementRanks } from './achievementDailyReward.js';

export const DAILY_REWARD_ENCOUNTERS_REQUIRED = 42;

export interface PlayerDailyRewardState {
  utcDay: string;
  encountersPlayed: number;
  claimedAt?: number;
}

export interface DailyRewardStatus {
  utcDay: string;
  encountersPlayed: number;
  encountersRequired: number;
  claimable: boolean;
  claimedToday: boolean;
  gemReward: number;
  /** Sum of achievement ranks used for the daily payout (server-derived). */
  achievementRank: number;
}

function utcDayKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function readDailyRewardState(player: PlayerDocument | null): PlayerDailyRewardState {
  const today = utcDayKey();
  const stored = player?.dailyReward;

  if (!stored || stored.utcDay !== today) {
    return {
      utcDay: today,
      encountersPlayed: 0,
    };
  }

  return {
    utcDay: stored.utcDay,
    encountersPlayed: Math.max(0, stored.encountersPlayed ?? 0),
    claimedAt: stored.claimedAt,
  };
}

function isDailyRewardClaimedForDay(
  player: PlayerDocument | null,
  utcDay: string,
): boolean {
  const state = readDailyRewardState(player);
  if (state.utcDay === utcDay && state.claimedAt !== undefined) {
    return true;
  }

  const claimKey = dailyRewardClaimKey(utcDay);
  return player?.loreGemClaims?.[claimKey] === true;
}

function dailyRewardClaimKey(utcDay: string): string {
  return `daily-reward-${utcDay}`;
}

async function writeDailyRewardState(
  playerId: string,
  state: PlayerDailyRewardState,
): Promise<void> {
  await setPlayer(
    playerId,
    {
      dailyReward: state,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

function progressByAchievementId(
  records: Awaited<ReturnType<typeof loadAllAchievementProgressForPlayer>>,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const record of records) {
    map.set(record.achievementId, Math.max(0, record.progress));
  }

  return map;
}

/** Ranks are always derived from authoritative progress (or live avatars for Firestarter). */
export async function resolveDailyRewardRanks(
  playerId: string,
): Promise<DailyRewardAchievementRanks> {
  const [records, firestarter] = await Promise.all([
    loadAllAchievementProgressForPlayer(playerId),
    loadFirestarterState(playerId),
  ]);

  const progress = progressByAchievementId(records);
  const readProgress = (achievementId: string): number => progress.get(achievementId) ?? 0;

  return {
    adventurer: achievementRankFromProgress(
      ADVENTURER_ACHIEVEMENT_ID,
      readProgress(ADVENTURER_ACHIEVEMENT_ID),
    ),
    firestarter: firestarter.rank,
    blessed: achievementRankFromProgress(BLESSED_ACHIEVEMENT_ID, readProgress(BLESSED_ACHIEVEMENT_ID)),
    combatant: achievementRankFromProgress(
      COMBATANT_ACHIEVEMENT_ID,
      readProgress(COMBATANT_ACHIEVEMENT_ID),
    ),
    trickster: achievementRankFromProgress(
      TRICKSTER_ACHIEVEMENT_ID,
      readProgress(TRICKSTER_ACHIEVEMENT_ID),
    ),
    helper: achievementRankFromProgress(HELPER_ACHIEVEMENT_ID, readProgress(HELPER_ACHIEVEMENT_ID)),
    contributor: achievementRankFromProgress(
      CONTRIBUTOR_ACHIEVEMENT_ID,
      readProgress(CONTRIBUTOR_ACHIEVEMENT_ID),
    ),
    alphaPlayer: achievementRankFromProgress(
      ALPHA_PLAYER_ACHIEVEMENT_ID,
      readProgress(ALPHA_PLAYER_ACHIEVEMENT_ID),
    ),
  };
}

export async function recordDailyEncounterPlayed(
  playerId: string,
  timestamp = Date.now(),
): Promise<PlayerDailyRewardState> {
  const player = await getPlayer<PlayerDocument>(playerId);
  const state = readDailyRewardState(player);
  const today = utcDayKey(timestamp);

  if (state.utcDay !== today) {
    const reset: PlayerDailyRewardState = {
      utcDay: today,
      encountersPlayed: 1,
    };
    await writeDailyRewardState(playerId, reset);
    return reset;
  }

  const next: PlayerDailyRewardState = {
    ...state,
    encountersPlayed: state.encountersPlayed + 1,
  };
  await writeDailyRewardState(playerId, next);
  return next;
}

export async function getDailyRewardStatus(playerId: string): Promise<DailyRewardStatus> {
  const player = await getPlayer<PlayerDocument>(playerId);
  const state = readDailyRewardState(player);
  const ranks = await resolveDailyRewardRanks(playerId);
  const gemReward = computeDailyRewardGems(ranks);
  const claimedToday = isDailyRewardClaimedForDay(player, state.utcDay);
  const claimable = !claimedToday
    && state.encountersPlayed >= DAILY_REWARD_ENCOUNTERS_REQUIRED
    && gemReward > 0;

  return {
    utcDay: state.utcDay,
    encountersPlayed: state.encountersPlayed,
    encountersRequired: DAILY_REWARD_ENCOUNTERS_REQUIRED,
    claimable,
    claimedToday,
    gemReward,
    achievementRank: sumAchievementRanks(ranks),
  };
}

export async function claimDailyReward(playerId: string): Promise<{
  status: DailyRewardStatus;
  granted: boolean;
  currencies: NonNullable<PlayerDocument['currencies']>;
}> {
  const player = await getPlayer<PlayerDocument>(playerId);
  const state = readDailyRewardState(player);
  const utcDay = state.utcDay;
  const claimKey = dailyRewardClaimKey(utcDay);

  if (isDailyRewardClaimedForDay(player, utcDay)) {
    return {
      status: await getDailyRewardStatus(playerId),
      granted: false,
      currencies: player?.currencies ?? { yellow_red_gem: 0 },
    };
  }

  if (state.encountersPlayed < DAILY_REWARD_ENCOUNTERS_REQUIRED) {
    const ranks = await resolveDailyRewardRanks(playerId);
    return {
      status: {
        utcDay,
        encountersPlayed: state.encountersPlayed,
        encountersRequired: DAILY_REWARD_ENCOUNTERS_REQUIRED,
        claimable: false,
        claimedToday: false,
        gemReward: computeDailyRewardGems(ranks),
        achievementRank: sumAchievementRanks(ranks),
      },
      granted: false,
      currencies: player?.currencies ?? { yellow_red_gem: 0 },
    };
  }

  const ranks = await resolveDailyRewardRanks(playerId);
  const gemReward = computeDailyRewardGems(ranks);

  if (gemReward <= 0) {
    return {
      status: await getDailyRewardStatus(playerId),
      granted: false,
      currencies: player?.currencies ?? { yellow_red_gem: 0 },
    };
  }

  const { currencies, granted } = await addPlayerYellowRedGems(
    playerId,
    gemReward,
    claimKey,
  );

  await writeDailyRewardState(playerId, {
    ...state,
    claimedAt: Date.now(),
  });

  if (granted) {
    await recordDailyRewardClaimedEvent(playerId, gemReward, utcDay);
  }

  return {
    status: await getDailyRewardStatus(playerId),
    granted,
    currencies,
  };
}
