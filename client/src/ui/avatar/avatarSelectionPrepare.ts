import { deleteAvatar, fetchAvatars, type PersistedAvatar } from '../../api/http.js';
import { preloadAvatarSelectionAssets } from './avatarPreload.js';

export const DEAD_AVATAR_IDS_STORAGE_KEY = 'morkahja.deadAvatarIds';

export function loadDeadAvatarIds(): string[] {
  try {
    const value = window.localStorage.getItem(DEAD_AVATAR_IDS_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveDeadAvatarIds(ids: string[]): void {
  window.localStorage.setItem(
    DEAD_AVATAR_IDS_STORAGE_KEY,
    JSON.stringify([...new Set(ids)]),
  );
}

export function clearDeadAvatarIds(): void {
  window.localStorage.removeItem(DEAD_AVATAR_IDS_STORAGE_KEY);
}

export function uniqueAvatars(avatars: PersistedAvatar[]): PersistedAvatar[] {
  const seen = new Set<string>();

  return avatars.filter((avatar) => {
    if (seen.has(avatar.id)) {
      return false;
    }

    seen.add(avatar.id);
    return true;
  });
}

export async function fetchAvatarSelectionList(): Promise<PersistedAvatar[]> {
  return uniqueAvatars(await fetchAvatars());
}

export interface PurgeDeadAvatarsResult {
  purgedIds: string[];
  failedIds: string[];
}

export async function purgeDeadAvatarsOnServer(): Promise<PurgeDeadAvatarsResult> {
  const deadAvatarIds = loadDeadAvatarIds();

  if (deadAvatarIds.length === 0) {
    return { purgedIds: [], failedIds: [] };
  }

  const results = await Promise.allSettled(
    deadAvatarIds.map((avatarId) => deleteAvatar(avatarId)),
  );
  const purgedIds: string[] = [];
  const failedIds: string[] = [];

  results.forEach((result, index) => {
    const avatarId = deadAvatarIds[index];

    if (result.status === 'fulfilled') {
      purgedIds.push(avatarId);
      return;
    }

    failedIds.push(avatarId);
  });

  if (failedIds.length === 0) {
    clearDeadAvatarIds();
  } else {
    saveDeadAvatarIds(failedIds);
  }

  return { purgedIds, failedIds };
}

/** Fetch list + warm portrait/frame and dashboard chrome assets. */
export async function prepareAvatarSelection(): Promise<PersistedAvatar[]> {
  const avatars = await fetchAvatarSelectionList();
  await preloadAvatarSelectionAssets(avatars);
  return avatars;
}

export interface RefreshAvatarSelectionAfterHomeResult {
  avatars: PersistedAvatar[];
  purge: PurgeDeadAvatarsResult;
}

/** Home / leave-game: delete dead avatars server-side, then refresh selection cache. */
export async function refreshAvatarSelectionAfterHome(): Promise<RefreshAvatarSelectionAfterHomeResult> {
  const purge = await purgeDeadAvatarsOnServer();
  const avatars = await prepareAvatarSelection();

  return { avatars, purge };
}
