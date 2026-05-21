import type { GameEvent } from '../events/GameEvent.js';
import {
  recordAchievementUnlockedEvent,
} from '../../services/gameEventService.js';
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

const ENCOUNTER_PLAYED_EVENT_TYPES = new Set([
  'encounter_resolved',
  'encounter_failed',
]);

export async function handleGameEvent(event: GameEvent): Promise<void> {
  if (!event.playerId || !ENCOUNTER_PLAYED_EVENT_TYPES.has(event.type)) {
    return;
  }

  await recordDailyEncounterPlayed(event.playerId, event.timestamp);
  await processAdventurerEncounterPlayed(event.playerId, event.timestamp);
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
