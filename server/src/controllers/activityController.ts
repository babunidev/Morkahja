import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { queryActivityFeed } from '../services/gameEventService.js';

export async function getRecentActivityController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const entries = await queryActivityFeed(playerId);

  res.json({
    playerId,
    entries,
    windowMs: 15 * 60 * 1000,
  });
}
