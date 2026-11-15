export const MUSIC_ENABLED_STORAGE_KEY = 'morkahja.music.enabled';
export const MUSIC_VOLUME_STORAGE_KEY = 'morkahja.music.volume';
export const AMBIANCE_ENABLED_STORAGE_KEY = 'morkahja.ambiance.enabled';
export const AMBIANCE_VOLUME_STORAGE_KEY = 'morkahja.ambiance.volume';
export const SFX_VOLUME_STORAGE_KEY = 'morkahja.sfx.volume';

export const DEFAULT_MUSIC_VOLUME = 0.3;
export const DEFAULT_SFX_VOLUME = 0.3;
/** Full, so the quieter bed can sit with the music at the music slider's usual place. */
export const DEFAULT_AMBIANCE_VOLUME = 1;

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

  if (window.localStorage.getItem(AMBIANCE_VOLUME_STORAGE_KEY) === null) {
    window.localStorage.setItem(AMBIANCE_VOLUME_STORAGE_KEY, String(DEFAULT_AMBIANCE_VOLUME));
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

export function storedAmbianceEnabled(): boolean {
  return window.localStorage.getItem(AMBIANCE_ENABLED_STORAGE_KEY) !== 'false';
}

export function storedAmbianceVolume(): number {
  return readStoredVolume(AMBIANCE_VOLUME_STORAGE_KEY, DEFAULT_AMBIANCE_VOLUME);
}

export function storedSfxVolume(): number {
  return readStoredVolume(SFX_VOLUME_STORAGE_KEY, DEFAULT_SFX_VOLUME);
}

/**
 * Every effect plays at nine tenths of the slider.
 * At 53 the effects then sit with the music and the ambiance.
 */
export const SFX_PLAYBACK_SCALE = 0.9;

/** Effective gain for sound effects from the SFX slider. */
export function resolveSfxVolume(): number {
  return playbackVolume(storedSfxVolume()) * SFX_PLAYBACK_SCALE;
}
