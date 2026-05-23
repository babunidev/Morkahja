import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:4242/morkahja',
});

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function main() {
  const tables = await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log('=== TABLE COUNTS ===');
  for (const t of tables) {
    const c = await q(`SELECT COUNT(*)::int AS n FROM ${t.table_name}`);
    console.log(`${t.table_name}: ${c[0].n}`);
  }

  console.log('\n=== PLAYERS ===');
  console.log(JSON.stringify(await q(`
    SELECT id,
      data->>'playerName' AS name,
      data->>'test' AS test,
      data->>'activeAvatarId' AS active_avatar,
      data ? 'identityPublicKey' AS has_key
    FROM players ORDER BY id
  `), null, 2));

  console.log('\n=== AVATARS ===');
  console.log(JSON.stringify(await q(`
    SELECT player_id, id FROM avatars ORDER BY player_id, id
  `), null, 2));

  console.log('\n=== TEST / ORPHAN ROWS ===');
  console.log('test players:', await q(`
    SELECT id FROM players
    WHERE id LIKE 'test-%' OR (data->>'test') = 'true'
  `));
  console.log('orphan avatars:', await q(`
    SELECT a.player_id, a.id FROM avatars a
    LEFT JOIN players p ON p.id = a.player_id WHERE p.id IS NULL
  `));
  console.log('orphan sessions:', await q(`
    SELECT s.id, s.player_id FROM sessions s
    LEFT JOIN players p ON p.id = s.player_id WHERE p.id IS NULL
  `));
  console.log('orphan inventories:', await q(`
    SELECT i.player_id, i.avatar_id FROM inventories i
    LEFT JOIN avatars a ON a.player_id = i.player_id AND a.id = i.avatar_id
    WHERE a.id IS NULL
  `));
  console.log('orphan progressions:', await q(`
    SELECT pr.player_id, pr.avatar_id FROM progressions pr
    LEFT JOIN avatars a ON a.player_id = pr.player_id AND a.id = pr.avatar_id
    WHERE a.id IS NULL
  `));
  console.log('orphan active_encounters:', await q(`
    SELECT e.player_id, e.avatar_id FROM active_encounters e
    LEFT JOIN avatars a ON a.player_id = e.player_id AND a.id = e.avatar_id
    WHERE a.id IS NULL
  `));

  console.log('\n=== DUPLICATE NAMES / KEYS ===');
  console.log(JSON.stringify(await q(`
    SELECT lower(data->>'playerName') AS name, COUNT(*)::int AS cnt, array_agg(id) AS ids
    FROM players
    WHERE coalesce(data->>'playerName', '') <> ''
    GROUP BY lower(data->>'playerName') HAVING COUNT(*) > 1
  `), null, 2));
  console.log(JSON.stringify(await q(`
    SELECT data->>'identityPublicKey' AS key, COUNT(*)::int AS cnt, array_agg(id) AS ids
    FROM players WHERE data->>'identityPublicKey' IS NOT NULL
    GROUP BY data->>'identityPublicKey' HAVING COUNT(*) > 1
  `), null, 2));

  console.log('\n=== SESSIONS ===');
  console.log(JSON.stringify(await q(`
    SELECT id, player_id, left(access_token, 12) AS token_prefix
    FROM sessions ORDER BY player_id
  `), null, 2));

  console.log('\n=== DEVICES (sample) ===');
  console.log(JSON.stringify(await q(`SELECT id FROM devices ORDER BY id LIMIT 30`), null, 2));

  console.log('\n=== GAME EVENTS BY PLAYER ===');
  console.log(JSON.stringify(await q(`
    SELECT player_id, avatar_id, COUNT(*)::int AS n
    FROM game_events GROUP BY player_id, avatar_id ORDER BY n DESC LIMIT 30
  `), null, 2));

  console.log('\n=== EVENTS FOR MISSING PLAYERS ===');
  console.log(await q(`
    SELECT DISTINCT ge.player_id FROM game_events ge
    LEFT JOIN players p ON p.id = ge.player_id WHERE p.id IS NULL
  `));

  try {
    console.log('\n=== PLAYER ACHIEVEMENTS ===');
    console.log(JSON.stringify(await q(`
      SELECT player_id, COUNT(*)::int AS n FROM player_achievements GROUP BY player_id
    `), null, 2));
  } catch (e) {
    console.log('player_achievements:', e.message);
  }

  try {
    console.log('\n=== ALPHA GLOBAL ===');
    console.log(JSON.stringify(await q(`SELECT * FROM alpha_player_global_state`), null, 2));
  } catch (e) {
    console.log('alpha_player_global_state:', e.message);
  }

  console.log('\n=== AVATAR SUPPORT ROWS ===');
  console.log(JSON.stringify(await q(`
    SELECT a.player_id, a.id,
      EXISTS(SELECT 1 FROM inventories i WHERE i.player_id=a.player_id AND i.avatar_id=a.id) AS has_inv,
      EXISTS(SELECT 1 FROM progressions pr WHERE pr.player_id=a.player_id AND pr.avatar_id=a.id) AS has_prog,
      EXISTS(SELECT 1 FROM active_encounters e WHERE e.player_id=a.player_id AND e.avatar_id=a.id) AS has_enc
    FROM avatars a ORDER BY a.player_id, a.id
  `), null, 2));
}

main()
  .catch((e) => {
    console.error('AUDIT FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
