import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getExpansionById } from '../services/gameData.js';
import {
  recordAccountKeySecurityReminder,
} from '../services/privateScribeService.js';
import {
  ExpansionAlreadyUnlockedError,
  ExpansionInactiveError,
  ExpansionNotFoundError,
  InsufficientGemsForExpansionError,
  unlockPlayerExpansion,
} from '../services/playerService.js';

export async function unlockPlayerExpansionController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const expansionId = body.expansionId;

  if (typeof expansionId !== 'number' || !Number.isInteger(expansionId) || expansionId <= 0) {
    res.status(400).json({ error: 'INVALID_EXPANSION_ID' });
    return;
  }

  try {
    const result = await unlockPlayerExpansion(playerId, expansionId);
    const expansion = getExpansionById(expansionId);
    const itemLabel = expansion?.mExtensioName ?? `Expansion ${expansionId}`;

    try {
      await recordAccountKeySecurityReminder(playerId, { itemLabel });
    } catch (error) {
      console.error('Failed to record account key security reminder after expansion unlock', error);
    }

    res.json({
      playerId,
      expansionId: result.expansionId,
      spent: result.spent,
      currencies: result.currencies,
      unlockedExpansions: result.unlockedExpansions,
    });
  } catch (error) {
    if (error instanceof ExpansionNotFoundError) {
      res.status(404).json({ error: 'EXPANSION_NOT_FOUND' });
      return;
    }

    if (error instanceof ExpansionInactiveError) {
      res.status(400).json({ error: 'EXPANSION_INACTIVE' });
      return;
    }

    if (error instanceof ExpansionAlreadyUnlockedError) {
      res.status(409).json({ error: 'EXPANSION_ALREADY_UNLOCKED' });
      return;
    }

    if (error instanceof InsufficientGemsForExpansionError) {
      res.status(400).json({ error: 'INSUFFICIENT_GEMS' });
      return;
    }

    throw error;
  }
}
