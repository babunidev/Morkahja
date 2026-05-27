import type { GameEvent, GameEventVisibility } from './GameEvent.js';

export interface QueryRecentEventsOptions {
  playerId?: string;
  friendIds?: string[];
  sinceTimestamp?: number;
  limit?: number;
  visibilities?: GameEventVisibility[];
}

export interface EventStore {
  appendEvent(event: GameEvent): Promise<void>;
  queryRecentEvents(options: QueryRecentEventsOptions): Promise<GameEvent[]>;
}
