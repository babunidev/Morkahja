export const MUSIC_ENABLED_STORAGE_KEY = 'morkahja.music.enabled';
export const MUSIC_VOLUME_STORAGE_KEY = 'morkahja.music.volume';
export const SFX_VOLUME_STORAGE_KEY = 'morkahja.sfx.volume';

export const DEFAULT_MUSIC_VOLUME = 0.3;
export const DEFAULT_SFX_VOLUME = 0.3;

function readStoredVolume(storageKey: string, fallback: number): number {
  const raw = window.localStorage.getItem(storageKey);

  if (raw === null || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : fallback;
}

export function seedDefaultAudioVolumesIfUnset(): void {
  if (window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY) === null) {
    window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(DEFAULT_MUSIC_VOLUME));
  }

  if (window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY) === null) {
    window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(DEFAULT_SFX_VOLUME));
  }
}

export function storedMusicEnabled(): boolean {
  return window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== 'false';
}

export function storedMusicVolume(): number {
  return readStoredVolume(MUSIC_VOLUME_STORAGE_KEY, DEFAULT_MUSIC_VOLUME);
}

/** Audible gain from the music slider (squared curve). */
export function playbackVolume(sliderVolume: number): number {
  return sliderVolume * sliderVolume;
}

export function storedSfxVolume(): number {
  return readStoredVolume(SFX_VOLUME_STORAGE_KEY, DEFAULT_SFX_VOLUME);
}

/** Effective gain for sound effects from the SFX slider. */
export function resolveSfxVolume(): number {
  return playbackVolume(storedSfxVolume());
}
