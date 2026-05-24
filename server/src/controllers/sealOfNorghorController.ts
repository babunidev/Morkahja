import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { loadPlayer } from '../services/playerService.js';
import {
  activateSealOfNorghor,
  buildSealOfNorghorStatus,
  InsufficientGemsForSealError,
  SealOfNorghorAlreadyActiveError,
} from '../services/sealOfNorghorService.js';

export async function activateSealOfNorghorController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);

  try {
    const result = await activateSealOfNorghor(playerId);

    res.json({
      playerId,
      spent: result.spent,
      currencies: result.currencies,
      sealOfNorghor: result.sealOfNorghor,
      unlockedExpansions: result.unlockedExpansions,
    });
  } catch (error) {
    if (error instanceof SealOfNorghorAlreadyActiveError) {
      res.status(409).json({ error: 'SEAL_ALREADY_ACTIVE' });
      return;
    }

    if (error instanceof InsufficientGemsForSealError) {
      res.status(400).json({ error: 'INSUFFICIENT_GEMS' });
      return;
    }

    throw error;
  }
}

export async function getSealOfNorghorStatusController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const player = await loadPlayer(playerId);

  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }

  res.json({
    playerId,
    sealOfNorghor: buildSealOfNorghorStatus(player),
  });
}
