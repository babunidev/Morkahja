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
  excludedAvatarIds: string[],
): number {
  const excluded = new Set(excludedAvatarIds);
  const living = avatars.filter((avatar) => !excluded.has(avatar.id));

  for (let index = 0; index < 3; index += 1) {
    if (!living[index]) {
      return index;
    }
  }

  return Math.min(living.length, 2);
}
