import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  DiceAlreadyUnlockedError,
  DiceNotFoundError,
  DiceNotUnlockedError,
  InsufficientGemsForDiceError,
  setPlayerSelectedDice,
  unlockPlayerDice,
} from '../services/diceService.js';

export async function unlockPlayerDiceController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const diceId = body.diceId;

  if (typeof diceId !== 'string' || diceId.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_DICE_ID' });
    return;
  }

  try {
    const result = await unlockPlayerDice(playerId, diceId.trim());

    res.json({
      playerId,
      diceId: result.diceId,
      spent: result.spent,
      currencies: result.currencies,
      unlockedDiceIds: result.unlockedDiceIds,
    });
  } catch (error) {
    if (error instanceof DiceNotFoundError) {
      res.status(404).json({ error: 'DICE_NOT_FOUND' });
      return;
    }

    if (error instanceof DiceAlreadyUnlockedError) {
      res.status(409).json({ error: 'DICE_ALREADY_UNLOCKED' });
      return;
    }

    if (error instanceof InsufficientGemsForDiceError) {
      res.status(400).json({ error: 'INSUFFICIENT_GEMS' });
      return;
    }

    throw error;
  }
}

export async function selectPlayerDiceController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const diceId = body.diceId;

  if (typeof diceId !== 'string' || diceId.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_DICE_ID' });
    return;
  }

  try {
    const result = await setPlayerSelectedDice(playerId, diceId.trim());

    res.json({
      playerId,
      selectedDiceId: result.selectedDiceId,
      unlockedDiceIds: result.unlockedDiceIds,
    });
  } catch (error) {
    if (error instanceof DiceNotFoundError) {
      res.status(404).json({ error: 'DICE_NOT_FOUND' });
      return;
    }

    if (error instanceof DiceNotUnlockedError) {
      res.status(400).json({ error: 'DICE_NOT_UNLOCKED' });
      return;
    }

    throw error;
  }
}
