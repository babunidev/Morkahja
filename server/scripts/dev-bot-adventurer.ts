/**
 * Development-only bot adventurer for multiplayer testing.
 *
 * Creates (or reuses) a player named "Wanderbot" with a Rokur Warrior avatar,
 * keeps it in its own encounter room, and plays forever: it rolls the dice on
 * every encounter and system event, and presses Continue after a short pause.
 * Players who add "Wanderbot" as a friend are added back, so they can join its
 * room from the Friends list (also into Friends-only slots).
 *
 *   cd server && npx tsx scripts/dev-bot-adventurer.ts
 *
 * Talks to the database directly through the server's own services, exactly
 * like the integration tests. Refuses to run with NODE_ENV=production.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-bot-adventurer is for local development only.');
  process.exit(1);
}

const { pool, getPlayer } = await import('../src/db/postgresDocumentStore.js');
const { savePlayerAvatar, deletePlayerAvatar } = await import('../src/services/playerService.js');
const { addPlayerFriend } = await import('../src/services/friendService.js');
const { createRoom, getActiveRoomForPlayer, submitChoice, submitContinue } = await import(
  '../src/services/roomService.js'
);
const { bootstrapTestSession } = await import('../src/tests/sessionAuthTestHelpers.js');
const { heartbeatSession } = await import('../src/services/sessionService.js');
const { touchPlayerInteraction } = await import('../src/services/playerInteractionService.js');

const BOT_NAME = process.env.BOT_NAME ?? 'Wanderbot';
const TICK_MS = 1500;
const THINK_MS: [number, number] = [3500, 7000];
const READ_RESULT_MS: [number, number] = [4000, 6500];
const stateFile = path.join(path.dirname(fileURLToPath(import.meta.url)), `.dev-bot-${BOT_NAME}.json`);

type BotState = { playerId: string; avatarId: string; avatarCount: number; accessToken?: string };
const HEARTBEAT_MS = 60_000;

function log(message: string): void {
  console.log(`[${new Date().toLocaleTimeString()}] ${BOT_NAME}: ${message}`);
}

function randomBetween([min, max]: [number, number]): number {
  return Math.round(min + Math.random() * (max - min));
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as { code?: unknown; message?: unknown };
    if (typeof record.code === 'string') return record.code;
    if (typeof record.message === 'string') return record.message;
  }
  return String(error);
}

async function newAvatar(playerId: string, count: number): Promise<string> {
  const id = `${playerId}-bot-avatar-${Date.now()}`;
  const suffix = count > 1 ? ` ${['', '', 'II', 'III', 'IV', 'V'][count] ?? count}` : '';
  await savePlayerAvatar(playerId, {
    id,
    name: `Brakka${suffix}`,
    race: 'Rokur',
    role: 'Warrior',
    portrait: 'm_portrait_rokur_warrior',
    frame: 'm_frame_01',
    createdAt: Date.now(),
  } as never);
  log(`created avatar Brakka${suffix} (${id})`);
  return id;
}

async function loadOrCreateBot(): Promise<BotState> {
  if (existsSync(stateFile)) {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8')) as BotState;
    if (await getPlayer(saved.playerId)) {
      log(`reusing player ${saved.playerId}`);
      return saved;
    }
  }
  const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const identityPublicJwk = JSON.stringify(identity.publicKey.export({ format: 'jwk' }));
  const session = await bootstrapTestSession(identity, identityPublicJwk, BOT_NAME);
  log(`registered player ${session.playerId}`);
  const state: BotState = {
    playerId: session.playerId,
    avatarId: await newAvatar(session.playerId, 1),
    avatarCount: 1,
    accessToken: session.accessToken,
  };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

async function befriendFollowers(botPlayerId: string): Promise<void> {
  const bot = await getPlayer<{ friendIds?: string[] }>(botPlayerId);
  const known = new Set(bot?.friendIds ?? []);
  const { rows } = await pool.query<{ id: string; name: string | null }>(
    "select id, data->>'playerName' as name from players where data->'friendIds' ? $1",
    [botPlayerId],
  );
  for (const row of rows) {
    if (known.has(row.id)) continue;
    try {
      await addPlayerFriend(botPlayerId, row.id);
      log(`added ${row.name ?? row.id} back as a friend`);
    } catch (error) {
      log(`could not add ${row.name ?? row.id} back: ${errorCode(error)}`);
    }
  }
}

const state = await loadOrCreateBot();
let waitUntil = 0;
let nextHeartbeat = 0;
let lastStatus = '';
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

log('playing. Add "' + BOT_NAME + '" as a friend in the game, then join its room. Ctrl+C stops.');

while (!stopping) {
  try {
    // Look like a present player: a live session and recent activity are what
    // the Friends list needs before it offers Join.
    await touchPlayerInteraction(state.playerId);
    if (state.accessToken && Date.now() >= nextHeartbeat) {
      nextHeartbeat = Date.now() + HEARTBEAT_MS;
      await heartbeatSession(state.accessToken).catch((error: unknown) => {
        log(`session heartbeat failed (${errorCode(error)}); Wanderbot may show as offline`);
      });
    }
    await befriendFollowers(state.playerId);
    const room = await getActiveRoomForPlayer(state.playerId, state.avatarId);

    if (!room) {
      try {
        await createRoom(state.playerId, state.avatarId);
        log('started a new room');
      } catch (error) {
        log(`cannot start a room with this avatar (${errorCode(error)}); making a new one`);
        await deletePlayerAvatar(state.playerId, state.avatarId).catch(() => undefined);
        state.avatarCount += 1;
        state.avatarId = await newAvatar(state.playerId, state.avatarCount);
        writeFileSync(stateFile, JSON.stringify(state, null, 2));
      }
    } else {
      const me = room.participants.find((entry) => entry.playerId === state.playerId);
      const others = room.participants.filter((entry) => entry.playerId !== state.playerId).length;
      const status = `${room.roomState}/${me?.choiceState ?? 'absent'}${me?.continuePressed ? '+continued' : ''}, ${others} other player(s)`;
      if (status !== lastStatus) {
        log(status);
        lastStatus = status;
      }

      if (me && Date.now() >= waitUntil) {
        if (me.choiceState === 'choosing') {
          if (waitUntil === 0) {
            waitUntil = Date.now() + randomBetween(THINK_MS);
          } else {
            await submitChoice(state.playerId, state.avatarId, 'dice' as never);
            log('rolled the dice');
            waitUntil = Date.now() + randomBetween(READ_RESULT_MS);
          }
        } else if (
          !me.continuePressed
          && ['resolved', 'ready_to_continue', 'witnessing'].includes(me.choiceState)
          && ['waiting_continue', 'system_event', 'active_encounter'].includes(room.roomState)
        ) {
          await submitContinue(state.playerId, state.avatarId);
          log('pressed Continue');
          waitUntil = 0;
        } else {
          waitUntil = 0;
        }
      }
    }
  } catch (error) {
    const code = errorCode(error);
    if (!/not ready|ACTION_NOT_READY|ALREADY|WAITING/i.test(code)) {
      log(`waiting (${code})`);
    }
    waitUntil = Date.now() + 2000;
  }
  await new Promise((resolve) => setTimeout(resolve, TICK_MS));
}

log('stopping');
await pool.end();
