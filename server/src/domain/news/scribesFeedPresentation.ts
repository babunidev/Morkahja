import type { GameEvent } from '../events/GameEvent.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const DEATH_ICON = '/UI/09_GAME/im_overlay_death.webp';
const LEVEL_UP_ICON = '/UI/09_GAME/im_button_resurrect.webp';

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function resolveScribesIconUrl(event: GameEvent): string | undefined {
  const payload = event.payload;

  switch (event.type) {
    case 'avatar_died':
      return DEATH_ICON;
    case 'level_up':
      return LEVEL_UP_ICON;
    case 'item_obtained':
    case 'spell_obtained': {
      const iconName = readString(payload, 'solutionIconName');
      return iconName ? `${SOLUTION_IMAGE_ROOT}/${iconName}.webp` : undefined;
    }
    default:
      return undefined;
  }
}
