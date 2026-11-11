import { resolveSfxVolume } from './audioVolume.js';
import { assetUrl } from '../assetUrl.js';

export const DEFAULT_BUTTON_SOUND = assetUrl('/UI/SFX/sfx_button_press.mp3');
export const CONTINUE_SOUND = assetUrl('/UI/SFX/sfx_continuearrow_press.mp3');
export const DICE_SOUND = assetUrl('/UI/SFX/sfx_dice_press.mp3');
export const LEVEL_UP_SOUND = assetUrl('/UI/SFX/sfx_levelup.mp3');
export const LORE_SOUND = assetUrl('/UI/SFX/sfx_lorebutton_press.mp3');
export const SOLUTION_SOUND = assetUrl('/UI/SFX/sfx_solution_press.mp3');

const activeSounds = new Map<string, HTMLAudioElement>();

function clearActiveSound(src: string, audio: HTMLAudioElement): void {
  if (activeSounds.get(src) === audio) {
    activeSounds.delete(src);
  }
}

export function playSfx(src: string): void {
  const volume = resolveSfxVolume();

  if (volume <= 0) {
    return;
  }

  const current = activeSounds.get(src);
  if (current && !current.ended) {
    return;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  activeSounds.set(src, audio);

  const release = (): void => {
    clearActiveSound(src, audio);
  };

  audio.addEventListener('ended', release, { once: true });
  audio.addEventListener('error', release, { once: true });

  void audio.play().catch(() => {
    release();
  });
}
