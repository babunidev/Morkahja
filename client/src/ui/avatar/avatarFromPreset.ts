import type { PersistedAvatar } from '../../api/http.js';

export function buildAvatarFromPreset(
  preset: PersistedAvatar,
  slotIndex: number,
): PersistedAvatar {
  const now = Date.now();

  return {
    id: `avatar-slot-${slotIndex + 1}-${now}`,
    name: preset.name,
    race: preset.race,
    role: preset.role,
    level: 1,
    experience: 0,
    portrait: preset.portrait,
    frame: preset.frame,
    createdAt: now,
    lastPlayedAt: now,
  };
}

export function resolveCreationSlotIndex(
  avatars: PersistedAvatar[],
): number {
  for (let index = 0; index < 3; index += 1) {
    if (!avatars[index]) {
      return index;
    }
  }

  return Math.min(avatars.length, 2);
}
