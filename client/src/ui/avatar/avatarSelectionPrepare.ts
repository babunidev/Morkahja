import { fetchAvatars } from '../../api/http.js';
import { preloadAvatarSelectionAssets } from './avatarPreload.js';
import type { PersistedAvatar } from '../../api/http.js';

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

/** Fetch list + warm portrait/frame and dashboard chrome assets. */
export async function prepareAvatarSelection(): Promise<PersistedAvatar[]> {
  const avatars = await fetchAvatarSelectionList();
  await preloadAvatarSelectionAssets(avatars);
  return avatars;
}

export interface RefreshAvatarSelectionAfterHomeResult {
  avatars: PersistedAvatar[];
}

/** Home / leave-game: refresh selection cache (fallen avatars stay on the server). */
export async function refreshAvatarSelectionAfterHome(): Promise<RefreshAvatarSelectionAfterHomeResult> {
  const avatars = await prepareAvatarSelection();
  return { avatars };
}
