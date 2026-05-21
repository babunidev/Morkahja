import type { GameEvent } from '../events/GameEvent.js';

const SCRIBES_ENCOUNTER_OUTCOMES = new Set(['misery', 'prosperity']);

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isEncounterOutcomeVisible(payload: Record<string, unknown>): boolean {
  const outcome = readString(payload, 'outcome')?.toLowerCase();
  return outcome !== undefined && SCRIBES_ENCOUNTER_OUTCOMES.has(outcome);
}

function isLootVisible(payload: Record<string, unknown>): boolean {
  return readNumber(payload, 'rewardType') === 3;
}

/** Which persisted events appear in the Scribes overlay (all events are still stored). */
export function isVisibleInScribesFeed(event: GameEvent, viewingPlayerId?: string): boolean {
  switch (event.type) {
    case 'avatar_created':
    case 'level_up':
    case 'avatar_died':
      return true;
    case 'encounter_resolved':
    case 'encounter_failed':
      return isEncounterOutcomeVisible(event.payload);
    case 'item_obtained':
    case 'spell_obtained':
      return isLootVisible(event.payload);
    case 'gems_received':
      return !viewingPlayerId || event.playerId === viewingPlayerId;
    case 'achievement_unlocked':
    case 'daily_reward_claimed':
      return !viewingPlayerId || event.playerId === viewingPlayerId;
    default:
      return false;
  }
}
