import type { GameEvent } from '../events/GameEvent.js';
import { formatAchievementUnlockMessage } from '@shared/achievementUnlockMessage.js';

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function formatEncounterRewardSuffix(payload: Record<string, unknown>): string {
  const rewardNames = readStringArray(payload, 'rewardNames');
  if (rewardNames.length === 0) {
    return '';
  }

  if (rewardNames.length === 1) {
    return ` Reward: ${rewardNames[0]}.`;
  }

  return ` Rewards: ${rewardNames.join(', ')}.`;
}

function avatarLabel(payload: Record<string, unknown>): string {
  return readString(payload, 'avatarName') ?? 'An adventurer';
}

function playerLabel(payload: Record<string, unknown>): string {
  return readString(payload, 'playerName') ?? 'Player';
}

function encounterLabel(payload: Record<string, unknown>): string {
  const title = readString(payload, 'encounterTitle');
  const encounterId = readNumber(payload, 'encounterId');

  if (title) {
    return title;
  }

  if (encounterId !== undefined) {
    return `Encounter ${encounterId}`;
  }

  return 'an encounter';
}

function outcomeVerb(outcome: string | undefined, success: boolean | undefined): string {
  if (success === false) {
    return 'was overcome by';
  }

  switch (outcome?.toLowerCase()) {
    case 'prosperity':
      return 'triumphed over';
    case 'fortune':
      return 'prevailed against';
    case 'hardship':
      return 'endured';
    case 'misery':
      return 'survived';
    case 'disengage':
      return 'withdrew from';
    default:
      return success ? 'resolved' : 'faced';
  }
}

function gemCount(amount: number): string {
  return `${amount} Yellow Red ${amount === 1 ? 'Gem' : 'Gems'}`;
}

/**
 * The Scribes' line for an event. `viewingPlayerId` is the reader: their own
 * entries are told to them ("You …"); without a reader (the admin console)
 * every entry is told in the third person. Game moments name the avatar,
 * account matters (achievements, gems, purchases, the Hearth Blessing) the
 * player.
 */
export function renderEventMessage(event: GameEvent, viewingPlayerId?: string): string {
  const payload = event.payload;
  const own = viewingPlayerId !== undefined && event.playerId === viewingPlayerId;

  switch (event.type) {
    case 'avatar_created':
      return `${avatarLabel(payload)} joined the world as a ${readString(payload, 'race') ?? 'mysterious'} ${readString(payload, 'role') ?? 'traveler'}.`;
    case 'encounter_resolved': {
      const outcome = readString(payload, 'outcome')?.toLowerCase();
      const label = encounterLabel(payload);
      const avatar = avatarLabel(payload);
      if (outcome === 'prosperity') {
        return `${avatar} triumphed at ${label}.${formatEncounterRewardSuffix(payload)}`;
      }
      if (outcome === 'misery') {
        return `${avatar} failed at ${label}.`;
      }
      const success = payload.success === true;
      return `${avatar} ${outcomeVerb(outcome, success)} ${label}.`;
    }
    case 'encounter_failed':
      return `${avatarLabel(payload)} failed at ${encounterLabel(payload)}.`;
    case 'level_up': {
      const level = readNumber(payload, 'level');
      return level !== undefined
        ? `${avatarLabel(payload)} reached level ${level}.`
        : `${avatarLabel(payload)} reached a new level.`;
    }
    case 'avatar_died':
      if (payload.pendingDeathEncounter === true) {
        return `${avatarLabel(payload)} entered Atranor. The gods decide their fate.`;
      }
      return `${avatarLabel(payload)} didn't receive the blessing of the gods.`;
    case 'item_obtained': {
      const itemName = readString(payload, 'solutionName') ?? 'a treasure';
      return `${avatarLabel(payload)} claimed ${itemName}.`;
    }
    case 'gems_received': {
      const amount = readNumber(payload, 'amount') ?? 1;
      return own
        ? `You received ${gemCount(amount)}.`
        : `${playerLabel(payload)} received ${gemCount(amount)}.`;
    }
    case 'gems_donated': {
      const amount = readNumber(payload, 'amount') ?? 1;
      return own
        ? `You gave ${gemCount(amount)} to Babuni. Thank you, it helps a lot!`
        : `${playerLabel(payload)} gave ${gemCount(amount)} to Babuni.`;
    }
    case 'support_purchase': {
      const itemLabel = readString(payload, 'itemLabel') ?? 'new content';
      return own
        ? `You unlocked ${itemLabel} and supported Morkahja. Thank you: it gives me more time for this world!`
        : `${playerLabel(payload)} unlocked ${itemLabel} and supported Morkahja.`;
    }
    case 'account_key_security_reminder': {
      const filename = readString(payload, 'recoveryKeyFilename') ?? 'your key file';
      const itemLabel = readString(payload, 'itemLabel');
      const unlockNote = itemLabel ? ` You just unlocked ${itemLabel}.` : '';
      return `Keep your key safe.${unlockNote} Save ${filename} somewhere secure: your key is your journey, and without it nothing can be restored.`;
    }
    case 'support_appreciation_nudge':
      return 'Enjoying Morkahja? Donating gems, unlocking an expansion or picking up a dice skin gives me more time to work on the world. Every bit helps. Thank you!';
    case 'achievement_unlocked': {
      const rankTitle = readString(payload, 'rankTitle');
      return own
        ? formatAchievementUnlockMessage(rankTitle, 'self')
        : formatAchievementUnlockMessage(rankTitle, 'public', playerLabel(payload));
    }
    case 'hearth_blessing_ready': {
      const encountersRequired = readNumber(payload, 'encountersRequired') ?? 42;
      return own
        ? `Your Hearth Blessing is full after ${encountersRequired} encounters. It is ready to claim.`
        : `${playerLabel(payload)} filled the Hearth Blessing (${encountersRequired} encounters). It is ready to claim.`;
    }
    case 'daily_reward_claimed':
      return own
        ? 'You claimed the Hearth Blessing.'
        : `${playerLabel(payload)} claimed the Hearth Blessing.`;
    case 'help_requested':
      return `${avatarLabel(payload)} calls out for help.`;
    case 'adventure_started':
      return `${avatarLabel(payload)} sets out on an adventure.`;
    case 'room_encounter_started':
      return `${avatarLabel(payload)} encounters ${encounterLabel(payload)}.`;
    default:
      return `${avatarLabel(payload)} made their mark on the world.`;
  }
}
