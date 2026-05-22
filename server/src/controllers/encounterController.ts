import type { NextFunction, Request, Response } from 'express';

import {
  clearEncounter,
  continueEncounter,
  createEncounter,
  getActiveEncounter,
  resolveEncounter,
} from '../services/encounterGenerator.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import type { PlayerEncounterAction } from '../types/encounterSnapshot.js';

class RequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

type RequestValue = string | string[] | undefined;

function firstValue(value: RequestValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestValue(req: Request, key: 'avatarId'): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  const bodyValue = body?.[key];

  if (typeof bodyValue === 'string') {
    return bodyValue;
  }

  return firstValue(req.query[key] as RequestValue);
}

function requireIdentity(req: Request): { playerId: string; avatarId: string } {
  const auth = requireAuth(req);
  const avatarId = requestValue(req, 'avatarId');

  if (!avatarId) {
    throw new RequestError('avatarId is required');
  }

  return { playerId: auth.playerId, avatarId };
}

function toPlayerAction(action: unknown): PlayerEncounterAction {
  switch (action) {
    case 'A':
      return { type: 'primaryA' };
    case 'B':
      return { type: 'secondaryB' };
    case 'C':
      return { type: 'primaryC' };
    case 'D':
      return { type: 'secondaryD' };
    case 'dice':
      return { type: 'dice' };
    default:
      throw new RequestError('action must be one of: A, B, C, D, dice');
  }
}

function handleControllerError(error: unknown, next: NextFunction): void {
  next(error);
}

export async function createEncounterController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = requireIdentity(req);
    const snapshot = await createEncounter(playerId, avatarId);

    res.status(201).json(snapshot);
  } catch (error) {
    handleControllerError(error, next);
  }
}

export async function getActiveEncounterController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = requireIdentity(req);
    const snapshot = await getActiveEncounter(playerId, avatarId);

    if (!snapshot) {
      res.status(404).json({ error: 'No active encounter snapshot' });
      return;
    }

    res.json(snapshot);
  } catch (error) {
    handleControllerError(error, next);
  }
}

export async function resolveEncounterController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = requireIdentity(req);
    const body = req.body as Record<string, unknown> | undefined;
    const action = toPlayerAction(body?.action);
    const { snapshot, resolution } = await resolveEncounter(
      playerId,
      avatarId,
      action,
    );

    res.json({
      success: resolution.success,
      selectedRoll: resolution.selectedRoll,
      slotResults: resolution.slotResults,
      rewards: resolution.rewards,
      message: resolution.message,
      failurePenalty: resolution.failurePenalty,
      usedInventorySolutions: resolution.usedInventorySolutions,
      snapshot,
    });
  } catch (error) {
    handleControllerError(error, next);
  }
}

export async function continueEncounterController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = requireIdentity(req);
    const body = req.body as Record<string, unknown> | undefined;
    const action = toPlayerAction(body?.action);
    const result = await continueEncounter(
      playerId,
      avatarId,
      action,
    );
    const { avatar, snapshot, resolution } = result;

    res.json({
      avatar,
      snapshot,
      success: resolution.success,
      selectedRoll: resolution.selectedRoll,
      slotResults: resolution.slotResults,
      rewards: resolution.rewards,
      message: resolution.message,
      failurePenalty: resolution.failurePenalty,
      usedInventorySolutions: resolution.usedInventorySolutions,
      deathTriggered: result.deathTriggered,
      avatarDied: result.avatarDied,
    });
  } catch (error) {
    handleControllerError(error, next);
  }
}

export async function clearEncounterController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = requireIdentity(req);
    await clearEncounter(playerId, avatarId);

    res.json({ ok: true });
  } catch (error) {
    handleControllerError(error, next);
  }
}

export function encounterControllerErrorStatus(error: unknown): number {
  return error instanceof RequestError ? error.statusCode : 500;
}
