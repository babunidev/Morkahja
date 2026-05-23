import type { Request, Response } from 'express';
import {
  getEncounters,
  getExpansionById,
  getExpansions,
  getFramesData,
  getPortraitsData,
  getSolutionMap,
  saveEncounterEntry,
  saveExpansionEntry,
  saveFrameEntry,
  savePortraitEntry,
  saveSolutionEntry,
  type ExpansionData,
  type FrameData,
  type PortraitData,
} from '../services/gameData.js';
import type { EncounterData, SolutionData } from '../engine/types.js';
import {
  banAdminPlayer,
  getAdminDashboard,
  listAdminActivity,
  listAdminPlayers,
  listOnlineAdminPlayers,
  timeoutAdminPlayer,
  unbanAdminPlayer,
} from '../services/adminPlayerService.js';

function readBodyRecord(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object'
    ? req.body as Record<string, unknown>
    : {};
}

export function getAdminServerStatus(_req: Request, res: Response): void {
  res.json({
    label: 'Morkahja Prime',
    state: 'online',
    version: process.env.npm_package_version ?? 'live',
    region: 'Hetzner CX23',
  });
}

export async function getAdminDashboardHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await getAdminDashboard());
}

export async function getAdminPlayersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await listAdminPlayers());
}

export async function getAdminOnlinePlayersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await listOnlineAdminPlayers());
}

export async function getAdminActivityHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await listAdminActivity());
}

export async function postAdminTimeoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = readBodyRecord(req);
  const playerId = typeof body.playerId === 'string' ? body.playerId : '';
  const durationMinutes = Number(body.durationMinutes);

  if (!playerId || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  const player = await timeoutAdminPlayer(
    playerId,
    durationMinutes,
    typeof body.reason === 'string' ? body.reason : undefined,
  );

  if (!player) {
    res.status(404).json({ ok: false, playerId, message: 'Player not found' });
    return;
  }

  res.json({
    ok: true,
    playerId,
    message: `${player.name} timed out for ${durationMinutes}m`,
  });
}

export async function postAdminBanHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = readBodyRecord(req);
  const playerId = typeof body.playerId === 'string' ? body.playerId : '';

  if (!playerId) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  const player = await banAdminPlayer(
    playerId,
    typeof body.reason === 'string' ? body.reason : undefined,
  );

  if (!player) {
    res.status(404).json({ ok: false, playerId, message: 'Player not found' });
    return;
  }

  res.json({ ok: true, playerId, message: `${player.name} banned` });
}

export async function postAdminUnbanHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = readBodyRecord(req);
  const playerId = typeof body.playerId === 'string' ? body.playerId : '';

  if (!playerId) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  const player = await unbanAdminPlayer(playerId);

  if (!player) {
    res.status(404).json({ ok: false, playerId, message: 'Player not found' });
    return;
  }

  res.json({ ok: true, playerId, message: `${player.name} unbanned` });
}

export function getAdminEncountersHandler(_req: Request, res: Response): void {
  res.json(getEncounters());
}

export function getAdminSolutionsHandler(_req: Request, res: Response): void {
  const solutions = getSolutionMap();
  const raw: Record<string, SolutionData> = {};
  for (const [id, entry] of Object.entries(solutions)) {
    raw[id] = entry;
  }
  res.json(raw);
}

export function getAdminExpansionsHandler(_req: Request, res: Response): void {
  const expansions: Record<string, ExpansionData> = {};
  for (const entry of getExpansions()) {
    expansions[String(entry.mExtensioID)] = entry;
  }
  res.json({ expansions });
}

export function getAdminFramesHandler(_req: Request, res: Response): void {
  res.json(getFramesData());
}

export function getAdminPortraitsHandler(_req: Request, res: Response): void {
  res.json(getPortraitsData());
}

export function postAdminEncounterHandler(req: Request, res: Response): void {
  const body = readBodyRecord(req);
  const key = typeof body.key === 'string' ? body.key : '';
  const data = body.data as EncounterData | undefined;

  if (!key || !data) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  saveEncounterEntry(key, data);
  res.status(201).json({ ok: true, key });
}

export function postAdminSolutionHandler(req: Request, res: Response): void {
  const body = readBodyRecord(req);
  const key = typeof body.key === 'string' ? body.key : '';
  const data = body.data as SolutionData | undefined;

  if (!key || !data) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  saveSolutionEntry(key, data);
  res.status(201).json({ ok: true, key });
}

export function postAdminExpansionHandler(req: Request, res: Response): void {
  const body = readBodyRecord(req);
  const key = typeof body.key === 'string' ? body.key : '';
  const data = body.data as ExpansionData | undefined;

  if (!key || !data) {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  saveExpansionEntry(key, data);
  res.status(201).json({ ok: true, key, id: data.mExtensioID });
}

export function postAdminFrameHandler(req: Request, res: Response): void {
  const body = readBodyRecord(req);
  const data = body as unknown as FrameData;

  if (!data || typeof data.frameID !== 'number') {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  saveFrameEntry(data);
  res.status(201).json({ ok: true, frameID: data.frameID });
}

export function postAdminPortraitHandler(req: Request, res: Response): void {
  const body = readBodyRecord(req);
  const data = body as unknown as PortraitData;

  if (!data || typeof data.avatarID !== 'number') {
    res.status(400).json({ error: 'INVALID_REQUEST' });
    return;
  }

  savePortraitEntry(data);
  res.status(201).json({ ok: true, avatarID: data.avatarID });
}

export function getAdminExpansionByIdHandler(req: Request, res: Response): void {
  const id = Number(req.params.id);
  const entry = getExpansionById(id);
  if (!entry) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(entry);
}
