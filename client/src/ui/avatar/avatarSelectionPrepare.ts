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

export async function purgeDeadAvatarsOnServer(): Promise<void> {
  const deadAvatarIds = loadDeadAvatarIds();

  if (deadAvatarIds.length === 0) {
    return;
  }

  await Promise.allSettled(deadAvatarIds.map((avatarId) => deleteAvatar(avatarId)));
  clearDeadAvatarIds();
}

/** Fetch list + warm portrait/frame and dashboard chrome assets. */
export async function prepareAvatarSelection(): Promise<PersistedAvatar[]> {
  const avatars = await fetchAvatarSelectionList();
  await preloadAvatarSelectionAssets(avatars);
  return avatars;
}

/** Home / leave-game: delete dead avatars server-side, then refresh selection cache. */
export async function refreshAvatarSelectionAfterHome(): Promise<PersistedAvatar[]> {
  await purgeDeadAvatarsOnServer();
  return prepareAvatarSelection();
}
