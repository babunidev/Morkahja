export const GAME_UI_ROOT = '/UI/09_GAME';

export const GAME_FOOTER_BUTTONS = [
  { alt: 'Get help', src: `${GAME_UI_ROOT}/im_button_gethelp.webp` },
  { alt: 'Skillbook', src: `${GAME_UI_ROOT}/im_button_skillbook.webp` },
  { alt: 'Inventory', src: `${GAME_UI_ROOT}/im_button_inventory.webp` },
  { alt: 'Lore', src: `${GAME_UI_ROOT}/im_button_lore.webp` },
] as const;

export const GAME_FOCUS_BUTTON_ICONS = {
  lore: `${GAME_UI_ROOT}/im_button_lore.webp`,
  inventory: `${GAME_UI_ROOT}/im_button_inventory.webp`,
  skillbook: `${GAME_UI_ROOT}/im_button_skillbook.webp`,
} as const;
