import { resolveSfxVolume } from './audioVolume.js';
import { assetUrl } from '../assetUrl.js';

export const DEFAULT_BUTTON_SOUND = assetUrl('/UI/SFX/sfx_button_press.mp3');
export const CONTINUE_SOUND = assetUrl('/UI/SFX/sfx_continuearrow_press.mp3');
export const DICE_SOUND = assetUrl('/UI/SFX/sfx_dice_press.mp3');
export const LEVEL_UP_SOUND = assetUrl('/UI/SFX/sfx_levelup.mp3');
export const LORE_SOUND = assetUrl('/UI/SFX/sfx_lorebutton_press.mp3');
export const SOLUTION_SOUND = assetUrl('/UI/SFX/sfx_solution_press.mp3');

/** Makaya, taking an item, a non-deity essence, or the lore gem. One is chosen at random. */
export const ADD_ITEM_SOUNDS = [1, 2, 3].map((index) => assetUrl(`/UI/SFX/addItem${index}.mp3`));

/** Makaya, picking up a skill. One of the ten is chosen at random. */
export const ADD_SKILL_SOUNDS = Array.from({ length: 10 }, (_, index) => (
  assetUrl(`/UI/SFX/addSkill${index + 1}.mp3`)
));

/** Makaya, losing an essence. One of the four is chosen at random. The files keep the supplied spelling. */
export const LOSE_ESSENCE_SOUNDS = [1, 2, 3, 4].map((index) => assetUrl(`/UI/SFX/looseEssence${index}.mp3`));

/**
 * One line per god, keyed by the essence's solution id.
 * Those ids stay with the essence, so the sound follows the id.
 * The god is the name in the essence title.
 */
export const ESSENCE_DEITY_SOUNDS: Readonly<Record<number, string>> = {
  10010: assetUrl('/UI/SFX/essenceAeriel.mp3'), // Aeriel's Soar
  10011: assetUrl('/UI/SFX/essenceAetheria.mp3'), // Aetheria's Star
  10026: assetUrl('/UI/SFX/essenceOrdius.mp3'), // Ordius Balance
  10027: assetUrl('/UI/SFX/essenceFerrumis.mp3'), // Ferrumis Sturdiness
  10036: assetUrl('/UI/SFX/essenceUmbrael.mp3'), // Umbrael's Beyond
  10037: assetUrl('/UI/SFX/essenceStonara.mp3'), // Stonara's Might
  10038: assetUrl('/UI/SFX/essenceSolriel.mp3'), // Solriel's Radiance
  10039: assetUrl('/UI/SFX/essenceKhaotys.mp3'), // Khaotys Whirlwind
  10040: assetUrl('/UI/SFX/essenceFyraan.mp3'), // Fyraan's Flame
  10122: assetUrl('/UI/SFX/essenceNereval.mp3'), // Nereval's Flow
  10123: assetUrl('/UI/SFX/essenceSylvanus.mp3'), // Sylvanus Seed
  10244: assetUrl('/UI/SFX/essenceAerisara.mp3'), // Aerisara's Breath
};

const ESSENCE_INVENTORY_TYPE = 3;

const activeSounds = new Map<string, HTMLAudioElement>();

function clearActiveSound(src: string, audio: HTMLAudioElement): void {
  if (activeSounds.get(src) === audio) {
    activeSounds.delete(src);
  }
}

export function playSfx(src: string, options?: { overlap?: boolean }): void {
  const volume = resolveSfxVolume();

  if (volume <= 0) {
    return;
  }

  const overlap = options?.overlap === true;
  if (!overlap) {
    const current = activeSounds.get(src);
    if (current && !current.ended) {
      return;
    }
  }

  const audio = new Audio(src);
  audio.volume = volume;
  if (!overlap) {
    activeSounds.set(src, audio);
  }

  const release = (): void => {
    clearActiveSound(src, audio);
  };

  if (!overlap) {
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
  }

  void audio.play().catch(() => {
    if (!overlap) {
      release();
    }
  });
}

/** `random` is in `[0, 1)`, as from `Math.random`. */
export function pickPickupSound(kind: 'item' | 'skill', random: () => number = Math.random): string {
  const pool = kind === 'skill' ? ADD_SKILL_SOUNDS : ADD_ITEM_SOUNDS;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index]!;
}

/** Skillbook rewards are inventory type 1. Everything else taken as a reward uses the item lines. */
export function rewardPickupKind(inventoryType: number): 'item' | 'skill' {
  return inventoryType === 1 ? 'skill' : 'item';
}

/** A deity essence speaks its own line. Every other reward uses the item or skill set. */
export function rewardVoice(
  inventoryType: number,
  solutionId: number,
  random: () => number = Math.random,
): string {
  return ESSENCE_DEITY_SOUNDS[solutionId] ?? pickPickupSound(rewardPickupKind(inventoryType), random);
}

export function playRewardPickupSound(inventoryType: number, solutionId: number): void {
  playSfx(rewardVoice(inventoryType, solutionId), { overlap: true });
}

const ESSENCE_SOLUTION_TYPE = 15;

/** `random` is in `[0, 1)`, as from `Math.random`. Only a real essence (type 15) has a loss line. */
export function pickLossSound(
  inventoryType: number,
  solutionType: number,
  random: () => number = Math.random,
): string | null {
  if (inventoryType !== ESSENCE_INVENTORY_TYPE || solutionType !== ESSENCE_SOLUTION_TYPE) {
    return null;
  }
  const index = Math.min(
    LOSE_ESSENCE_SOUNDS.length - 1,
    Math.max(0, Math.floor(random() * LOSE_ESSENCE_SOUNDS.length)),
  );
  return LOSE_ESSENCE_SOUNDS[index]!;
}

export function playLossSound(inventoryType: number, solutionType: number): boolean {
  const src = pickLossSound(inventoryType, solutionType);
  if (!src) {
    return false;
  }
  playSfx(src, { overlap: true });
  return true;
}
