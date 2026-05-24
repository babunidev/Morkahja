import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getPlayerProfile } from '../services/playerProfileService.js';

export async function getPlayerProfileController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const profile = await getPlayerProfile(playerId);

  if (!profile) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  res.json(profile);
}
