import express from 'express';
import { equipAvatarItem, EquipmentRequestError } from './services/equipmentService.js';
import { chooseAvatarSpecialization, SpecializationRequestError } from './services/specializationService.js';
import { AvatarEditRequestError, editAvatarLook } from './services/avatarEditService.js';
import { loadAvatarProgression } from './services/avatarProgressionService.js';
import type { NextFunction, Request, Response } from 'express';

import { sweepAbandonedRooms, validatePostgresConnection } from './db/postgresDocumentStore.js';
import { authMiddleware, requireAuth } from './middleware/authMiddleware.js';
import { getRecentActivityController } from './controllers/activityController.js';
import {
  claimPlayerDailyRewardController,
  getPlayerAchievementsController,
} from './controllers/achievementController.js';
import { donatePlayerGemsController } from './controllers/donateController.js';
import {
  selectPlayerDiceController,
  unlockPlayerDiceController,
} from './controllers/diceController.js';
import { unlockPlayerExpansionController } from './controllers/expansionController.js';
import {
  createCheckoutSessionController,
  stripeWebhookController,
} from './controllers/checkoutController.js';
import { readPlayerDiceState } from './services/diceService.js';
import {
  addPlayerFriendController,
  getFriendAchievementsController,
  listPlayerFriendsController,
} from './controllers/friendController.js';
import {
  createSoulLinkController,
  getSoulLinkController,
} from './controllers/soulLinkController.js';
import {
  getPlayerProfileController,
  setAvatarDisplayTitleController,
} from './controllers/playerProfileController.js';
import { toPersistedAvatarDto } from './services/avatarPresentation.js';
import {
  AvatarDeathError,
  finalizeAvatarDeath,
  InsufficientGemsForSacrificeError,
  readAvatarLifeStatus,
  sacrificeFailedAvatar,
} from './services/avatarDeathService.js';
import { registerAchievementHandlers } from './domain/achievements/registerAchievementHandlers.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { roomRoutes } from './routes/roomRoutes.js';
import { loadAvatar } from './services/encounterPersistence.js';
import { loadInventory } from './services/inventoryService.js';
import {
  bootstrapSession,
  heartbeatSession,
  issueSessionChallenge,
  logoutSession,
} from './services/sessionService.js';
import {
  getEncounters,
  getFramesData,
  getGameContentBundle,
  getPortraitsData,
  getSolutionMap,
  loadStaticGameEnvironment,
} from './services/gameData.js';
import {
  deletePlayerAvatar,
  loadPlayerActiveAvatar,
  loadPlayerAvatars,
  getPlayerUnlockedExpansions,
  loadPlayer,
  AvatarLimitReachedError,
  savePlayerAvatar,
  selectPlayerAvatar,
} from './services/playerService.js';
import { loadAllowedClientOrigins } from './config/corsOrigins.js';
import { resolveTrustProxySetting } from './config/trustProxy.js';
import { logAndFormatRequestError } from './http/errorResponse.js';

const app = express();
// Behind the /Morkahja/api reverse proxy, req.ip must be the player's address
// (from X-Forwarded-For), not the proxy's, for the per-IP auth rate limit.
app.set('trust proxy', resolveTrustProxySetting(process.env.TRUST_PROXY));
const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGINS = loadAllowedClientOrigins();
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 25;
const authRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

loadStaticGameEnvironment();

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && CLIENT_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// Stripe webhook needs the raw request body for signature verification, so it
// must be registered before the JSON body parser and before auth middleware.
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookController,
);

app.use(express.json({ limit: '32kb' }));

function authRateLimitKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${req.path}`;
}

function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = authRateLimitKey(req);
  const current = authRateLimitBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS }
    : current;

  bucket.count += 1;
  authRateLimitBuckets.set(key, bucket);
  if (bucket.count > AUTH_RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'RATE_LIMITED' });
    return;
  }

  next();
}


/** Uses existing nginx proxy for `/game-data` — no extra nginx rules needed */
app.use('/game-data/admin', adminRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    features: {
      activityFeed: true,
    },
  });
});

/** Single source of game content for the client; revalidated with an ETag on each load. */
app.get('/game-data/content', (req: Request, res: Response) => {
  const bundle = getGameContentBundle();
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', bundle.etag);
  if (req.headers['if-none-match'] === bundle.etag) {
    res.status(304).end();
    return;
  }
  res.type('application/json').send(bundle.body);
});

app.get('/game-data/status', (_req: Request, res: Response) => {
  const encounters = getEncounters();
  const solutions = getSolutionMap();
  const frames = getFramesData();
  const portraits = getPortraitsData();

  res.json({
    status: 'ok',
    encounters: Object.keys(encounters).length,
    solutions: Object.keys(solutions).length,
    frames: frames.Frames.length,
    portraits: portraits.Avatar.length,
  });
});

app.post('/session/challenge', authRateLimit, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const challenge = await issueSessionChallenge({
    devicePublicKey: typeof body.devicePublicKey === 'string' ? body.devicePublicKey : '',
    identityPublicKey: typeof body.identityPublicKey === 'string' ? body.identityPublicKey : '',
    purpose: body.purpose as 'register' | 'restore',
  });
  res.status(201).json(challenge);
});

app.post('/session/bootstrap', authRateLimit, async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const devicePublicKey = typeof body.devicePublicKey === 'string'
    ? body.devicePublicKey
    : '';
  const identityPublicKey = typeof body.identityPublicKey === 'string'
    ? body.identityPublicKey
    : undefined;
  const playerName = typeof body.playerName === 'string'
    ? body.playerName
    : undefined;
  const signedIdentityChallenge = (
    body.signedIdentityChallenge &&
    typeof body.signedIdentityChallenge === 'object' &&
    typeof (body.signedIdentityChallenge as Record<string, unknown>).challenge === 'string' &&
    typeof (body.signedIdentityChallenge as Record<string, unknown>).signature === 'string'
  )
    ? body.signedIdentityChallenge as { challenge: string; signature: string }
    : undefined;

  const signedDeviceChallenge = (
    body.signedDeviceChallenge &&
    typeof body.signedDeviceChallenge === 'object' &&
    typeof (body.signedDeviceChallenge as Record<string, unknown>).challenge === 'string' &&
    typeof (body.signedDeviceChallenge as Record<string, unknown>).signature === 'string'
  )
    ? body.signedDeviceChallenge as { challenge: string; signature: string }
    : undefined;

  if (!devicePublicKey) {
    res.status(400).json({ error: 'devicePublicKey is required' });
    return;
  }

  const session = await bootstrapSession({
    devicePublicKey,
    identityPublicKey,
    playerName,
    purpose: body.purpose as 'register' | 'restore',
    signedIdentityChallenge,
    signedDeviceChallenge,
  });

  res.status(201).json(session);
});

app.post('/session/heartbeat', authRateLimit, async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'SESSION_INVALID' });
    return;
  }

  const session = await heartbeatSession(token);
  res.json({
    ok: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
  });
});

app.post('/session/logout', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'SESSION_INVALID' });
    return;
  }

  await logoutSession(token);
  res.json({ ok: true });
});

// Mount authenticated game API.
app.use(authMiddleware);
app.use('/room', roomRoutes);
app.get('/activity/recent', getRecentActivityController);
app.get('/player/achievements', getPlayerAchievementsController);
app.post('/player/daily-reward/claim', claimPlayerDailyRewardController);
app.post('/player/donate', donatePlayerGemsController);
app.post('/player/expansions/unlock', unlockPlayerExpansionController);
app.post('/player/dice/unlock', unlockPlayerDiceController);
app.post('/player/dice/select', selectPlayerDiceController);
app.post('/player/checkout/session', createCheckoutSessionController);
app.get('/player/friends', listPlayerFriendsController);
app.post('/player/friends', addPlayerFriendController);
app.get('/player/friends/:friendId/achievements', getFriendAchievementsController);
app.get('/player/soul-link', getSoulLinkController);
app.post('/player/soul-link', createSoulLinkController);
app.get('/player/profile', getPlayerProfileController);
app.patch('/avatar/:avatarId/display-title', setAvatarDisplayTitleController);

app.get('/player', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const player = await loadPlayer(playerId);

  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  const dice = await readPlayerDiceState(playerId);

  res.json({
    ...player,
    playerId,
    unlockedExpansions: await getPlayerUnlockedExpansions(playerId),
    unlockedDiceIds: dice.unlockedDiceIds,
    selectedDiceId: dice.selectedDiceId,
  });
});

app.get('/avatar', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = typeof req.query.avatarId === 'string'
    ? req.query.avatarId
    : null;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  const avatar = await loadAvatar(playerId, avatarId);

  if (!avatar) {
    res.status(404).json({ error: 'Avatar not found' });
    return;
  }

  res.json({
    avatarId,
    ...avatar,
    inventory: avatar.inventory ?? await loadInventory(playerId, avatarId),
  });
});

app.get('/avatars', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatars = (await loadPlayerAvatars(playerId))
    .filter((avatar) => readAvatarLifeStatus(avatar) !== 'deceased')
    .map(toPersistedAvatarDto)
    .filter((avatar): avatar is NonNullable<ReturnType<typeof toPersistedAvatarDto>> => avatar !== null);
  // The overview card's statistics (at most three avatars).
  const withStats = await Promise.all(avatars.map(async (avatar) => ({
    ...avatar,
    encountersPlayed: (await loadAvatarProgression(playerId, avatar.id)).encountersCompleted,
  })));
  res.json({ playerId, avatars: withStats });
});

app.get('/avatar/active', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatar = await loadPlayerActiveAvatar(playerId);

  if (!avatar) {
    res.status(404).json({ error: 'No active avatar' });
    return;
  }

  res.json({ playerId, avatar });
});

app.post('/avatar', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const required = ['id', 'name', 'race', 'role', 'portrait', 'frame'] as const;

  for (const key of required) {
    if (typeof body[key] !== 'string') {
      res.status(400).json({ error: `${key} is required` });
      return;
    }
  }

  try {
    const avatar = await savePlayerAvatar(playerId, {
      id: body.id as string,
      name: body.name as string,
      race: body.race as never,
      role: body.role as never,
      portrait: body.portrait as string,
      frame: body.frame as string,
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
      lastPlayedAt: typeof body.lastPlayedAt === 'number' ? body.lastPlayedAt : undefined,
    });

    const avatarDto = toPersistedAvatarDto(avatar);
    res.status(201).json({ playerId, avatar: avatarDto ?? avatar });
  } catch (error) {
    if (error instanceof AvatarLimitReachedError) {
      res.status(409).json({ error: 'AVATAR_LIMIT_REACHED' });
      return;
    }

    throw error;
  }
});

app.delete('/avatar/:avatarId', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  await deletePlayerAvatar(playerId, avatarId);
  res.json({ ok: true });
});

app.post('/avatar/select', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const required = ['id', 'name', 'race', 'role', 'portrait', 'frame'] as const;

  for (const key of required) {
    if (typeof body[key] !== 'string') {
      res.status(400).json({ error: `${key} is required` });
      return;
    }
  }

  const avatar = await selectPlayerAvatar(playerId, {
    id: body.id as string,
    name: body.name as string,
    race: body.race as never,
    role: body.role as never,
    portrait: body.portrait as string,
    frame: body.frame as string,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
    lastPlayedAt: typeof body.lastPlayedAt === 'number' ? body.lastPlayedAt : undefined,
  });

  const avatarDto = toPersistedAvatarDto(avatar);
  res.json({ playerId, avatar: avatarDto ?? avatar });
});

app.post('/avatar/:avatarId/sacrifice', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  if (body.confirm !== true) {
    res.status(400).json({ error: 'confirm must be true', code: 'CONFIRMATION_REQUIRED' });
    return;
  }

  try {
    const result = await sacrificeFailedAvatar(playerId, avatarId);
    const avatarDto = toPersistedAvatarDto(result.avatar);
    if (!avatarDto) {
      res.status(500).json({ error: 'Sacrifice succeeded but avatar could not be serialized' });
      return;
    }

    const { toEncounterRoomSnapshotDto } = await import('./services/roomDtoMapper.js');
    const roomDto = result.room
      ? await toEncounterRoomSnapshotDto(result.room, playerId)
      : null;

    res.json({
      playerId,
      avatar: avatarDto,
      spent: result.spent,
      currencies: result.currencies,
      room: roomDto,
    });
  } catch (error) {
    if (error instanceof InsufficientGemsForSacrificeError) {
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }
    if (error instanceof AvatarDeathError) {
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});

app.post('/avatar/:avatarId/equipment', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;
  const body = req.body as Record<string, unknown>;

  if (!avatarId || typeof body.slot !== 'number' || typeof body.solutionId !== 'number') {
    res.status(400).json({ error: 'avatarId, slot and solutionId are required' });
    return;
  }

  try {
    const inventory = await equipAvatarItem(playerId, avatarId, body.slot, body.solutionId);
    res.json({ playerId, avatarId, inventory });
  } catch (error) {
    if (error instanceof EquipmentRequestError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});

app.post('/avatar/:avatarId/edit', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;
  const body = req.body as Record<string, unknown>;

  if (!avatarId || typeof body.portraitId !== 'number' || typeof body.frameId !== 'number' || typeof body.name !== 'string') {
    res.status(400).json({ error: 'avatarId, portraitId, frameId and name are required' });
    return;
  }

  try {
    const result = await editAvatarLook(playerId, avatarId, {
      portraitId: body.portraitId,
      frameId: body.frameId,
      name: body.name,
    });
    res.json({ playerId, avatarId, avatar: toPersistedAvatarDto(result.avatar), spent: result.spent, currencies: result.currencies });
  } catch (error) {
    if (error instanceof AvatarEditRequestError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});

app.post('/avatar/:avatarId/specialization', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;
  const body = req.body as Record<string, unknown>;

  if (!avatarId || typeof body.specialization !== 'number') {
    res.status(400).json({ error: 'avatarId and specialization are required' });
    return;
  }

  try {
    const result = await chooseAvatarSpecialization(playerId, avatarId, body.specialization);
    res.json({ playerId, avatarId, ...result });
  } catch (error) {
    if (error instanceof SpecializationRequestError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});

app.post('/avatar/:avatarId/finalize-death', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  try {
    const avatar = await finalizeAvatarDeath(playerId, avatarId);
    res.json({
      playerId,
      avatarId: avatar.id ?? avatarId,
      status: readAvatarLifeStatus(avatar),
    });
  } catch (error) {
    if (error instanceof AvatarDeathError) {
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});

app.use(
  (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      return;
    }

    const { status, body } = logAndFormatRequestError(error, req);
    res.status(status).json(body);
  },
);

try {
  const connectionInfo = await validatePostgresConnection();

  console.log(
    [
      'PostgreSQL connection established',
      `database=${connectionInfo.databaseName}`,
      `host=${connectionInfo.host}`,
      `port=${connectionInfo.port}`,
      `usingDefaultConnection=${connectionInfo.usingDefaultConnection}`,
    ].join(' '),
  );

  registerAchievementHandlers();

  // Rooms nobody can return to are removed at start and every six hours (D-048).
  const sweepRooms = async (): Promise<void> => {
    try {
      const removed = await sweepAbandonedRooms();
      const total = removed.closed + removed.withoutLivingAvatar + removed.superseded + removed.untouched;
      if (total > 0) {
        console.log(
          `Removed ${total} abandoned room(s): ${removed.closed} closed, `
          + `${removed.withoutLivingAvatar} without a living avatar, ${removed.superseded} superseded by a newer room, `
          + `${removed.untouched} untouched for 30 days`,
        );
      }
    } catch (error) {
      console.error('Abandoned room sweep failed', error);
    }
  };
  // After the server is listening, so a long sweep never delays start-up.
  setTimeout(() => void sweepRooms(), 0).unref();
  setInterval(() => void sweepRooms(), 6 * 60 * 60 * 1000).unref();

  app.listen(PORT, () => {
    console.log(`Morkahja server running on port ${PORT}`);
    console.log(
      `CORS allowed origins: ${[...CLIENT_ORIGINS].join(', ') || '(none — set CLIENT_ORIGINS)'}`,
    );
  });
} catch (error) {
  console.error('PostgreSQL startup validation failed');
  console.error(error);
  process.exitCode = 1;
}

export { app };
