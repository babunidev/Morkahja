import type { GameEvent } from '../events/GameEvent.js';
import {
  recordAchievementUnlockedEvent,
} from '../../services/gameEventService.js';
import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  alphaPlayerRankDefinition,
  alphaPlayerRankFromProgress,
} from './alphaPlayerAchievement.js';
import {
  isAlphaPlayerGloballyLocked,
  loadAlphaPlayerGlobalState,
  tryClaimAlphaPlayerRank4Slot,
} from './alphaPlayerGlobalLock.js';
import {
  ADVENTURER_ACHIEVEMENT_ID,
  adventurerRankDefinition,
  adventurerRankFromProgress,
} from './adventurerAchievement.js';
import {
  loadAchievementProgress,
  saveAchievementProgress,
} from './achievementPersistence.js';
import { recordDailyEncounterPlayed } from './dailyRewardService.js';
import { syncFirestarterAchievementProgress } from './firestarterProgress.js';
import {
  CONTRIBUTOR_ACHIEVEMENT_ID,
  contributorRankDefinition,
  contributorRankFromProgress,
} from './contributorAchievement.js';
import {
  BLESSED_ACHIEVEMENT_ID,
  blessedRankDefinition,
  blessedRankFromProgress,
  isBlessedLuckyOutcome,
} from './blessedAchievement.js';
import {
  type EncounterSolveAchievementConfig,
  encounterSolveRankDefinition,
  encounterSolveRankFromProgress,
  getEncounterSolveAchievementByType,
} from './encounterSolveAchievements.js';

const ENCOUNTER_PLAYED_EVENT_TYPES = new Set([
  'encounter_resolved',
  'encounter_failed',
]);

const ALPHA_PLAYER_ACTIVITY_EVENT_TYPES = new Set([
  'level_up',
  'avatar_died',
]);

const FIRESTARTER_ACTIVITY_EVENT_TYPES = new Set([
  'avatar_created',
  'level_up',
]);

export async function handleGameEvent(event: GameEvent): Promise<void> {
  if (!event.playerId) {
    return;
  }

  if (ENCOUNTER_PLAYED_EVENT_TYPES.has(event.type)) {
    await recordDailyEncounterPlayed(event.playerId, event.timestamp);
    await processAdventurerEncounterPlayed(event.playerId, event.timestamp);
  }

  if (event.type === 'encounter_resolved') {
    if (isBlessedLuckyEncounter(event)) {
      await processBlessedLuckyEncounter(event.playerId, event.timestamp);
    }

    await processEncounterSolveAchievements(event);
  }

  if (ALPHA_PLAYER_ACTIVITY_EVENT_TYPES.has(event.type)) {
    await processAlphaPlayerActivity(event.playerId, event.timestamp);
  }

  if (FIRESTARTER_ACTIVITY_EVENT_TYPES.has(event.type)) {
    await syncFirestarterAchievementProgress(event.playerId, event.timestamp);
  }

  if (event.type === 'gems_donated') {
    const amount = readDonationAmount(event.payload);
    if (amount > 0) {
      await processContributorGemsDonated(event.playerId, amount, event.timestamp);
    }
  }
}

function isBlessedLuckyEncounter(event: GameEvent): boolean {
  if (event.payload.success !== true) {
    return false;
  }

  const outcome = event.payload.outcome;
  return typeof outcome === 'string' && isBlessedLuckyOutcome(outcome);
}

function readEncounterType(payload: Record<string, unknown>): number | undefined {
  const encounterType = payload.encounterType;
  return typeof encounterType === 'number' && Number.isInteger(encounterType)
    ? encounterType
    : undefined;
}

async function processEncounterSolveAchievements(event: GameEvent): Promise<void> {
  if (event.payload.success !== true || !event.playerId) {
    return;
  }

  const encounterType = readEncounterType(event.payload);
  if (encounterType === undefined) {
    return;
  }

  const config = getEncounterSolveAchievementByType(encounterType);
  if (!config) {
    return;
  }

  await incrementEncounterSolveAchievement(event.playerId, config, event.timestamp);
}

async function incrementEncounterSolveAchievement(
  playerId: string,
  config: EncounterSolveAchievementConfig,
  timestamp: number,
): Promise<void> {
  const existing = await loadAchievementProgress(playerId, config.achievementId);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = encounterSolveRankFromProgress(config, previousProgress);
  const nextProgress = previousProgress + 1;
  const nextRank = encounterSolveRankFromProgress(config, nextProgress);

  const updated = {
    achievementId: config.achievementId,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = encounterSolveRankDefinition(config, nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: config.achievementId,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}

async function processBlessedLuckyEncounter(
  playerId: string,
  timestamp: number,
): Promise<void> {
  const existing = await loadAchievementProgress(playerId, BLESSED_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = blessedRankFromProgress(previousProgress);
  const nextProgress = previousProgress + 1;
  const nextRank = blessedRankFromProgress(nextProgress);

  const updated = {
    achievementId: BLESSED_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = blessedRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: BLESSED_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}

function readDonationAmount(payload: Record<string, unknown>): number {
  const amount = payload.amount;
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0
    ? Math.floor(amount)
    : 0;
}

async function processContributorGemsDonated(
  playerId: string,
  amount: number,
  timestamp: number,
): Promise<void> {
  const existing = await loadAchievementProgress(playerId, CONTRIBUTOR_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = contributorRankFromProgress(previousProgress);
  const nextProgress = previousProgress + amount;
  const nextRank = contributorRankFromProgress(nextProgress);

  const updated = {
    achievementId: CONTRIBUTOR_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = contributorRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: CONTRIBUTOR_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}

async function processAdventurerEncounterPlayed(
  playerId: string,
  timestamp: number,
): Promise<void> {
  const existing = await loadAchievementProgress(playerId, ADVENTURER_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = adventurerRankFromProgress(previousProgress);
  const nextProgress = previousProgress + 1;
  const nextRank = adventurerRankFromProgress(nextProgress);

  const updated = {
    achievementId: ADVENTURER_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = adventurerRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: ADVENTURER_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}

async function processAlphaPlayerActivity(
  playerId: string,
  timestamp: number,
): Promise<void> {
  const globalState = await loadAlphaPlayerGlobalState();
  if (isAlphaPlayerGloballyLocked(globalState)) {
    return;
  }

  const existing = await loadAchievementProgress(playerId, ALPHA_PLAYER_ACHIEVEMENT_ID);
  const previousProgress = existing?.progress ?? 0;
  const previousRank = alphaPlayerRankFromProgress(previousProgress);
  const nextProgress = previousProgress + 1;
  let nextRank = alphaPlayerRankFromProgress(nextProgress);

  if (nextRank === 4 && previousRank < 4) {
    const claim = await tryClaimAlphaPlayerRank4Slot(timestamp);
    if (!claim.claimed) {
      nextRank = 3;
    }
  }

  const updated = {
    achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
    playerId,
    rank: nextRank,
    progress: nextProgress,
    updatedAt: timestamp,
    unlockedAt: existing?.unlockedAt ?? (nextRank >= 1 ? timestamp : undefined),
  };

  await saveAchievementProgress(updated);

  if (nextRank > previousRank) {
    const rankDefinition = alphaPlayerRankDefinition(nextRank);
    await recordAchievementUnlockedEvent(playerId, {
      achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
      rank: nextRank,
      rankTitle: rankDefinition?.title ?? `Rank ${nextRank}`,
    });
  }
}
