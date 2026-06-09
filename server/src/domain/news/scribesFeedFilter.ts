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
    case 'gems_donated':
    case 'support_purchase':
      return !viewingPlayerId || event.playerId === viewingPlayerId;
    case 'achievement_unlocked':
      return true;
    case 'hearth_blessing_ready':
    case 'account_key_security_reminder':
    case 'support_appreciation_nudge':
      return !viewingPlayerId || event.playerId === viewingPlayerId;
    case 'daily_reward_claimed':
      return true;
    case 'adventure_started':
      return true;
    case 'encounter_started':
      return false;
    case 'help_requested':
      if (!viewingPlayerId) {
        return false;
      }
      return readString(event.payload, 'toPlayerId') === viewingPlayerId;
    case 'room_created':
    case 'room_encounter_started':
    case 'help_called':
      return true;
    default:
      return false;
  }
}
