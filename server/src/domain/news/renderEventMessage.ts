import type { GameEvent } from '../events/GameEvent.js';

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

function formatArticle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    return 'a new rank';
  }

  const article = /^[aeiou]/i.test(normalized) ? 'an' : 'a';
  return `${article} ${normalized}`;
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

export function renderEventMessage(event: GameEvent): string {
  const payload = event.payload;

  switch (event.type) {
    case 'avatar_created':
      return `${avatarLabel(payload)} joined the world as a ${readString(payload, 'race') ?? 'mysterious'} ${readString(payload, 'role') ?? 'traveler'}.`;
    case 'encounter_started':
      return `${avatarLabel(payload)} entered ${encounterLabel(payload)}.`;
    case 'encounter_resolved': {
      const outcome = readString(payload, 'outcome');
      const success = payload.success === true;
      const base = `${avatarLabel(payload)} ${outcomeVerb(outcome, success)} ${encounterLabel(payload)}.`;
      if (outcome?.toLowerCase() === 'prosperity') {
        return `${base}${formatEncounterRewardSuffix(payload)}`;
      }
      return base;
    }
    case 'encounter_failed':
      return `${avatarLabel(payload)} failed against ${encounterLabel(payload)}.`;
    case 'level_up': {
      const level = readNumber(payload, 'level');
      return level !== undefined
        ? `${avatarLabel(payload)} reached level ${level}.`
        : `${avatarLabel(payload)} reached a new level.`;
    }
    case 'avatar_died':
      return `${avatarLabel(payload)} entered Atranor. The gods decide their fate`;
    case 'item_obtained': {
      const itemName = readString(payload, 'solutionName') ?? 'a treasure';
      return `${avatarLabel(payload)} claimed ${itemName}.`;
    }
    case 'spell_obtained': {
      const spellName = readString(payload, 'solutionName') ?? 'a spell';
      return `${avatarLabel(payload)} learned ${spellName}.`;
    }
    case 'gems_received': {
      const amount = readNumber(payload, 'amount') ?? 1;
      const gemLabel = amount === 1 ? 'yellow red gem' : 'yellow red gems';
      return `${playerLabel(payload)} received ${amount} ${gemLabel}.`;
    }
    case 'gems_donated': {
      const amount = readNumber(payload, 'amount') ?? 1;
      const gemLabel = amount === 1 ? 'yellow red gem' : 'yellow red gems';
      return `${playerLabel(payload)} donated ${amount} ${gemLabel} to the team.`;
    }
    case 'achievement_unlocked': {
      const rankTitle = readString(payload, 'rankTitle') ?? 'a new rank';
      return `${playerLabel(payload)} became ${formatArticle(rankTitle)}.`;
    }
    case 'daily_reward_claimed': {
      const amount = readNumber(payload, 'gemAmount') ?? 1;
      const gemLabel = amount === 1 ? 'yellow red gem' : 'yellow red gems';
      return `${playerLabel(payload)} claimed the daily reward (${amount} ${gemLabel}).`;
    }
    default:
      return `${avatarLabel(payload)} made their mark on the world.`;
  }
}
