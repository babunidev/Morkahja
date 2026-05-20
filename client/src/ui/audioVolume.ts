export const MUSIC_ENABLED_STORAGE_KEY = 'morkahja.music.enabled';
export const MUSIC_VOLUME_STORAGE_KEY = 'morkahja.music.volume';
export const SFX_VOLUME_STORAGE_KEY = 'morkahja.sfx.volume';

const DEFAULT_MUSIC_VOLUME = 0.58;
const DEFAULT_SFX_VOLUME = 0.58;

export function storedMusicEnabled(): boolean {
  return window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== 'false';
}

export function storedMusicVolume(): number {
  const parsed = Number(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY));
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : DEFAULT_MUSIC_VOLUME;
}

/** Audible gain from the music slider (squared curve). */
export function playbackVolume(sliderVolume: number): number {
  return sliderVolume * sliderVolume;
}

export function storedSfxVolume(): number {
  const parsed = Number(window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY));
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : DEFAULT_SFX_VOLUME;
}

/** Effective gain for sound effects from the SFX slider. */
export function resolveSfxVolume(): number {
  return playbackVolume(storedSfxVolume());
}
