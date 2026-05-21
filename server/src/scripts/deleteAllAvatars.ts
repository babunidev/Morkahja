import { pool } from '../db/postgresDocumentStore.js';
import { ensureGameEventsReady } from '../db/gameEventPersistence.js';

async function main(): Promise<void> {
  await ensureGameEventsReady();

  const tables = [
    'active_encounters',
    'inventories',
    'progressions',
    'avatars',
  ] as const;

  for (const table of tables) {
    const result = await pool.query(`DELETE FROM ${table}`);
    console.log(`Deleted from ${table}: ${result.rowCount ?? 0}`);
  }

  const events = await pool.query('DELETE FROM game_events WHERE avatar_id IS NOT NULL');
  console.log(`Deleted avatar game_events: ${events.rowCount ?? 0}`);

  const players = await pool.query(
    `UPDATE players SET data = data - 'activeAvatarId' WHERE data ? 'activeAvatarId'`,
  );
  console.log(`Cleared activeAvatarId on players: ${players.rowCount ?? 0}`);

  const remaining = await pool.query('SELECT COUNT(*)::int AS count FROM avatars');
  console.log(`Avatars remaining: ${remaining.rows[0]?.count ?? 0}`);
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    void pool.end();
    process.exit(1);
  });
