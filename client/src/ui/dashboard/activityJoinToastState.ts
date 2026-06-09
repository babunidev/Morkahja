const STORAGE_KEY_PREFIX = 'morkahja.activityJoinToastsShown';

const ROOM_START_JOIN_TOAST_EVENT_TYPES = new Set([
  'adventure_started',
]);

const HELP_JOIN_TOAST_EVENT_TYPES = new Set([
  'help_requested',
  'help_called',
]);

export function isActivityJoinToastCandidate(entry: {
  eventType: string;
  joinAction?: unknown;
  notifyFriendJoinToast?: boolean;
}): boolean {
  if (ROOM_START_JOIN_TOAST_EVENT_TYPES.has(entry.eventType)) {
    return entry.joinAction != null && entry.notifyFriendJoinToast === true;
  }

  return HELP_JOIN_TOAST_EVENT_TYPES.has(entry.eventType) && entry.joinAction != null;
}

/** Mark every current feed join entry seen so we only toast events that arrive later. */
export function seedActivityJoinToastsSeen<
  T extends {
    eventId: string;
    eventType: string;
    joinAction?: unknown;
    notifyFriendJoinToast?: boolean;
  },
>(playerId: string, entries: T[]): void {
  for (const entry of entries) {
    if (isActivityJoinToastCandidate(entry)) {
      markActivityJoinToastShown(playerId, entry.eventId);
    }
  }
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

export function markActivityJoinToastShown(playerId: string, eventId: string): void {
  if (!playerId || !eventId) {
    return;
  }

  const ids = loadShownToastIds(playerId);
  ids.add(eventId);
  saveShownToastIds(playerId, ids);
}

export function hasShownActivityJoinToast(playerId: string, eventId: string): boolean {
  return loadShownToastIds(playerId).has(eventId);
}

export function findNextRoomStartJoinToastEntry<
  T extends {
    eventId: string;
    eventType: string;
    message: string;
    joinAction?: unknown;
    notifyFriendJoinToast?: boolean;
  },
>(playerId: string, entries: T[]): T | null {
  for (const entry of entries) {
    if (!ROOM_START_JOIN_TOAST_EVENT_TYPES.has(entry.eventType)) {
      continue;
    }

    if (!entry.joinAction) {
      continue;
    }

    if (!entry.notifyFriendJoinToast) {
      continue;
    }

    if (hasShownActivityJoinToast(playerId, entry.eventId)) {
      continue;
    }

    return entry;
  }

  return null;
}

export function findNextHelpJoinToastEntry<
  T extends {
    eventId: string;
    eventType: string;
    message: string;
    joinAction?: unknown;
  },
>(playerId: string, entries: T[]): T | null {
  for (const entry of entries) {
    if (!HELP_JOIN_TOAST_EVENT_TYPES.has(entry.eventType)) {
      continue;
    }

    if (!entry.joinAction) {
      continue;
    }

    if (hasShownActivityJoinToast(playerId, entry.eventId)) {
      continue;
    }

    return entry;
  }

  return null;
}
