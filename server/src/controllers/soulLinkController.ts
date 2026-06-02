import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  CannotSoulLinkSelfError,
  createSoulLink,
  getSoulLink,
  SoulLinkAlreadySetError,
  SoulLinkTargetNotFoundError,
} from '../services/soulLinkService.js';

export async function getSoulLinkController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const soulLink = await getSoulLink(playerId);

  res.json({
    playerId,
    soulLink,
  });
}

export async function createSoulLinkController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const query = typeof body.query === 'string'
    ? body.query
    : typeof body.playerName === 'string'
      ? body.playerName
      : typeof body.targetId === 'string'
        ? body.targetId
        : '';

  try {
    const result = await createSoulLink(playerId, query);

    res.json({
      playerId,
      soulLink: result.soulLink,
      friend: result.friend,
      friendIds: result.friendIds,
    });
  } catch (error) {
    if (error instanceof SoulLinkTargetNotFoundError) {
      res.status(404).json({ error: 'PLAYER_NOT_FOUND' });
      return;
    }

    if (error instanceof CannotSoulLinkSelfError) {
      res.status(400).json({ error: 'CANNOT_SOUL_LINK_SELF' });
      return;
    }

    if (error instanceof SoulLinkAlreadySetError) {
      res.status(409).json({ error: 'SOUL_LINK_ALREADY_SET' });
      return;
    }

    throw error;
  }
}
