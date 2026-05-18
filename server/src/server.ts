import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { encounterControllerErrorStatus } from './controllers/encounterController.js';
import { validatePostgresConnection } from './db/postgresDocumentStore.js';
import { encounterRoutes } from './routes/encounterRoutes.js';
import { createEncounter } from './services/encounterGenerator.js';
import { loadAvatar } from './services/encounterPersistence.js';
import {
  getEncounters,
  getFramesData,
  getPortraitsData,
  getSolutionMap,
  loadStaticGameEnvironment,
} from './services/gameData.js';
import {
  addBabuniYellowRedGems,
  BABUNI_PLAYER_ID,
  deleteBabuniAvatar,
  loadBabuniActiveAvatar,
  loadBabuniAvatars,
  loadPlayer,
  saveBabuniAvatar,
  selectBabuniAvatar,
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
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(express.json());

// Future runtime hooks:
// app.use(authMiddleware);
// app.use(requestLogger);
// app.use(multiplayerSessionHooks);

// Mount encounter system API.
app.use('/encounter', encounterRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
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

app.get('/player', async (_req: Request, res: Response) => {
  const playerId = BABUNI_PLAYER_ID;
  const player = await loadPlayer(playerId);

  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  res.json({ playerId, ...player });
});

app.post('/player/currency/yellow_red_gem', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const loreGemClaimKey = typeof body.encounterKey === 'string'
    ? body.encounterKey
    : undefined;
  const { currencies, granted } = await addBabuniYellowRedGems(1, loreGemClaimKey);

  res.json({ playerId: BABUNI_PLAYER_ID, currencies, granted });
});

app.get('/avatar', async (req: Request, res: Response) => {
  const playerId = BABUNI_PLAYER_ID;
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

app.get('/avatars', async (_req: Request, res: Response) => {
  const avatars = await loadBabuniAvatars();
  res.json({ playerId: BABUNI_PLAYER_ID, avatars });
});

app.get('/avatar/active', async (_req: Request, res: Response) => {
  const avatar = await loadBabuniActiveAvatar();

  if (!avatar) {
    res.status(404).json({ error: 'No active avatar' });
    return;
  }

  res.json({ playerId: BABUNI_PLAYER_ID, avatar });
});

app.post('/avatar', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const required = ['id', 'name', 'race', 'role', 'portrait', 'frame'] as const;

  for (const key of required) {
    if (typeof body[key] !== 'string') {
      res.status(400).json({ error: `${key} is required` });
      return;
    }
  }

  const avatar = await saveBabuniAvatar({
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

  res.status(201).json({ playerId: BABUNI_PLAYER_ID, avatar });
});

app.delete('/avatar/:avatarId', async (req: Request, res: Response) => {
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  await deleteBabuniAvatar(avatarId);
  res.json({ ok: true });
});

app.post('/avatar/select', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const required = ['id', 'name', 'race', 'role', 'portrait', 'frame'] as const;

  for (const key of required) {
    if (typeof body[key] !== 'string') {
      res.status(400).json({ error: `${key} is required` });
      return;
    }
  }

  const avatar = await selectBabuniAvatar({
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
  const encounter = await createEncounter(BABUNI_PLAYER_ID, avatar.id ?? (body.id as string));

  res.json({ playerId: BABUNI_PLAYER_ID, avatar, encounter });
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = encounterControllerErrorStatus(error);
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

  app.listen(PORT, () => {
    console.log(`Morkahja server running on port ${PORT}`);
  });
} catch (error) {
  console.error('PostgreSQL startup validation failed');
  console.error(error);
  process.exitCode = 1;
}

export { app };
