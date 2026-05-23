import pg from 'pg';
import type { Pool as PgPool, PoolClient, QueryResult } from 'pg';

const { Pool } = pg;

type JsonObject = object;

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:4242/morkahja';
const databaseUrlFromEnvironment = process.env.DATABASE_URL;

if (!databaseUrlFromEnvironment && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is required when NODE_ENV=production');
}

const connectionString = databaseUrlFromEnvironment ?? DEFAULT_DATABASE_URL;

export const pool = new Pool({ connectionString });

let schemaReady: Promise<void> | null = null;

async function ensureSchema(client: PgPool | PoolClient = pool): Promise<void> {
  schemaReady ??= client.query(`
    CREATE TABLE IF NOT EXISTS players (
      id text PRIMARY KEY,
      data jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS devices (
      id text PRIMARY KEY,
      data jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY,
      access_token text UNIQUE NOT NULL,
      player_id text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS avatars (
      player_id text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (player_id, id)
    );

    CREATE TABLE IF NOT EXISTS active_encounters (
      player_id text NOT NULL,
      avatar_id text NOT NULL,
      id text NOT NULL DEFAULT 'current',
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (player_id, avatar_id, id)
    );

    CREATE TABLE IF NOT EXISTS inventories (
      player_id text NOT NULL,
      avatar_id text NOT NULL,
      id text NOT NULL DEFAULT 'current',
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (player_id, avatar_id, id)
    );

    CREATE TABLE IF NOT EXISTS progressions (
      player_id text NOT NULL,
      avatar_id text NOT NULL,
      id text NOT NULL DEFAULT 'current',
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (player_id, avatar_id, id)
    );
  `).then(() => undefined);

  await schemaReady;
}

export interface PostgresConnectionInfo {
  databaseName: string;
  host: string;
  port: string;
  usingDefaultConnection: boolean;
}

export async function validatePostgresConnection(): Promise<PostgresConnectionInfo> {
  await ensureSchema();
  const { ensureGameEventsReady } = await import('./gameEventPersistence.js');
  const { ensurePlayerAchievementsReady } = await import('../domain/achievements/achievementPersistence.js');
  const { ensureAlphaPlayerGlobalStateReady } = await import('../domain/achievements/alphaPlayerGlobalLock.js');
  await ensureGameEventsReady();
  await ensurePlayerAchievementsReady();
  await ensureAlphaPlayerGlobalStateReady();

  const result = await pool.query<{
    database_name: string;
    server_port: number | null;
  }>('SELECT current_database() AS database_name, inet_server_port() AS server_port');
  const url = new URL(connectionString);
  const databaseName = result.rows[0]?.database_name ?? url.pathname.replace(/^\//, '');
  const port = String(result.rows[0]?.server_port ?? url.port);

  return {
    databaseName,
    host: url.hostname,
    port,
    usingDefaultConnection: !databaseUrlFromEnvironment,
  };
}

function mergeData<T extends JsonObject>(existing: T | null, next: T, merge = false): T {
  return merge ? { ...(existing ?? {}), ...next } as T : next;
}

async function one<T>(query: Promise<QueryResult<{ data: T }>>): Promise<T | null> {
  const result = await query;
  return result.rows[0]?.data ?? null;
}

export async function getPlayer<T>(playerId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query('SELECT data FROM players WHERE id = $1', [playerId]));
}

export async function listAllPlayers<T>(): Promise<Array<{ id: string; data: T }>> {
  await ensureSchema();
  const result = await pool.query<{ id: string; data: T }>(
    'SELECT id, data FROM players ORDER BY (data->>\'lastPlayedAt\')::bigint DESC NULLS LAST',
  );
  return result.rows;
}

export async function setPlayer<T extends JsonObject>(
  playerId: string,
  data: T,
  options: { merge?: boolean } = {},
): Promise<void> {
  await ensureSchema();
  const existing = options.merge ? await getPlayer<T>(playerId) : null;
  await pool.query(
    `INSERT INTO players (id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [playerId, JSON.stringify(mergeData(existing, data, options.merge))],
  );
}

export async function deletePlayer(playerId: string): Promise<void> {
  await ensureSchema();
  await pool.query('DELETE FROM players WHERE id = $1', [playerId]);
}

export async function findPlayerByIdentityPublicKey<T>(
  identityPublicKey: string,
): Promise<{ id: string; data: T } | null> {
  await ensureSchema();
  const result = await pool.query<{ id: string; data: T }>(
    `SELECT id, data FROM players
     WHERE data->>'identityPublicKey' = $1
     LIMIT 1`,
    [identityPublicKey],
  );

  return result.rows[0] ?? null;
}

export async function findPlayerByNameOrId<T>(
  query: string,
): Promise<{ id: string; data: T } | null> {
  await ensureSchema();
  const trimmed = query.trim();

  if (!trimmed) {
    return null;
  }

  const result = await pool.query<{ id: string; data: T }>(
    `SELECT id, data FROM players
     WHERE lower(data->>'playerName') = lower($1) OR id = $2
     ORDER BY CASE WHEN lower(data->>'playerName') = lower($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [trimmed, trimmed],
  );

  return result.rows[0] ?? null;
}

export async function getDevice<T>(deviceId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query('SELECT data FROM devices WHERE id = $1', [deviceId]));
}

