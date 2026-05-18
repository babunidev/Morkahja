export const DEFAULT_BUTTON_SOUND = '/UI/SFX/sfx_button_press.mp3';
export const CONTINUE_SOUND = '/UI/SFX/sfx_continuearrow_press.mp3';
export const DICE_SOUND = '/UI/SFX/sfx_dice_press.mp3';
export const LEVEL_UP_SOUND = '/UI/SFX/sfx_levelup.mp3';
export const LORE_SOUND = '/UI/SFX/sfx_lorebutton_press.mp3';
export const SOLUTION_SOUND = '/UI/SFX/sfx_solution_press.mp3';

export function playSfx(src: string): void {
  void new Audio(src).play().catch(() => undefined);
}
