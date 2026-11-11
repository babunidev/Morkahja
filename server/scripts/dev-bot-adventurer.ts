/**
 * Development-only bot adventurers for multiplayer testing.
 *
 * Runs three bot players, each a normal account that behaves like a player in
 * a browser: it signs up through the session challenge handshake with its own
 * identity key, creates its avatar through POST /avatar exactly as the avatar
 * creation screen does (a real portrait and frame from the game content),
 * selects it, and plays only through the web client's /room endpoints. Nothing
 * touches the database directly.
 *
 *   Wanderbot  Brakka (Rokur Warrior)  always playing in its own room; join it from Friends.
 *   Watchbot   Sylwen (Verdani Mage)   waits on the welcome screen; answers Call for help,
 *                                      helps until the room closes or the caller leaves.
 *   Driftbot   Kestra (Aevis Rogue)    plays 7 rounds, returns to the welcome screen for
 *                                      5 minutes (answering Call for help meanwhile), repeats.
 *
 * One account can only be in one room with one selected avatar at a time, which
 * is why each behavior is its own account.
 *
 *   cd server && BOT_FRIENDS=Babuni npx tsx scripts/dev-bot-adventurer.ts
 *   BOTS=Watchbot,Driftbot ...   # run only some of them
 *
 * Identity keys, sessions and avatar ids are kept in gitignored state files
 * beside this script, like recovery keys, so restarts log back in as the same
 * players. Refuses to run with NODE_ENV=production.
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
const FRIENDS = (process.env.BOT_FRIENDS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const ONLY = (process.env.BOTS ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const TICK_MS = 1500;
const HEARTBEAT_MS = 60_000;
// Player pace, from the client's animation timings: the choice buttons finish
// fading in about 3.8 s after a new encounter (280 ms delay + 3000 ms fade +
// 560 ms), and Continue becomes pressable about 6.2 s after a choice (dice roll
// 1350 ms + roll reveal 1800 ms + Continue fade-in about 3100 ms). The bot never
// acts sooner than a player could, and adds a few seconds of "thinking".
const THINK_MS: [number, number] = [4500, 9000];
const READ_RESULT_MS: [number, number] = [6500, 10000];
const DRIFT_ROUNDS = Number(process.env.DRIFT_ROUNDS ?? 7);
const DRIFT_REST_MS = Number(process.env.DRIFT_REST_MINUTES ?? 5) * 60_000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const RACE_IDS = { Grimnir: 1, Verdani: 2, Aevis: 3, Rokur: 4 } as const;
const ROLE_IDS = { Mage: 1, Rogue: 2, Warrior: 3 } as const;
type Race = keyof typeof RACE_IDS;
type Role = keyof typeof ROLE_IDS;
type Behavior = 'always' | 'helper' | 'drift';

interface BotConfig {
  name: string;
  avatarName: string;
  race: Race;
  role: Role;
  behavior: Behavior;
}

const BOTS: BotConfig[] = [
  { name: 'Wanderbot', avatarName: 'Brakka', race: 'Rokur', role: 'Warrior', behavior: 'always' },
  { name: 'Watchbot', avatarName: 'Sylwen', race: 'Verdani', role: 'Mage', behavior: 'helper' },
  { name: 'Driftbot', avatarName: 'Kestra', race: 'Aevis', role: 'Rogue', behavior: 'drift' },
];

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
type Invitation = { inviteId: string; roomId: string; fromPlayerId: string; fromPlayerName: string; expiresAt: number };
type ContentRow = Record<string, number> | null;

class ApiError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`${status} ${body.slice(0, 160)}`);
  }
}

function between([min, max]: [number, number]): number {
  return Math.round(min + Math.random() * (max - min));
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Same signature format as the browser's WebCrypto ECDSA P-256 / SHA-256. */
function signChallenge(privateKey: KeyObject, challenge: string): string {
  return sign('sha256', Buffer.from(challenge, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
}

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

class Bot {
  private token: string | null = null;
  private state!: BotState;
  private avatarId = '';
  private waitUntil = 0;
  private nextHeartbeat = 0;
  private lastStatus = '';
  /** Set while helping someone who called for help. */
  private helping: { fromPlayerId: string; fromPlayerName: string; roomId: string } | null = null;
  /** Driftbot: rounds played this session, and when its rest ends. */
  private roundsThisSession = 0;
  private restUntil = 0;
  private readonly stateFile: string;

  constructor(private readonly config: BotConfig) {
    this.stateFile = path.join(scriptDir, `.dev-bot-account-${config.name}.json`);
  }

  private log(message: string): void {
    console.log(`[${new Date().toLocaleTimeString()}] ${this.config.name.padEnd(9)} ${message}`);
  }

  private async api<T>(route: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetch(`${API}${route}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (!response.ok) throw new ApiError(response.status, text);
    return (text ? JSON.parse(text) : {}) as T;
  }

  private save(): void {
    writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), { mode: 0o600 });
  }

  private async handshake(
    identityPrivate: KeyObject,
    identityPublicJwk: Jwk,
    purpose: 'register' | 'restore',
  ): Promise<{ playerId: string; accessToken: string }> {
    const device = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const devicePublicKey = JSON.stringify(device.publicKey.export({ format: 'jwk' }));
    const identityPublicKey = JSON.stringify(identityPublicJwk);
    this.token = null;
    const { challenge } = await this.api<{ challenge: string }>('/session/challenge', {
      body: { devicePublicKey, identityPublicKey, purpose },
    });
    return this.api<{ playerId: string; accessToken: string }>('/session/bootstrap', {
      body: {
        devicePublicKey,
        identityPublicKey,
        purpose,
        ...(purpose === 'register' ? { playerName: this.config.name } : {}),
        signedIdentityChallenge: { challenge, signature: signChallenge(identityPrivate, challenge) },
        signedDeviceChallenge: { challenge, signature: signChallenge(device.privateKey, challenge) },
      },
    });
  }

  private async restore(): Promise<void> {
    const privateKey = createPrivateKey({ key: this.state.identity.privateKey as never, format: 'jwk' });
    const session = await this.handshake(privateKey, this.state.identity.publicKey, 'restore');
    this.token = session.accessToken;
    this.state.accessToken = session.accessToken;
    this.save();
  }

  private async signIn(): Promise<void> {
    if (existsSync(this.stateFile)) {
      this.state = JSON.parse(readFileSync(this.stateFile, 'utf8')) as BotState;
      this.token = this.state.accessToken;
      try {
        await this.api('/session/heartbeat', { method: 'POST' });
        this.log(`signed in again (${this.state.playerId})`);
      } catch {
        await this.restore();
        this.log(`restored the account with its identity key (${this.state.playerId})`);
      }
      return;
    }
    const identity = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const publicKey = identity.publicKey.export({ format: 'jwk' }) as Jwk;
    const session = await this.handshake(identity.privateKey, publicKey, 'register');
    this.token = session.accessToken;
    this.state = {
      playerId: session.playerId,
      identity: { privateKey: identity.privateKey.export({ format: 'jwk' }) as Jwk, publicKey },
      accessToken: session.accessToken,
      avatarCount: 0,
    };
    this.save();
    this.log(`signed up as a new player (${this.state.playerId})`);
  }

  /** What the avatar creation screen does: pick from the content, POST /avatar, then select it. */
  private async createAvatar(): Promise<string> {
    const { race, role, avatarName } = this.config;
    const content = await this.api<{ portraits: ContentRow[]; frames: ContentRow[] }>('/game-data/content');
    const portraits = content.portraits.filter(
      (row): row is Record<string, number> =>
        row !== null && row.avatarRace === RACE_IDS[race] && row.avatarRole === ROLE_IDS[role] && (row.avatarType ?? 0) === 0,
    );
    const frames = content.frames.filter(
      (row): row is Record<string, number> => row !== null && (row.frameType ?? 1) === 1,
    );
    const now = Date.now();
    this.state.avatarCount += 1;
    const count = this.state.avatarCount;
    const suffix = count > 1 ? ` ${['', '', 'II', 'III', 'IV', 'V'][count] ?? count}` : '';
    const avatar = {
      id: `avatar-slot-1-${now}`,
      name: `${avatarName}${suffix}`,
      race,
      role,
      level: 1,
      experience: 0,
      portrait: `avatar_${pick(portraits).avatarID}.webp`,
      frame: `frame_${pick(frames).frameID}.webp`,
      createdAt: now,
      lastPlayedAt: now,
    };
    const created = await this.api<{ avatar: Avatar }>('/avatar', { body: avatar });
    await this.api('/avatar/select', { body: { ...avatar, ...created.avatar } });
    this.state.avatarId = created.avatar.id;
    this.save();
    this.log(`created avatar ${avatar.name}, ${race} ${role} (${avatar.portrait}, ${avatar.frame})`);
    return created.avatar.id;
  }

  private async ensureLivingAvatar(): Promise<string> {
    const { avatars } = await this.api<{ avatars: Avatar[] }>('/avatars').catch(() => ({ avatars: [] as Avatar[] }));
    const current = avatars.find((avatar) => avatar.id === this.state.avatarId);
    if (current && (current.status ?? 'active') === 'active') {
      this.avatarId = current.id;
      return current.id;
    }
    if (current) {
      this.log(`${this.config.avatarName} has fallen; laying them to rest`);
      await this.api(`/avatar/${encodeURIComponent(current.id)}/finalize-death`, { method: 'POST' }).catch(() => undefined);
    }
    this.avatarId = await this.createAvatar();
    return this.avatarId;
  }

  async start(): Promise<void> {
    await this.signIn();
    await this.ensureLivingAvatar();
    for (const name of FRIENDS) {
      try {
        await this.api('/player/friends', { body: { query: name } });
        this.log(`added ${name} as a friend`);
      } catch (error) {
        const body = error instanceof ApiError ? error.body : String(error);
        if (!/ALREADY/i.test(body)) this.log(`friend ${name}: ${body.slice(0, 80)}`);
      }
    }
    if (this.config.behavior !== 'always') {
      // Start on the welcome screen, like a player who has just opened the game.
      await this.api('/room/leave/all', { body: {} }).catch(() => undefined);
    }
    const role = {
      always: 'always playing; join it from Friends',
      helper: 'waiting on the welcome screen for a Call for help',
      drift: `plays ${DRIFT_ROUNDS} rounds, then rests ${DRIFT_REST_MS / 60_000} min (helps while resting)`,
    }[this.config.behavior];
    this.log(`ready: ${role}`);
    await this.run();
  }

  private status(text: string): void {
    if (text !== this.lastStatus) {
      this.log(text);
      this.lastStatus = text;
    }
  }

  private async activeRoom(): Promise<Room | null> {
    const { room } = await this.api<{ room: Room | null }>(`/room/active?avatarId=${encodeURIComponent(this.avatarId)}`);
    return room && room.roomState !== 'closed' ? room : null;
  }

  /** One step of normal play in a room. Returns true when Continue was pressed. */
  private async playStep(room: Room): Promise<boolean> {
    const me = room.participants.find((entry) => entry.isLocal);
    const others = room.participants.filter((entry) => !entry.isLocal).length;
    this.status(`${room.roomState}/${me?.choiceState ?? 'absent'}${me?.continuePressed ? '+continued' : ''}, ${others} other player(s)`);
    if (!me || Date.now() < this.waitUntil) return false;

    if (me.choiceState === 'choosing') {
      if (this.waitUntil === 0) {
        this.waitUntil = Date.now() + between(THINK_MS);
      } else {
        await this.api('/room/choice', { body: { avatarId: this.avatarId, action: 'dice' } });
        this.log('rolled the dice');
        this.waitUntil = Date.now() + between(READ_RESULT_MS);
      }
      return false;
    }
    if (
      !me.continuePressed
      && ['resolved', 'ready_to_continue', 'witnessing'].includes(me.choiceState)
      // In a party the room only reaches waiting_continue once everyone has chosen.
      && ['waiting_continue', 'system_event'].includes(room.roomState)
    ) {
      await this.api('/room/continue', { body: { avatarId: this.avatarId } });
      this.log('pressed Continue');
      this.waitUntil = 0;
      return true;
    }
    this.waitUntil = 0;
    return false;
  }

  /** On the welcome screen: accept the first pending Call for help. */
  private async answerHelp(): Promise<boolean> {
    const { invitations } = await this.api<{ invitations: Invitation[] }>('/room/help/pending');
    const invite = invitations.find((entry) => entry.expiresAt > Date.now());
    if (!invite) return false;
    const { room } = await this.api<{ room: Room | null }>('/room/help/respond', {
      body: { inviteId: invite.inviteId, accept: true },
    });
    if (!room) {
      this.log(`could not join ${invite.fromPlayerName}'s room`);
      return false;
    }
    this.helping = { fromPlayerId: invite.fromPlayerId, fromPlayerName: invite.fromPlayerName, roomId: room.roomId };
    this.waitUntil = 0;
    this.log(`heard ${invite.fromPlayerName} call for help and joined their room`);
    return true;
  }

  /** While helping: play, and leave as soon as the caller leaves or the room ends. */
  private async helpStep(): Promise<void> {
    const helping = this.helping!;
    const room = await this.activeRoom();
    if (!room || room.roomId !== helping.roomId) {
      this.log(`${helping.fromPlayerName}'s room has ended; back to the welcome screen`);
      this.helping = null;
      await this.api('/room/leave/all', { body: {} }).catch(() => undefined);
      return;
    }
    if (!room.participants.some((entry) => entry.playerId === helping.fromPlayerId)) {
      this.log(`${helping.fromPlayerName} left; leaving too`);
      this.helping = null;
      await this.api('/room/leave', { body: { avatarId: this.avatarId } }).catch(() => undefined);
      await this.api('/room/leave/all', { body: {} }).catch(() => undefined);
      return;
    }
    await this.playStep(room);
  }

  private async step(): Promise<void> {
    if (Date.now() >= this.nextHeartbeat) {
      // The heartbeat also keeps the account "recently active", which Call for
      // help requires before it invites someone who is waiting on the welcome screen.
      this.nextHeartbeat = Date.now() + HEARTBEAT_MS;
      await this.api('/session/heartbeat', { method: 'POST' });
    }

    if (this.helping) {
      await this.helpStep();
      return;
    }

    switch (this.config.behavior) {
      case 'always': {
        const room = await this.activeRoom();
        if (!room) {
          await this.ensureLivingAvatar();
          await this.api('/room/create', { body: { avatarId: this.avatarId } });
          this.log('started a new room');
          return;
        }
        await this.playStep(room);
        return;
      }
      case 'helper': {
        this.status('idle on the welcome screen');
        await this.answerHelp();
        return;
      }
      case 'drift': {
        if (Date.now() < this.restUntil) {
          const minutes = Math.ceil((this.restUntil - Date.now()) / 60_000);
          this.status(`resting on the welcome screen (about ${minutes} min left)`);
          await this.answerHelp();
          return;
        }
        const room = await this.activeRoom();
        if (!room) {
          await this.ensureLivingAvatar();
          await this.api('/room/create', { body: { avatarId: this.avatarId } });
          this.roundsThisSession = 0;
          this.log(`started an adventure (${DRIFT_ROUNDS} rounds)`);
          return;
        }
        if (await this.playStep(room)) {
          this.roundsThisSession += 1;
          if (this.roundsThisSession >= DRIFT_ROUNDS) {
            this.restUntil = Date.now() + DRIFT_REST_MS;
            this.roundsThisSession = 0;
            await this.api('/room/leave/all', { body: {} });
            this.log(`played ${DRIFT_ROUNDS} rounds; back to the welcome screen for ${DRIFT_REST_MS / 60_000} min`);
          }
        }
        return;
      }
    }
  }

  private async run(): Promise<void> {
    while (!stopping) {
      try {
        await this.step();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          this.log('session expired; signing in again');
          await this.restore().catch((restoreError: unknown) => this.log(`sign-in failed: ${String(restoreError)}`));
        } else {
          this.log(`waiting (${error instanceof ApiError ? `${error.status} ${error.body.slice(0, 80)}` : String(error)})`);
          if (error instanceof ApiError && /AVATAR|DEAD|DECEASED/i.test(error.body)) {
            await this.ensureLivingAvatar().catch(() => undefined);
          }
        }
        this.waitUntil = Date.now() + 2000;
      }
      await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    }
    this.log('stopping');
  }
}

const selected = BOTS.filter((config) => ONLY.length === 0 || ONLY.includes(config.name));
console.log(`Starting ${selected.map((config) => config.name).join(', ')} against ${API}. Ctrl+C stops.`);
await Promise.all(selected.map((config) => new Bot(config).start()));