export async function setDevice<T extends JsonObject>(
  deviceId: string,
  data: T,
  options: { merge?: boolean } = {},
): Promise<void> {
  await ensureSchema();
  const existing = options.merge ? await getDevice<T>(deviceId) : null;
  await pool.query(
    `INSERT INTO devices (id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [deviceId, JSON.stringify(mergeData(existing, data, options.merge))],
  );
}

export async function getSession<T>(sessionId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query('SELECT data FROM sessions WHERE id = $1', [sessionId]));
}

export async function findSessionByAccessToken<T>(
  accessToken: string,
): Promise<T | null> {
  await ensureSchema();
  return one(pool.query('SELECT data FROM sessions WHERE access_token = $1', [accessToken]));
}

export async function setSession<T extends JsonObject & { accessToken: string; playerId: string }>(
  sessionId: string,
  data: T,
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO sessions (id, access_token, player_id, data)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       player_id = EXCLUDED.player_id,
       data = EXCLUDED.data`,
    [sessionId, data.accessToken, data.playerId, JSON.stringify(data)],
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ensureSchema();
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

export async function getAvatar<T>(playerId: string, avatarId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query(
    'SELECT data FROM avatars WHERE player_id = $1 AND id = $2',
    [playerId, avatarId],
  ));
}

export async function listAvatars<T>(playerId: string): Promise<Array<{ id: string; data: T }>> {
  await ensureSchema();
  const result = await pool.query<{ id: string; data: T }>(
    'SELECT id, data FROM avatars WHERE player_id = $1 ORDER BY id',
    [playerId],
  );
  return result.rows;
}

/** Active avatars for many players (one row per player when activeAvatarId is set). */
export async function listActiveAvatarsForPlayers<T>(
  playerIds: string[],
): Promise<Map<string, { id: string; data: T }>> {
  await ensureSchema();
  if (playerIds.length === 0) {
    return new Map();
  }

  const result = await pool.query<{ player_id: string; id: string; data: T }>(
    `SELECT a.player_id, a.id, a.data
     FROM avatars a
     INNER JOIN players p ON p.id = a.player_id
       AND COALESCE(p.data->>'activeAvatarId', '') = a.id
     WHERE a.player_id = ANY($1::text[])`,
    [playerIds],
  );

  return new Map(
    result.rows.map((row) => [row.player_id, { id: row.id, data: row.data }]),
  );
}

export async function countAvatarsByPlayerIds(
  playerIds: string[],
): Promise<Map<string, number>> {
  await ensureSchema();
  if (playerIds.length === 0) {
    return new Map();
  }

  const result = await pool.query<{ player_id: string; count: string }>(
    `SELECT player_id, COUNT(*)::int AS count
     FROM avatars
     WHERE player_id = ANY($1::text[])
     GROUP BY player_id`,
    [playerIds],
  );

  return new Map(result.rows.map((row) => [row.player_id, Number(row.count)]));
}

export async function setAvatar<T extends JsonObject>(
  playerId: string,
  avatarId: string,
  data: T,
  options: { merge?: boolean } = {},
): Promise<void> {
  await ensureSchema();
  const existing = options.merge ? await getAvatar<T>(playerId, avatarId) : null;
  await pool.query(
    `INSERT INTO avatars (player_id, id, data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (player_id, id) DO UPDATE SET data = EXCLUDED.data`,
    [playerId, avatarId, JSON.stringify(mergeData(existing, data, options.merge))],
  );
}

export async function deleteAvatar(playerId: string, avatarId: string): Promise<void> {
  await ensureSchema();
  await pool.query('DELETE FROM avatars WHERE player_id = $1 AND id = $2', [playerId, avatarId]);
}

export async function getActiveEncounter<T>(playerId: string, avatarId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query(
    `SELECT data FROM active_encounters
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  ));
}

export async function setActiveEncounter<T extends JsonObject>(
  playerId: string,
  avatarId: string,
  data: T,
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO active_encounters (player_id, avatar_id, id, data)
     VALUES ($1, $2, 'current', $3::jsonb)
     ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
    [playerId, avatarId, JSON.stringify(data)],
  );
}

export async function deleteActiveEncounter(playerId: string, avatarId: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `DELETE FROM active_encounters
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  );
}

export async function getInventory<T>(playerId: string, avatarId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query(
    `SELECT data FROM inventories
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  ));
}

export async function setInventory<T extends JsonObject>(
  playerId: string,
  avatarId: string,
  data: T,
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO inventories (player_id, avatar_id, id, data)
     VALUES ($1, $2, 'current', $3::jsonb)
     ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
    [playerId, avatarId, JSON.stringify(data)],
  );
}

export async function deleteInventory(playerId: string, avatarId: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `DELETE FROM inventories
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  );
}

export async function getProgression<T>(playerId: string, avatarId: string): Promise<T | null> {
  await ensureSchema();
  return one(pool.query(
    `SELECT data FROM progressions
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  ));
}

export async function setProgression<T extends JsonObject>(
  playerId: string,
  avatarId: string,
  data: T,
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO progressions (player_id, avatar_id, id, data)
     VALUES ($1, $2, 'current', $3::jsonb)
     ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
    [playerId, avatarId, JSON.stringify(data)],
  );
}

export async function deleteProgression(playerId: string, avatarId: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `DELETE FROM progressions
     WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'`,
    [playerId, avatarId],
  );
}

export interface DocumentTransaction {
  getPlayer<T>(playerId: string): Promise<T | null>;
  getAvatar<T>(playerId: string, avatarId: string): Promise<T | null>;
  getActiveEncounter<T>(playerId: string, avatarId: string): Promise<T | null>;
  getInventory<T>(playerId: string, avatarId: string): Promise<T | null>;
  getProgression<T>(playerId: string, avatarId: string): Promise<T | null>;
  setAvatar<T extends JsonObject>(playerId: string, avatarId: string, data: T, options?: { merge?: boolean }): Promise<void>;
  setActiveEncounter<T extends JsonObject>(playerId: string, avatarId: string, data: T): Promise<void>;
  setInventory<T extends JsonObject>(playerId: string, avatarId: string, data: T): Promise<void>;
  setProgression<T extends JsonObject>(playerId: string, avatarId: string, data: T): Promise<void>;
}

export async function withDocumentTransaction<T>(
  callback: (transaction: DocumentTransaction) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const transaction: DocumentTransaction = {
      getPlayer: async <R>(playerId: string) =>
        one(client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [playerId])) as Promise<R | null>,
      getAvatar: async <R>(playerId: string, avatarId: string) =>
        one(client.query(
          'SELECT data FROM avatars WHERE player_id = $1 AND id = $2 FOR UPDATE',
          [playerId, avatarId],
        )) as Promise<R | null>,
      getActiveEncounter: async <R>(playerId: string, avatarId: string) =>
        one(client.query(
          `SELECT data FROM active_encounters
           WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'
           FOR UPDATE`,
          [playerId, avatarId],
        )) as Promise<R | null>,
      getInventory: async <R>(playerId: string, avatarId: string) =>
        one(client.query(
          `SELECT data FROM inventories
           WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'
           FOR UPDATE`,
          [playerId, avatarId],
        )) as Promise<R | null>,
      getProgression: async <R>(playerId: string, avatarId: string) =>
        one(client.query(
          `SELECT data FROM progressions
           WHERE player_id = $1 AND avatar_id = $2 AND id = 'current'
           FOR UPDATE`,
          [playerId, avatarId],
        )) as Promise<R | null>,
      setAvatar: async <R extends JsonObject>(
        playerId: string,
        avatarId: string,
        data: R,
        options: { merge?: boolean } = {},
      ) => {
        const existing = options.merge ? await transaction.getAvatar<R>(playerId, avatarId) : null;
        await client.query(
          `INSERT INTO avatars (player_id, id, data)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (player_id, id) DO UPDATE SET data = EXCLUDED.data`,
          [playerId, avatarId, JSON.stringify(mergeData(existing, data, options.merge))],
        );
      },
      setActiveEncounter: async <R extends JsonObject>(playerId: string, avatarId: string, data: R) => {
        await client.query(
          `INSERT INTO active_encounters (player_id, avatar_id, id, data)
           VALUES ($1, $2, 'current', $3::jsonb)
           ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
          [playerId, avatarId, JSON.stringify(data)],
        );
      },
      setInventory: async <R extends JsonObject>(playerId: string, avatarId: string, data: R) => {
        await client.query(
          `INSERT INTO inventories (player_id, avatar_id, id, data)
           VALUES ($1, $2, 'current', $3::jsonb)
           ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
          [playerId, avatarId, JSON.stringify(data)],
        );
      },
      setProgression: async <R extends JsonObject>(playerId: string, avatarId: string, data: R) => {
        await client.query(
          `INSERT INTO progressions (player_id, avatar_id, id, data)
           VALUES ($1, $2, 'current', $3::jsonb)
           ON CONFLICT (player_id, avatar_id, id) DO UPDATE SET data = EXCLUDED.data`,
          [playerId, avatarId, JSON.stringify(data)],
        );
      },
    };

    const result = await callback(transaction);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
