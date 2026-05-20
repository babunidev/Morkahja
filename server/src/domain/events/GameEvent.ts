export type GameEventVisibility =
  | 'private'
  | 'friends'
  | 'global';

export type GameEventImportance =
  | 'low'
  | 'medium'
  | 'high'
  | 'legendary';

export interface GameEvent {
  eventId: string;
  timestamp: number;
  playerId: string;
  avatarId?: string;
  type: string;
  visibility: GameEventVisibility;
  importance: GameEventImportance;
  payload: Record<string, unknown>;
}

export const ACTIVITY_FEED_WINDOW_MS = 15 * 60 * 1000;
