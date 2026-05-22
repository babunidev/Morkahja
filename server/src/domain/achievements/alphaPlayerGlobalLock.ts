import { pool } from '../../db/postgresDocumentStore.js';
import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  ALPHA_PLAYER_RANK4_SLOT_CAP,
} from './alphaPlayerAchievement.js';

let schemaReady: Promise<void> | null = null;

export interface AlphaPlayerGlobalState {
  rank4Count: number;
  lockedAt?: number;
}

export async function ensureAlphaPlayerGlobalStateReady(): Promise<void> {
  schemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS achievement_global_state (
      achievement_id TEXT PRIMARY KEY,
      rank4_count INTEGER NOT NULL DEFAULT 0,
      locked_at BIGINT NULL
    );
  `).then(() => undefined);

  await schemaReady;
}

export async function loadAlphaPlayerGlobalState(): Promise<AlphaPlayerGlobalState> {
  await ensureAlphaPlayerGlobalStateReady();

  const result = await pool.query<{
    rank4_count: number;
    locked_at: string | null;
  }>(
    `SELECT rank4_count, locked_at
     FROM achievement_global_state
     WHERE achievement_id = $1`,
    [ALPHA_PLAYER_ACHIEVEMENT_ID],
  );

  const row = result.rows[0];
  if (!row) {
    return { rank4Count: 0 };
  }

  return {
    rank4Count: Number(row.rank4_count),
    lockedAt: row.locked_at === null ? undefined : Number(row.locked_at),
  };
}

export function isAlphaPlayerGloballyLocked(state: AlphaPlayerGlobalState): boolean {
  return state.lockedAt !== undefined || state.rank4Count >= ALPHA_PLAYER_RANK4_SLOT_CAP;
}

export async function tryClaimAlphaPlayerRank4Slot(
  timestamp: number,
): Promise<{ claimed: boolean; locked: boolean }> {
  await ensureAlphaPlayerGlobalStateReady();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockedRow = await client.query<{
      rank4_count: number;
      locked_at: string | null;
    }>(
      `SELECT rank4_count, locked_at
       FROM achievement_global_state
       WHERE achievement_id = $1
       FOR UPDATE`,
      [ALPHA_PLAYER_ACHIEVEMENT_ID],
    );

    let rank4Count = lockedRow.rows[0] ? Number(lockedRow.rows[0].rank4_count) : 0;
    let lockedAt = lockedRow.rows[0]?.locked_at === null
      ? undefined
      : Number(lockedRow.rows[0]?.locked_at);

    if (lockedAt !== undefined || rank4Count >= ALPHA_PLAYER_RANK4_SLOT_CAP) {
      if (lockedAt === undefined && rank4Count >= ALPHA_PLAYER_RANK4_SLOT_CAP) {
        await client.query(
          `INSERT INTO achievement_global_state (achievement_id, rank4_count, locked_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (achievement_id) DO UPDATE SET
             locked_at = COALESCE(achievement_global_state.locked_at, EXCLUDED.locked_at)`,
          [ALPHA_PLAYER_ACHIEVEMENT_ID, rank4Count, timestamp],
        );
        lockedAt = timestamp;
      }

      await client.query('COMMIT');
      return { claimed: false, locked: true };
    }

    rank4Count += 1;
    const nextLockedAt = rank4Count >= ALPHA_PLAYER_RANK4_SLOT_CAP ? timestamp : null;

    await client.query(
      `INSERT INTO achievement_global_state (achievement_id, rank4_count, locked_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (achievement_id) DO UPDATE SET
         rank4_count = EXCLUDED.rank4_count,
         locked_at = COALESCE(achievement_global_state.locked_at, EXCLUDED.locked_at)`,
      [ALPHA_PLAYER_ACHIEVEMENT_ID, rank4Count, nextLockedAt],
    );

    await client.query('COMMIT');

    return {
      claimed: true,
      locked: nextLockedAt !== null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
