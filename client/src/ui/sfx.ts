import { resolveSfxVolume } from './audioVolume.js';
import { assetUrl } from '../assetUrl.js';
import { releaseWorkingVolume, withWorkingVolume } from './audioGain.js';

export const DEFAULT_BUTTON_SOUND = assetUrl('/UI/SFX/sfx_button_press.mp3');
export const CONTINUE_SOUND = assetUrl('/UI/SFX/sfx_continuearrow_press.mp3');
export const DICE_SOUND = assetUrl('/UI/SFX/sfx_dice_press.mp3');
export const LEVEL_UP_SOUND = assetUrl('/UI/SFX/sfx_levelup.mp3');
/** Played for everyone in the room when an avatar enters Atranor (Babuni, 2026-11-23). */
export const ATRANOR_SOUND = assetUrl('/UI/SFX/atranor.mp3');
export const LORE_SOUND = assetUrl('/UI/SFX/sfx_lorebutton_press.mp3');
export const BACKPACK_SOUND = assetUrl('/UI/SFX/backpack.mp3');
export const SKILLBOOK_SOUND = assetUrl('/UI/SFX/skillbook.mp3');
export const CALL_FOR_HELP_SOUND = assetUrl('/UI/SFX/callforhelp.mp3');
/** One of eight solution clicks, chosen at random. */
export const SOLUTION_SOUNDS = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
  assetUrl(`/UI/SFX/solution${index}.mp3`)
));

/** Solution lines sit another tenth under the other effects. */
export const SOLUTION_PLAYBACK_SCALE = 0.9;

/** Reward lines sit a tenth under the other effects. */
export const REWARD_PLAYBACK_SCALE = 0.9;

/** Inventory, the skillbook and lore play at nine tenths of the volume they had. */
export const FOOTER_MENU_PLAYBACK_SCALE = 0.9;

/** Makaya, taking an item, a non-deity essence, or the lore gem. One is chosen at random. */
export const ADD_ITEM_SOUNDS = [1, 2, 3].map((index) => assetUrl(`/UI/SFX/addItem${index}.mp3`));

/**
 * Makaya, picking up a skill. One of the three is chosen at random; Babuni kept
 * lines 1, 2 and 4 of the ten and removed the others (2026-11-23).
 */
export const ADD_SKILL_SOUNDS = [1, 2, 4].map((index) => assetUrl(`/UI/SFX/addSkill${index}.mp3`));

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

export function playSfx(src: string, options?: { overlap?: boolean; scale?: number }): void {
  const volume = Math.min(1, Math.max(0, resolveSfxVolume() * (options?.scale ?? 1)));

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

  const audio = withWorkingVolume(new Audio(src));
  audio.volume = volume;
  const disconnect = (): void => releaseWorkingVolume(audio);
  audio.addEventListener('ended', disconnect, { once: true });
  audio.addEventListener('error', disconnect, { once: true });
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
    disconnect();
    if (!overlap) {
      release();
    }
  });
}

/** `random` is in `[0, 1)`, as from `Math.random`. */
export function pickSolutionSound(random: () => number = Math.random): string {
  const index = Math.min(SOLUTION_SOUNDS.length - 1, Math.max(0, Math.floor(random() * SOLUTION_SOUNDS.length)));
  return SOLUTION_SOUNDS[index]!;
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
  playSfx(rewardVoice(inventoryType, solutionId), { overlap: true, scale: REWARD_PLAYBACK_SCALE });
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
