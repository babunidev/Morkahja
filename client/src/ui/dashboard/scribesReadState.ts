import type { ActivityFeedEntryDto } from '@shared/contracts';

const STORAGE_KEY_PREFIX = 'morkahja.scribesRead';
const MAX_STORED_READ_IDS = 500;

function storageKey(playerId: string): string {
  return `${STORAGE_KEY_PREFIX}.${playerId}`;
}

export function loadScribesReadIds(playerId: string): Set<string> {
  if (!playerId) {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

export function markScribesEntriesRead(playerId: string, eventIds: string[]): void {
  if (!playerId || eventIds.length === 0) {
    return;
  }

  const readIds = loadScribesReadIds(playerId);
  for (const eventId of eventIds) {
    readIds.add(eventId);
  }

  const trimmed = [...readIds].slice(-MAX_STORED_READ_IDS);
  window.localStorage.setItem(storageKey(playerId), JSON.stringify(trimmed));
}

export function hasUnreadScribes(
  playerId: string,
  entries: ActivityFeedEntryDto[],
): boolean {
  if (!playerId || entries.length === 0) {
    return false;
  }

  const readIds = loadScribesReadIds(playerId);
  return entries.some((entry) => !readIds.has(entry.eventId));
}

export function isScribeEntryRead(playerId: string, eventId: string): boolean {
  return loadScribesReadIds(playerId).has(eventId);
}
