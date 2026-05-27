import { pool } from './postgresDocumentStore.js';
import type { GameEvent, GameEventVisibility } from '../domain/events/GameEvent.js';
import type { EventStore, QueryRecentEventsOptions } from '../domain/events/eventStore.js';

let gameEventsSchemaReady: Promise<void> | null = null;

export async function ensureGameEventsReady(): Promise<void> {
  gameEventsSchemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS game_events (
      event_id TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      player_id TEXT NOT NULL,
      avatar_id TEXT NULL,
      type TEXT NOT NULL,
      visibility TEXT NOT NULL,
      importance TEXT NOT NULL,
      payload JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS game_events_timestamp_desc_idx
      ON game_events (timestamp DESC);

    CREATE INDEX IF NOT EXISTS game_events_player_id_idx
      ON game_events (player_id);

    CREATE INDEX IF NOT EXISTS game_events_type_idx
      ON game_events (type);

    CREATE INDEX IF NOT EXISTS game_events_visibility_idx
      ON game_events (visibility);
  `).then(() => undefined);

  await gameEventsSchemaReady;
}

function rowToGameEvent(row: {
  event_id: string;
  timestamp: string;
  player_id: string;
  avatar_id: string | null;
  type: string;
  visibility: GameEventVisibility;
  importance: GameEvent['importance'];
  payload: Record<string, unknown>;
}): GameEvent {
  return {
    eventId: row.event_id,
    timestamp: Number(row.timestamp),
    playerId: row.player_id,
    avatarId: row.avatar_id ?? undefined,
    type: row.type,
    visibility: row.visibility,
    importance: row.importance,
    payload: row.payload ?? {},
  };
}

export async function appendGameEvent(event: GameEvent): Promise<void> {
  await ensureGameEventsReady();

  await pool.query(
    `INSERT INTO game_events (
      event_id,
      timestamp,
      player_id,
      avatar_id,
      type,
      visibility,
      importance,
      payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      event.eventId,
      event.timestamp,
      event.playerId,
      event.avatarId ?? null,
      event.type,
      event.visibility,
      event.importance,
      JSON.stringify(event.payload),
    ],
  );
}

export async function queryRecentGameEvents(
  options: QueryRecentEventsOptions,
): Promise<GameEvent[]> {
  await ensureGameEventsReady();

  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const sinceTimestamp = options.sinceTimestamp ?? 0;
  const playerId = options.playerId;
  const friendIds = options.friendIds ?? [];
  const globalVisibility: GameEventVisibility = 'global';
  const params: unknown[] = [sinceTimestamp, globalVisibility];
  let visibilityFilterSql = 'visibility = $2';

  if (playerId) {
    params.push(playerId);
    if (friendIds.length > 0) {
      params.push(friendIds);
      visibilityFilterSql = `(
        visibility = $2
        OR player_id = $3
        OR (
          visibility = 'friends'
          AND (
            player_id = ANY($4::text[])
            OR (type = 'help_requested' AND payload->>'toPlayerId' = $3)
          )
        )
      )`;
    } else {
      visibilityFilterSql = `(
        visibility = $2
        OR player_id = $3
        OR (visibility = 'friends' AND type = 'help_requested' AND payload->>'toPlayerId' = $3)
      )`;
    }
  }

  params.push(limit);

  const result = await pool.query<{
    event_id: string;
    timestamp: string;
    player_id: string;
    avatar_id: string | null;
    type: string;
    visibility: GameEventVisibility;
    importance: GameEvent['importance'];
    payload: Record<string, unknown>;
  }>(
    `SELECT
      event_id,
      timestamp,
      player_id,
      avatar_id,
      type,
      visibility,
      importance,
      payload
    FROM game_events
    WHERE timestamp >= $1
      AND ${visibilityFilterSql}
    ORDER BY timestamp DESC
    LIMIT $${params.length}`,
    params,
  );

  return result.rows.map(rowToGameEvent);
}

export const postgresEventStore: EventStore = {
  appendEvent: appendGameEvent,
  queryRecentEvents: queryRecentGameEvents,
};
