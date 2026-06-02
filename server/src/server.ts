import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { validatePostgresConnection } from './db/postgresDocumentStore.js';
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
import { registerAchievementHandlers } from './domain/achievements/registerAchievementHandlers.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { encounterRoutes } from './routes/encounterRoutes.js';
import { roomRoutes } from './routes/roomRoutes.js';
import { createEncounter } from './services/encounterGenerator.js';
import { loadAvatar } from './services/encounterPersistence.js';
import { loadInventory } from './services/inventoryService.js';
import {
  bootstrapSession,
  heartbeatSession,
  logoutSession,
} from './services/sessionService.js';
import {
  getEncounters,
  getFramesData,
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
import { logAndFormatRequestError } from './http/errorResponse.js';

const app = express();
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

// Future runtime hooks:
// app.use(requestLogger);
// app.use(multiplayerSessionHooks);

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

  if (!devicePublicKey) {
    res.status(400).json({ error: 'devicePublicKey is required' });
    return;
  }

  const session = await bootstrapSession({
    devicePublicKey,
    identityPublicKey,
    playerName,
    signedIdentityChallenge,
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
app.use('/encounter', encounterRoutes);
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
    .map(toPersistedAvatarDto)
    .filter((avatar): avatar is NonNullable<ReturnType<typeof toPersistedAvatarDto>> => avatar !== null);
  res.json({ playerId, avatars });
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
  const encounter = await createEncounter(playerId, avatar.id ?? (body.id as string));

  const avatarDto = toPersistedAvatarDto(avatar);
  res.json({ playerId, avatar: avatarDto ?? avatar, encounter });
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
