/**
 * Development-only bot adventurer for multiplayer testing.
 *
 * Behaves like a normal player in a browser: it signs up through the
 * session challenge handshake with its own identity key, creates an avatar
 * through POST /avatar exactly as the avatar creation screen does (a real
 * Rokur Warrior portrait and frame from the game content), selects it, and
 * plays through the same /room endpoints as the web client. It never touches
 * the database directly.
 *
 *   cd server && npx tsx scripts/dev-bot-adventurer.ts
 *   BOT_FRIENDS=Babuni npx tsx scripts/dev-bot-adventurer.ts   # add friends by name
 *
 * Its identity key, session and avatar id are kept in a gitignored state file
 * beside this script, like a recovery key, so a restart logs back in as the
 * same player. Testers add the bot ("Wanderbot") as a friend and join its room.
 */
import { generateKeyPairSync, createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-bot-adventurer is for local development only.');
  process.exit(1);
}

const API = (process.env.BOT_API ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const BOT_NAME = process.env.BOT_NAME ?? 'Wanderbot';
const AVATAR_NAME = process.env.BOT_AVATAR_NAME ?? 'Brakka';
const FRIENDS = (process.env.BOT_FRIENDS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const TICK_MS = 1500;
const HEARTBEAT_MS = 60_000;
const THINK_MS: [number, number] = [3500, 7000];
const READ_RESULT_MS: [number, number] = [4000, 6500];
const ROKUR = 4;
const WARRIOR = 3;
const stateFile = path.join(path.dirname(fileURLToPath(import.meta.url)), `.dev-bot-account-${BOT_NAME}.json`);

type Jwk = Record<string, unknown>;
type BotState = {
  playerId: string;
  identity: { privateKey: Jwk; publicKey: Jwk };
  accessToken: string;
  avatarId?: string;
  avatarCount: number;
};
type Participant = { isLocal?: boolean; playerId: string; choiceState: string; continuePressed?: boolean };
type Room = { roomId: string; roomState: string; participants: Participant[] };
type Avatar = { id: string; status?: string };

class ApiError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`${status} ${body.slice(0, 160)}`);
  }
}

function log(message: string): void {
  console.log(`[${new Date().toLocaleTimeString()}] ${BOT_NAME}: ${message}`);
}

