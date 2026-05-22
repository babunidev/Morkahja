import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { encounterControllerErrorStatus } from './controllers/encounterController.js';
import { validatePostgresConnection } from './db/postgresDocumentStore.js';
import { authMiddleware, requireAuth } from './middleware/authMiddleware.js';
import { getRecentActivityController } from './controllers/activityController.js';
import {
  claimPlayerDailyRewardController,
  getPlayerAchievementsController,
} from './controllers/achievementController.js';
import { registerAchievementHandlers } from './domain/achievements/registerAchievementHandlers.js';
import { encounterRoutes } from './routes/encounterRoutes.js';
import { createEncounter } from './services/encounterGenerator.js';
import { loadAvatar } from './services/encounterPersistence.js';
import {
  bootstrapSession,
  heartbeatSession,
  logoutSession,
  SessionError,
} from './services/sessionService.js';
import {
  getEncounters,
  getFramesData,
  getPortraitsData,
  getSolutionMap,
  loadStaticGameEnvironment,
} from './services/gameData.js';
import {
  addPlayerYellowRedGems,
  deletePlayerAvatar,
  loadPlayerActiveAvatar,
  loadPlayerAvatars,
  loadPlayer,
  AvatarLimitReachedError,
  savePlayerAvatar,
  selectPlayerAvatar,
} from './services/playerService.js';

const app = express();
const PORT = 3000;
const CLIENT_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

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
app.use(express.json());

// Future runtime hooks:
// app.use(requestLogger);
// app.use(multiplayerSessionHooks);

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

app.post('/session/bootstrap', async (req: Request, res: Response) => {
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

app.post('/session/heartbeat', async (req: Request, res: Response) => {
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
app.get('/activity/recent', getRecentActivityController);
app.get('/player/achievements', getPlayerAchievementsController);
app.post('/player/daily-reward/claim', claimPlayerDailyRewardController);

app.get('/player', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const player = await loadPlayer(playerId);

  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  res.json({ ...player, playerId });
});

app.post('/player/currency/yellow_red_gem', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const loreGemClaimKey = typeof body.encounterKey === 'string'
    ? body.encounterKey
    : undefined;
  const { currencies, granted } = await addPlayerYellowRedGems(playerId, 1, loreGemClaimKey);

  res.json({ playerId, currencies, granted });
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

  res.json({ avatarId, ...avatar });
});

app.get('/avatars', async (req: Request, res: Response) => {
  const { playerId } = requireAuth(req);
  const avatars = await loadPlayerAvatars(playerId);
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
      level: typeof body.level === 'number' ? body.level : 1,
      experience: typeof body.experience === 'number' ? body.experience : 0,
      inventory: body.inventory,
      portrait: body.portrait as string,
      frame: body.frame as string,
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
      lastPlayedAt: typeof body.lastPlayedAt === 'number' ? body.lastPlayedAt : undefined,
    });

    res.status(201).json({ playerId, avatar });
  } catch (error) {
    if (error instanceof AvatarLimitReachedError) {
      res.status(409).json({ error: 'AVATAR_LIMIT_REACHED', message: error.message });
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
    level: typeof body.level === 'number' ? body.level : 1,
    experience: typeof body.experience === 'number' ? body.experience : 0,
    inventory: body.inventory,
    portrait: body.portrait as string,
    frame: body.frame as string,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : undefined,
    lastPlayedAt: typeof body.lastPlayedAt === 'number' ? body.lastPlayedAt : undefined,
  });
  const encounter = await createEncounter(playerId, avatar.id ?? (body.id as string));

  res.json({ playerId, avatar, encounter });
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof SessionError
      ? error.statusCode
      : encounterControllerErrorStatus(error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    res.status(status).json({ error: message });
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
  });
} catch (error) {
  console.error('PostgreSQL startup validation failed');
  console.error(error);
  process.exitCode = 1;
}

export { app };
