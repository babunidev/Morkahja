import { getPlayer, setPlayer } from '../../db/postgresDocumentStore.js';
import { addPlayerYellowRedGems } from '../../services/playerService.js';
import { recordDailyRewardClaimedEvent } from '../../services/gameEventService.js';
import type { PlayerDocument } from '../../types/player.js';
import {
  ADVENTURER_ACHIEVEMENT_ID,
  adventurerDailyRewardGems,
  adventurerRankFromProgress,
} from './adventurerAchievement.js';
import { loadAchievementProgress } from './achievementPersistence.js';

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

export async function getAdventurerRankForPlayer(playerId: string): Promise<number> {
  const progress = await loadAchievementProgress(playerId, ADVENTURER_ACHIEVEMENT_ID);
  return adventurerRankFromProgress(progress?.progress ?? 0);
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
  const achievementRank = await getAdventurerRankForPlayer(playerId);
  const gemReward = adventurerDailyRewardGems(achievementRank);
  const claimedToday = state.claimedAt !== undefined;
  const claimable = !claimedToday && state.encountersPlayed >= DAILY_REWARD_ENCOUNTERS_REQUIRED;

  return {
    utcDay: state.utcDay,
    encountersPlayed: state.encountersPlayed,
    encountersRequired: DAILY_REWARD_ENCOUNTERS_REQUIRED,
    claimable,
    claimedToday,
    gemReward,
    achievementRank,
  };
}

export async function claimDailyReward(playerId: string): Promise<{
  status: DailyRewardStatus;
  granted: boolean;
  currencies: NonNullable<PlayerDocument['currencies']>;
}> {
  const status = await getDailyRewardStatus(playerId);

  if (!status.claimable) {
    const player = await getPlayer<PlayerDocument>(playerId);
    return {
      status,
      granted: false,
      currencies: player?.currencies ?? { yellow_red_gem: 0 },
    };
  }

  const claimKey = `daily-reward-${status.utcDay}`;
  const { currencies, granted } = await addPlayerYellowRedGems(
    playerId,
    status.gemReward,
    claimKey,
  );

  if (granted) {
    const player = await getPlayer<PlayerDocument>(playerId);
    const state = readDailyRewardState(player);
    await writeDailyRewardState(playerId, {
      ...state,
      claimedAt: Date.now(),
    });
    await recordDailyRewardClaimedEvent(playerId, status.gemReward, status.utcDay);
  }

  return {
    status: await getDailyRewardStatus(playerId),
    granted,
    currencies,
  };
}
