import type { AchievementsResponse } from '@shared/contracts';

const STORAGE_KEY_PREFIX = 'morkahja.achievementsSeen';

interface AchievementsSeenSnapshot {
  progress: number;
  dailyEncountersPlayed: number;
  utcDay: string;
  claimable: boolean;
}

function storageKey(playerId: string): string {
  return `${STORAGE_KEY_PREFIX}.${playerId}`;
}

function snapshotFromResponse(response: AchievementsResponse): AchievementsSeenSnapshot {
  const progress = response.achievements.reduce(
    (max, entry) => Math.max(max, entry.progress),
    0,
  );

  return {
    progress,
    dailyEncountersPlayed: response.dailyReward.encountersPlayed,
    utcDay: response.dailyReward.utcDay,
    claimable: response.dailyReward.claimable,
  };
}

export function loadAchievementsSeenSnapshot(
  playerId: string,
): AchievementsSeenSnapshot | null {
  if (!playerId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AchievementsSeenSnapshot>;
    if (
      typeof parsed.progress !== 'number'
      || typeof parsed.dailyEncountersPlayed !== 'number'
      || typeof parsed.utcDay !== 'string'
      || typeof parsed.claimable !== 'boolean'
    ) {
      return null;
    }

    return {
      progress: parsed.progress,
      dailyEncountersPlayed: parsed.dailyEncountersPlayed,
      utcDay: parsed.utcDay,
      claimable: parsed.claimable,
    };
  } catch {
    return null;
  }
}

export function markAchievementsSeen(
  playerId: string,
  response: AchievementsResponse,
): void {
  if (!playerId) {
    return;
  }

  window.localStorage.setItem(
    storageKey(playerId),
    JSON.stringify(snapshotFromResponse(response)),
  );
}

export function hasUnseenAchievements(
  playerId: string,
  response: AchievementsResponse,
): boolean {
  if (!playerId) {
    return false;
  }

  const current = snapshotFromResponse(response);
  const seen = loadAchievementsSeenSnapshot(playerId);

  if (!seen) {
    return (
      current.progress > 0
      || current.dailyEncountersPlayed > 0
      || current.claimable
    );
  }

  if (current.progress > seen.progress) {
    return true;
  }

  if (current.utcDay !== seen.utcDay && current.dailyEncountersPlayed > 0) {
    return true;
  }

  if (
    current.utcDay === seen.utcDay
    && current.dailyEncountersPlayed > seen.dailyEncountersPlayed
  ) {
    return true;
  }

  if (current.claimable && !seen.claimable) {
    return true;
  }

  return false;
}