function between([min, max]: [number, number]): number {
  return Math.round(min + Math.random() * (max - min));
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

let token: string | null = null;

async function api<T>(route: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Same signature format as the browser's WebCrypto ECDSA P-256 / SHA-256. */
function signChallenge(privateKey: KeyObject, challenge: string): string {
  return sign('sha256', Buffer.from(challenge, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
}

async function handshake(
  identityPrivate: KeyObject,
  identityPublicJwk: Jwk,
  purpose: 'register' | 'restore',
): Promise<{ playerId: string; accessToken: string }> {
  const device = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const devicePublicKey = JSON.stringify(device.publicKey.export({ format: 'jwk' }));
  const identityPublicKey = JSON.stringify(identityPublicJwk);
  token = null;
  const { challenge } = await api<{ challenge: string }>('/session/challenge', {
    body: { devicePublicKey, identityPublicKey, purpose },
  });
  return api<{ playerId: string; accessToken: string }>('/session/bootstrap', {
    body: {
      devicePublicKey,
      identityPublicKey,
      purpose,
      ...(purpose === 'register' ? { playerName: BOT_NAME } : {}),
      signedIdentityChallenge: { challenge, signature: signChallenge(identityPrivate, challenge) },
      signedDeviceChallenge: { challenge, signature: signChallenge(device.privateKey, challenge) },
    },
  });
}

function save(state: BotState): void {
  writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function restore(state: BotState): Promise<void> {
  const privateKey = createPrivateKey({ key: state.identity.privateKey as never, format: 'jwk' });
  const session = await handshake(privateKey, state.identity.publicKey, 'restore');
  token = session.accessToken;
  state.accessToken = session.accessToken;
  save(state);
}

async function signIn(): Promise<BotState> {
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as BotState;
    token = state.accessToken;
    try {
      await api('/session/heartbeat', { method: 'POST' });
      log(`signed in again as ${state.playerId}`);
    } catch {
      await restore(state);
      log(`restored the account with its identity key (${state.playerId})`);
    }
    return state;
  }

  const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = identity.publicKey.export({ format: 'jwk' }) as Jwk;
  const session = await handshake(identity.privateKey, publicKey, 'register');
  token = session.accessToken;
  const state: BotState = {
    playerId: session.playerId,
    identity: { privateKey: identity.privateKey.export({ format: 'jwk' }) as Jwk, publicKey },
    accessToken: session.accessToken,
    avatarCount: 0,
  };
  save(state);
  log(`signed up as a new player (${state.playerId})`);
  return state;
}

/** What the avatar creation screen does: pick from the content, POST /avatar, then select it. */
async function createAvatar(state: BotState): Promise<string> {
  const content = await api<{
    portraits: Array<Record<string, number> | null>;
    frames: Array<Record<string, number> | null>;
  }>('/game-data/content');
  const portraits = content.portraits.filter(
    (row): row is Record<string, number> =>
      row !== null && row.avatarRace === ROKUR && row.avatarRole === WARRIOR && (row.avatarType ?? 0) === 0,
  );
  const frames = content.frames.filter(
    (row): row is Record<string, number> => row !== null && (row.frameType ?? 1) === 1,
  );
  const now = Date.now();
  state.avatarCount += 1;
  const suffix = state.avatarCount > 1
    ? ` ${['', '', 'II', 'III', 'IV', 'V'][state.avatarCount] ?? state.avatarCount}`
    : '';
  const avatar = {
    id: `avatar-slot-1-${now}`,
    name: `${AVATAR_NAME}${suffix}`,
    race: 'Rokur',
    role: 'Warrior',
    level: 1,
    experience: 0,
    portrait: `avatar_${pick(portraits).avatarID}.webp`,
    frame: `frame_${pick(frames).frameID}.webp`,
    createdAt: now,
    lastPlayedAt: now,
  };
  const created = await api<{ avatar: Avatar }>('/avatar', { body: avatar });
  await api('/avatar/select', { body: { ...avatar, ...created.avatar } });
  state.avatarId = created.avatar.id;
  save(state);
  log(`created avatar ${avatar.name} (${avatar.portrait}, ${avatar.frame})`);
  return created.avatar.id;
}

async function ensureLivingAvatar(state: BotState): Promise<string> {
  const { avatars } = await api<{ avatars: Avatar[] }>('/avatars').catch(() => ({ avatars: [] as Avatar[] }));
  const current = avatars.find((avatar) => avatar.id === state.avatarId);
  if (current && (current.status ?? 'active') === 'active') return current.id;
  if (current) {
    log(`${AVATAR_NAME} has fallen; laying them to rest`);
    await api(`/avatar/${encodeURIComponent(current.id)}/finalize-death`, { method: 'POST' }).catch(() => undefined);
  }
  return createAvatar(state);
}

const state = await signIn();
let avatarId = await ensureLivingAvatar(state);
for (const name of FRIENDS) {
  try {
    await api('/player/friends', { body: { query: name } });
    log(`added ${name} as a friend`);
  } catch (error) {
    log(`friend ${name}: ${error instanceof ApiError ? error.body.slice(0, 80) : String(error)}`);
  }
}

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
log(`playing. Add "${BOT_NAME}" as a friend in the game and join its room. Ctrl+C stops.`);

let waitUntil = 0;
let nextHeartbeat = 0;
let lastStatus = '';

while (!stopping) {
  try {
    if (Date.now() >= nextHeartbeat) {
      nextHeartbeat = Date.now() + HEARTBEAT_MS;
      await api('/session/heartbeat', { method: 'POST' });
    }

    const { room } = await api<{ room: Room | null }>(`/room/active?avatarId=${encodeURIComponent(avatarId)}`);
    if (!room) {
      avatarId = await ensureLivingAvatar(state);
      await api('/room/create', { body: { avatarId } });
      log('started a new room');
    } else {
      const me = room.participants.find((entry) => entry.isLocal);
      const others = room.participants.filter((entry) => !entry.isLocal).length;
      const status = `${room.roomState}/${me?.choiceState ?? 'absent'}${me?.continuePressed ? '+continued' : ''}, ${others} other player(s)`;
      if (status !== lastStatus) {
        log(status);
        lastStatus = status;
      }

      if (me && Date.now() >= waitUntil) {
        if (me.choiceState === 'choosing') {
          if (waitUntil === 0) {
            waitUntil = Date.now() + between(THINK_MS);
          } else {
            await api('/room/choice', { body: { avatarId, action: 'dice' } });
            log('rolled the dice');
            waitUntil = Date.now() + between(READ_RESULT_MS);
          }
        } else if (
          !me.continuePressed
          && ['resolved', 'ready_to_continue', 'witnessing'].includes(me.choiceState)
          // In a party the room only reaches waiting_continue once everyone has chosen.
          && ['waiting_continue', 'system_event'].includes(room.roomState)
        ) {
          await api('/room/continue', { body: { avatarId } });
          log('pressed Continue');
          waitUntil = 0;
        } else {
          waitUntil = 0;
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      log('session expired; signing in again');
      await restore(state).catch((restoreError: unknown) => log(`sign-in failed: ${String(restoreError)}`));
    } else {
      log(`waiting (${error instanceof ApiError ? `${error.status} ${error.body.slice(0, 80)}` : String(error)})`);
      if (error instanceof ApiError && /AVATAR|DEAD|DECEASED/i.test(error.body)) {
        avatarId = await ensureLivingAvatar(state).catch(() => avatarId);
      }
    }
    waitUntil = Date.now() + 2000;
  }
  await new Promise((resolve) => setTimeout(resolve, TICK_MS));
}

log('stopping');
