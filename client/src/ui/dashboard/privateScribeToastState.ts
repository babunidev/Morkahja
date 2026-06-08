const STORAGE_KEY_PREFIX = 'morkahja.scribeToastsShown';

const PRIVATE_SCRIBE_TOAST_EVENT_TYPES = new Set([
  'account_key_security_reminder',
  'support_appreciation_nudge',
  'gems_received',
]);

export function isPrivateScribeToastEvent(eventType: string): boolean {
  return PRIVATE_SCRIBE_TOAST_EVENT_TYPES.has(eventType);
}

function storageKey(playerId: string): string {
  return `${STORAGE_KEY_PREFIX}.${playerId}`;
}

function loadShownToastIds(playerId: string): Set<string> {
  if (!playerId) {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

function saveShownToastIds(playerId: string, ids: Set<string>): void {
  if (!playerId) {
    return;
  }

  window.localStorage.setItem(storageKey(playerId), JSON.stringify([...ids]));
}

export function markPrivateScribeToastShown(playerId: string, eventId: string): void {
  if (!playerId || !eventId) {
    return;
  }

  const ids = loadShownToastIds(playerId);
  ids.add(eventId);
  saveShownToastIds(playerId, ids);
}

export function hasShownPrivateScribeToast(playerId: string, eventId: string): boolean {
  return loadShownToastIds(playerId).has(eventId);
}

export function findNextPrivateScribeToastEntry<
  T extends { eventId: string; eventType: string; message: string },
>(playerId: string, entries: T[]): T | null {
  for (const entry of entries) {
    if (!isPrivateScribeToastEvent(entry.eventType)) {
      continue;
    }

    if (hasShownPrivateScribeToast(playerId, entry.eventId)) {
      continue;
    }

    return entry;
  }

  return null;
}
