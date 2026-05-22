import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  addPlayerFriend,
  CannotAddSelfError,
  FriendAccessDeniedError,
  FriendAlreadyAddedError,
  FriendLookupNotFoundError,
  FriendNotFoundError,
  getFriendAchievements,
  listPlayerFriends,
} from '../services/friendService.js';

export async function listPlayerFriendsController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const friends = await listPlayerFriends(playerId);

  res.json({
    playerId,
    friends,
  });
}

export async function addPlayerFriendController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const query = typeof body.query === 'string'
    ? body.query
    : typeof body.playerName === 'string'
      ? body.playerName
      : typeof body.friendId === 'string'
        ? body.friendId
        : '';

  try {
    const result = await addPlayerFriend(playerId, query);

    res.json({
      playerId,
      friend: result.friend,
      friendIds: result.friendIds,
    });
  } catch (error) {
    if (error instanceof FriendLookupNotFoundError) {
      res.status(404).json({ error: 'PLAYER_NOT_FOUND' });
      return;
    }

    if (error instanceof CannotAddSelfError) {
      res.status(400).json({ error: 'CANNOT_ADD_SELF' });
      return;
    }

    if (error instanceof FriendAlreadyAddedError) {
      res.status(409).json({ error: 'FRIEND_ALREADY_ADDED' });
      return;
    }

    throw error;
  }
}

export async function getFriendAchievementsController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const friendId = req.params.friendId;

  if (typeof friendId !== 'string' || !friendId.trim()) {
    res.status(400).json({ error: 'INVALID_FRIEND_ID' });
    return;
  }

  try {
    const snapshot = await getFriendAchievements(playerId, friendId.trim());
    res.json(snapshot);
  } catch (error) {
    if (error instanceof FriendAccessDeniedError || error instanceof FriendNotFoundError) {
      res.status(404).json({ error: 'FRIEND_NOT_FOUND' });
      return;
    }

    throw error;
  }
}
