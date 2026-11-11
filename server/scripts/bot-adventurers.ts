/**
 * Bot adventurers: three always-online players that give the world some life
 * and answer Call for help. Used for local multiplayer testing and, with an
 * explicit opt-in, on the production server (see ecosystem.config.cjs).
 *
 * Runs three bot players, each a normal account that behaves like a player in
 * a browser: it signs up through the session challenge handshake with its own
 * identity key, creates its avatar through POST /avatar exactly as the avatar
 * creation screen does (a real portrait and frame from the game content, named after its portrait
 * like the creation screen's default),
 * selects it, and plays only through the web client's /room endpoints. Nothing
 * touches the database directly.
 *
 *   Varrokh  Rokur Warrior   always adventuring in its own room; join it from Friends.
 *   Sylvaen  Verdani Mage    waits on the welcome screen; answers Call for help, helps
 *                            until the room ends, the caller leaves, or the room has not
 *                            moved for 3 minutes (HELP_STALE_MINUTES).
 *   Thalyss  Aevis Rogue     plays 7 rounds, returns to the welcome screen for 5 minutes
 *                            (answering Call for help meanwhile), repeats.
 *
 * In an encounter every bot plays by one simple rule: use an item if one solves
 * it, otherwise a skill, otherwise roll the dice (system events always roll).
 * Availability comes from the web client's own rule, so they see what a player sees.
 *
 * One account can only be in one room with one selected avatar at a time, which
 * is why each behavior is its own account.
 *
 *   cd server && BOT_FRIENDS=Babuni npx tsx scripts/bot-adventurers.ts
 *   BOTS=Sylvaen,Thalyss ...      # run only some of them
 *
 * Identity keys, sessions and avatar ids are kept in gitignored state files
 * (BOT_STATE_DIR, default: beside this script), like recovery keys, so restarts
 * log back in as the same players. With NODE_ENV=production the bots refuse to
 * start unless BOT_ALLOW_PRODUCTION=1 is set deliberately.
 */
import { generateKeyPairSync, createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production' && process.env.BOT_ALLOW_PRODUCTION !== '1') {
  console.error('bot-adventurers: refusing to run in production without BOT_ALLOW_PRODUCTION=1.');
  process.exit(1);
}

// The web client's own content store and solution-availability rule, so the
// bots see exactly the solutions a player's screen would offer.
const { setGameContent, gameSolutions } = await import('../../client/src/data/gameContent.js');
const { slotHasEnoughSolutionCharges } = await import('../../client/src/ui/game/encounterInventoryPreview.js');

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
const HELP_STALE_MS = Number(process.env.HELP_STALE_MINUTES ?? 3) * 60_000;
const DRIFT_ROUNDS = Number(process.env.DRIFT_ROUNDS ?? 7);
const DRIFT_REST_MS = Number(process.env.DRIFT_REST_MINUTES ?? 5) * 60_000;
const stateDir = process.env.BOT_STATE_DIR ?? path.dirname(fileURLToPath(import.meta.url));

const RACE_IDS = { Grimnir: 1, Verdani: 2, Aevis: 3, Rokur: 4 } as const;
const ROLE_IDS = { Mage: 1, Rogue: 2, Warrior: 3 } as const;
type Race = keyof typeof RACE_IDS;
type Role = keyof typeof ROLE_IDS;
type Behavior = 'always' | 'helper' | 'drift';

interface BotConfig {
  name: string;
  race: Race;
  role: Role;
  behavior: Behavior;
}

