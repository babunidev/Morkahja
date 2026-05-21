import type { AvatarRace, AvatarRole } from '@shared/contracts';

const AMBIENT_VARIANT_SUFFIXES = ['a'] as const;

/** Base in-game ambient pool; always included when entering the game. */
export const DEFAULT_AMBIENT_TRACKS = 'abcde'
  .split('')
  .map((suffix) => `/UI/Music/menu_ambient_${suffix}.mp3`);

const RACES_WITH_AMBIENT: readonly AvatarRace[] = ['Rokur', 'Verdani', 'Aevis', 'Grimnir'];
const ROLES_WITH_AMBIENT: readonly AvatarRole[] = ['Mage', 'Warrior', 'Rogue'];

function tracksForAmbientKey(key: string): string[] {
  return AMBIENT_VARIANT_SUFFIXES.map(
    (suffix) => `/UI/Music/Morkahja_Ambient_${key}_${suffix}.mp3`,
  );
}

export function ambientPlaylistForAvatar(
  race?: AvatarRace | null,
  role?: AvatarRole | null,
): string[] {
  const tracks = [...DEFAULT_AMBIENT_TRACKS];

  if (race && RACES_WITH_AMBIENT.includes(race)) {
    tracks.push(...tracksForAmbientKey(race));
  }

  if (role && ROLES_WITH_AMBIENT.includes(role)) {
    tracks.push(...tracksForAmbientKey(role));
  }

  return [...new Set(tracks)];
}
