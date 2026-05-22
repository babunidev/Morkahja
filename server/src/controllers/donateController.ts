import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  donatePlayerYellowRedGems,
  InsufficientGemsForDonationError,
} from '../services/playerService.js';

export async function donatePlayerGemsController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const amount = body.amount;

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    res.status(400).json({ error: 'INVALID_DONATION_AMOUNT' });
    return;
  }

  try {
    const result = await donatePlayerYellowRedGems(playerId, amount);

    res.json({
      playerId,
      donated: result.donated,
      currencies: result.currencies,
    });
  } catch (error) {
    if (error instanceof InsufficientGemsForDonationError) {
      res.status(400).json({ error: 'INSUFFICIENT_GEMS' });
      return;
    }

    throw error;
  }
}