const BOTS: BotConfig[] = [
  { name: 'Varrokh', race: 'Rokur', role: 'Warrior', behavior: 'always' },
  { name: 'Sylvaen', race: 'Verdani', role: 'Mage', behavior: 'helper' },
  { name: 'Thalyss', race: 'Aevis', role: 'Rogue', behavior: 'drift' },
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
type InventoryEntry = { solutionId: number; solutionType: number; uses: number };
type Inventory = { spellbook: InventoryEntry[]; items: InventoryEntry[]; essences: InventoryEntry[] };
type EncounterRequirements = Record<string, number | undefined>;
type SolutionChoice = { slot: 'A' | 'B' | 'C' | 'D'; solutionId: number; kind: 'item' | 'skill'; name: string };
const SLOTS = ['A', 'B', 'C', 'D'] as const;
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
  /** While helping: the room's last visible state and when it last changed. */
  private helpRoomFingerprint = '';
  private helpProgressAt = 0;
  /** On-and-off player: rounds played this session, and when its rest ends. */
  private roundsThisSession = 0;
  private restUntil = 0;
  private readonly stateFile: string;

  constructor(private readonly config: BotConfig) {
    this.stateFile = path.join(stateDir, `.bot-account-${config.name}.json`);
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
    const { race, role } = this.config;
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
    const portrait = pick(portraits) as Record<string, number> & { avatarName?: string };
    const avatar = {
      id: `avatar-slot-1-${now}`,
      // The creation screen's default: the portrait's own name.
      name: String(portrait.avatarName ?? race),
      race,
      role,
      level: 1,
      experience: 0,
      portrait: `avatar_${portrait.avatarID}.webp`,
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
      this.log('the avatar has fallen; laying them to rest');
      await this.api(`/avatar/${encodeURIComponent(current.id)}/finalize-death`, { method: 'POST' }).catch(() => undefined);
    }
    this.avatarId = await this.createAvatar();
    return this.avatarId;
  }

  async start(): Promise<void> {
    await this.signIn();
    setGameContent(await this.api('/game-data/content'));
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
        const choice = room.roomState === 'active_encounter' ? await this.pickSolution(room) : null;
        if (choice) {
          try {
            await this.api('/room/choice', { body: { avatarId: this.avatarId, action: choice.slot, solutionId: choice.solutionId } });
            this.log(`used ${choice.kind} ${choice.name} (slot ${choice.slot})`);
          } catch (error) {
            this.log(`could not use ${choice.name} (${error instanceof ApiError ? error.body.slice(0, 60) : String(error)}); rolling instead`);
            await this.api('/room/choice', { body: { avatarId: this.avatarId, action: 'dice' } });
            this.log('rolled the dice');
          }
        } else {
          await this.api('/room/choice', { body: { avatarId: this.avatarId, action: 'dice' } });
          this.log('rolled the dice');
        }
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

  /**
   * Babuni's simple rule: use an item if one solves the encounter, otherwise a
   * skill, otherwise roll the dice. Several matching items (or skills) are
   * chosen between at random, so the bots vary their play a little.
   */
  private async pickSolution(room: Room & { activeEncounter?: EncounterRequirements }): Promise<SolutionChoice | null> {
    const encounter = room.activeEncounter;
    if (!encounter) return null;
    const { avatar } = await this.api<{ avatar: { inventory?: Inventory } }>('/avatar/active');
    const inventory = avatar.inventory;
    if (!inventory) return null;
    const solutions = gameSolutions() as Record<string, { mSolutionName?: string; mSolutionType?: number }>;
    const kindOf = (solutionId: number): 'item' | 'skill' | null => {
      if (inventory.items.some((entry) => entry.solutionId === solutionId && entry.uses > 0)) return 'item';
      if (inventory.spellbook.some((entry) => entry.solutionId === solutionId && entry.uses > 0)) return 'skill';
      return null;
    };
    const owned = [...inventory.items, ...inventory.spellbook].filter((entry) => entry.uses > 0);

    const choices: SolutionChoice[] = [];
    for (const slot of SLOTS) {
      const charges = slotHasEnoughSolutionCharges({ encounter: encounter as never, inventory: inventory as never, slot });
      if (!charges.available) continue;
      // Same item the screen shows for the slot: the exact item for a primary
      // requirement, otherwise the lowest-id item of the required type.
      const solutionId = charges.isPrimary
        ? Number(encounter[`primarySolution${slot}`])
        : owned
          .filter((entry) => entry.solutionType === Number(encounter[`secondarySolutionType${slot}`]))
          .sort((left, right) => left.solutionId - right.solutionId)[0]?.solutionId;
      const kind = solutionId ? kindOf(solutionId) : null;
      if (!solutionId || !kind) continue;
      choices.push({ slot, solutionId, kind, name: solutions[String(solutionId)]?.mSolutionName ?? `#${solutionId}` });
    }
    const items = choices.filter((choice) => choice.kind === 'item');
    const skills = choices.filter((choice) => choice.kind === 'skill');
    if (items.length > 0) return pick(items);
    if (skills.length > 0) return pick(skills);
    return null;
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
    this.helpRoomFingerprint = '';
    this.helpProgressAt = Date.now();
    this.waitUntil = 0;
    this.log(`heard ${invite.fromPlayerName} call for help and joined their room`);
    return true;
  }

  /** Leave the room and go back to the welcome screen; report failures instead of hiding them. */
  private async leaveToWelcomeScreen(): Promise<void> {
    try {
      await this.api('/room/leave', { body: { avatarId: this.avatarId } });
      await this.api('/room/leave/all', { body: {} });
    } catch (error) {
      this.log(`leaving failed: ${error instanceof ApiError ? `${error.status} ${error.body.slice(0, 80)}` : String(error)}`);
    }
  }

  /**
   * While helping: play, and leave when the room ends, the caller leaves, or
   * nothing has happened in the room for a while (a caller who walked away
   * before the helpers arrived stays listed in their paused room).
   */
  private async helpStep(): Promise<void> {
    const helping = this.helping!;
    const room = await this.activeRoom();
    if (!room || room.roomId !== helping.roomId) {
      this.log(`${helping.fromPlayerName}'s room has ended; back to the welcome screen`);
      this.helping = null;
      await this.leaveToWelcomeScreen();
      return;
    }
    if (!room.participants.some((entry) => entry.playerId === helping.fromPlayerId)) {
      this.log(`${helping.fromPlayerName} left; leaving too`);
      this.helping = null;
      await this.leaveToWelcomeScreen();
      return;
    }
    const fingerprint = `${room.roomState}|${room.participants.map((entry) => `${entry.playerId}:${entry.choiceState}:${entry.continuePressed ? 1 : 0}`).join(',')}`;
    if (fingerprint !== this.helpRoomFingerprint) {
      this.helpRoomFingerprint = fingerprint;
      this.helpProgressAt = Date.now();
    } else if (Date.now() - this.helpProgressAt > HELP_STALE_MS) {
      this.log(`nothing has happened in ${helping.fromPlayerName}'s room for ${HELP_STALE_MS / 60_000} min; giving up and leaving`);
      this.helping = null;
      await this.leaveToWelcomeScreen();
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
