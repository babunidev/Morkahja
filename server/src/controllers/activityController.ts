import type { Request, Response } from 'express';
import { ACTIVITY_FEED_WINDOW_MS } from '../domain/events/GameEvent.js';
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
    windowMs: ACTIVITY_FEED_WINDOW_MS,
  });
}
