import type { GameEvent } from '../events/GameEvent.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const DEATH_ICON = '/UI/09_GAME/im_overlay_death.webp';
const SCRIBES_FAIL_ICON = '/UI/06_SettingsMenu/No.webp';
const ATRANOR_SYMBOL_ICON = `${SOLUTION_IMAGE_ROOT}/tool_epic_atranor_potion.webp`;
const LEVEL_UP_ICON = '/UI/09_GAME/im_button_resurrect.webp';
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';
const ADVENTURER_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_daily_reward.webp';
const ALPHA_PLAYER_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_alphaplayer.webp';
const CONTRIBUTOR_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_donator.webp';
const BLESSED_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_lucker.webp';
const COMBATANT_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_combatant.webp';
const TRICKSTER_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_trickster.webp';
const HELPER_ACHIEVEMENT_ICON = '/UI/04_ACHIEVEMENTS/im_glyph_helper.webp';

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function resolveScribesAvatarVisual(
  event: GameEvent,
): { portrait: string; frame: string } | undefined {
  if (event.type !== 'avatar_created') {
    return undefined;
  }

  const payload = event.payload;
  const portrait = readString(payload, 'avatarPortrait');
  const frame = readString(payload, 'avatarFrame');

  if (!portrait || !frame) {
    return undefined;
  }

  return { portrait, frame };
}

export function resolveScribesIconUrl(event: GameEvent): string | undefined {
  const payload = event.payload;

  switch (event.type) {
    case 'avatar_died': {
      const symbolIconName = readString(payload, 'symbolIconName');
      if (symbolIconName) {
        return `${SOLUTION_IMAGE_ROOT}/${symbolIconName}.webp`;
      }

      const encounterId = readNumber(payload, 'encounterId');
      const encounterTitle = readString(payload, 'encounterTitle')?.toLowerCase();
      if (encounterId === 1 || encounterTitle === 'atranor') {
        return ATRANOR_SYMBOL_ICON;
      }

      return DEATH_ICON;
    }
    case 'encounter_failed':
      return SCRIBES_FAIL_ICON;
    case 'level_up':
      return LEVEL_UP_ICON;
    case 'gems_received':
    case 'gems_donated':
    case 'daily_reward_claimed':
      return GEMS_ICON;
    case 'achievement_unlocked': {
      const achievementId = readString(payload, 'achievementId');
      if (achievementId === 'alpha_player') {
        return ALPHA_PLAYER_ACHIEVEMENT_ICON;
      }
      if (achievementId === 'firestarter') {
        return '/UI/04_ACHIEVEMENTS/im_glyph_created_avatar.webp';
      }
      if (achievementId === 'contributor') {
        return CONTRIBUTOR_ACHIEVEMENT_ICON;
      }
      if (achievementId === 'blessed') {
        return BLESSED_ACHIEVEMENT_ICON;
      }
      if (achievementId === 'combatant') {
        return COMBATANT_ACHIEVEMENT_ICON;
      }
      if (achievementId === 'trickster') {
        return TRICKSTER_ACHIEVEMENT_ICON;
      }
      if (achievementId === 'helper') {
        return HELPER_ACHIEVEMENT_ICON;
      }
      return ADVENTURER_ACHIEVEMENT_ICON;
    }
    case 'encounter_resolved': {
      if (readString(payload, 'outcome')?.toLowerCase() !== 'prosperity') {
        return undefined;
      }
      const rewardIconName = readString(payload, 'rewardIconName');
      return rewardIconName ? `${SOLUTION_IMAGE_ROOT}/${rewardIconName}.webp` : undefined;
    }
    case 'item_obtained':
    case 'spell_obtained': {
      const iconName = readString(payload, 'solutionIconName');
      return iconName ? `${SOLUTION_IMAGE_ROOT}/${iconName}.webp` : undefined;
    }
    default:
      return undefined;
  }
}
