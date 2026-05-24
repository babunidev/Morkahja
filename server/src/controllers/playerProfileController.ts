import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { toPersistedAvatarDto } from '../services/avatarPresentation.js';
import {
  AvatarProfileNotFoundError,
  getPlayerProfile,
  InvalidAvatarDisplayTitleError,
  setAvatarDisplayTitle,
} from '../services/playerProfileService.js';

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

export async function setAvatarDisplayTitleController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const avatarId = Array.isArray(req.params.avatarId)
    ? req.params.avatarId[0]
    : req.params.avatarId;
  const body = req.body as Record<string, unknown>;

  if (!avatarId) {
    res.status(400).json({ error: 'avatarId is required' });
    return;
  }

  const displayTitle = body.displayTitle === null
    ? null
    : typeof body.displayTitle === 'string'
      ? body.displayTitle
      : undefined;

  if (displayTitle === undefined) {
    res.status(400).json({ error: 'displayTitle must be a string or null' });
    return;
  }

  try {
    const avatar = await setAvatarDisplayTitle(playerId, avatarId, displayTitle);
    const dto = toPersistedAvatarDto(avatar);

    if (!dto) {
      res.status(404).json({ error: 'Avatar not found' });
      return;
    }

    res.json({ playerId, avatar: dto });
  } catch (error) {
    if (error instanceof AvatarProfileNotFoundError) {
      res.status(404).json({ error: 'AVATAR_NOT_FOUND' });
      return;
    }

    if (error instanceof InvalidAvatarDisplayTitleError) {
      res.status(400).json({ error: 'INVALID_DISPLAY_TITLE' });
      return;
    }

    throw error;
  }
}
