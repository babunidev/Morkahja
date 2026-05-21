import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  claimPlayerDailyReward,
  getAchievementsSnapshot,
} from '../services/achievementService.js';

export async function getPlayerAchievementsController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const snapshot = await getAchievementsSnapshot(playerId);

  res.json({
    playerId,
    ...snapshot,
  });
}

export async function claimPlayerDailyRewardController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const result = await claimPlayerDailyReward(playerId);

  res.json({
    playerId,
    granted: result.granted,
    currencies: result.currencies,
    achievements: result.achievements.achievements,
    dailyReward: result.achievements.dailyReward,
  });
}
