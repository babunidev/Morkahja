import { assetUrl } from '../../assetUrl.js';
export const GAME_UI_ROOT = assetUrl('/UI/09_GAME');

export const GAME_FOOTER_BUTTONS: ReadonlyArray<{
  alt: string;
  src: string;
  target?: 'skillbook' | 'inventory';
}> = [
  { alt: 'Get help', src: `${GAME_UI_ROOT}/im_button_gethelp.webp` },
  { alt: 'Inventory', src: `${GAME_UI_ROOT}/im_button_inventory.webp`, target: 'inventory' },
  { alt: 'Lore', src: `${GAME_UI_ROOT}/im_button_lore.webp` },
  { alt: 'Skillbook', src: `${GAME_UI_ROOT}/im_button_skillbook.webp`, target: 'skillbook' },
];

export const GAME_FOCUS_BUTTON_ICONS = {
  lore: `${GAME_UI_ROOT}/im_button_lore.webp`,
  inventory: `${GAME_UI_ROOT}/im_button_inventory.webp`,
  skillbook: `${GAME_UI_ROOT}/im_button_skillbook.webp`,
  avatar_details: `${GAME_UI_ROOT}/im_button_inventory.webp`,
} as const;
