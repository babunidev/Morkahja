import type { NextFunction, Request, Response } from 'express';
import type { EncounterAction, ParticipantFocusStateDto } from '../../../shared/src/contracts.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { toEncounterRoomSnapshotDto } from '../services/roomDtoMapper.js';
import {
  broadcastCallForHelp,
  consumePartyEjection,
  createRoom,
  getActiveRoomForPlayer,
  joinFriendRoom,
  joinRoom,
  kickParticipant,
  leaveRoom,
  listPendingHelpInvitations,
  respondHelp,
  RoomError,
  setFocusState,
  setSlotState,
  submitChoice,
  submitContinue,
  submitSelection,
} from '../services/roomService.js';
import { activateRoomLoreGem, LoreGemError } from '../services/loreGemService.js';
import {
  ActiveAvatarConflictError,
  assertActiveAvatarForRequest,
  touchPlayerInteraction,
} from '../services/playerInteractionService.js';
import { getPlayer } from '../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../types/player.js';

class RequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

function handleRoomError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof RoomError) {
    res.status(error.statusCode).json({ error: error.code ?? error.message });
    return;
  }
  if (error instanceof ActiveAvatarConflictError) {
    res.status(409).json({ error: 'ACTIVE_AVATAR_CHANGED' });
    return;
  }
  if (error instanceof LoreGemError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

async function requireActiveAvatar(req: Request): Promise<{ playerId: string; avatarId: string }> {
  const { playerId } = requireAuth(req);
  const avatarId = requireAvatarId(req);
  await assertActiveAvatarForRequest(playerId, avatarId);
  await touchPlayerInteraction(playerId);
  return { playerId, avatarId };
}

function requireAvatarId(req: Request): string {
  const body = req.body as Record<string, unknown> | undefined;
  const avatarId = typeof body?.avatarId === 'string'
    ? body.avatarId
    : typeof req.query.avatarId === 'string'
      ? req.query.avatarId
      : undefined;

  if (!avatarId) {
    throw new RequestError('avatarId is required');
  }

  return avatarId;
}

export async function getActiveRoomController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const avatarId = requireAvatarId(req);
    const room = await getActiveRoomForPlayer(playerId, avatarId);
    const partyEjection = room
      ? undefined
      : (await consumePartyEjection(playerId)) === 'kicked'
        ? { reason: 'kicked' as const }
        : undefined;
    res.json({
      room: room ? await toEncounterRoomSnapshotDto(room, playerId) : null,
      partyEjection,
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function createRoomController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const avatarId = requireAvatarId(req);
    const room = await createRoom(playerId, avatarId);
    res.status(201).json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function joinRoomController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = requireAvatarId(req);
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';

    if (!roomId) {
      throw new RequestError('roomId is required');
    }

    const room = await joinRoom(playerId, avatarId, roomId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function leaveRoomController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const avatarId = requireAvatarId(req);
    await leaveRoom(playerId, avatarId);
    res.json({ ok: true });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function setSlotStateController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const avatarId = requireAvatarId(req);
    const body = req.body as Record<string, unknown>;
    const slotIndex = Number(body.slotIndex);
    const slotState = body.slotState;

    if (!Number.isInteger(slotIndex)) {
      throw new RequestError('slotIndex is required');
    }

    if (slotState !== 'open' && slotState !== 'friends_only' && slotState !== 'locked') {
      throw new RequestError('Invalid slotState');
    }

    const room = await setSlotState(playerId, avatarId, slotIndex, slotState);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function submitRoomChoiceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = requireAvatarId(req);
    const action = body.action as EncounterAction;
    const solutionId = typeof body.solutionId === 'number' ? body.solutionId : undefined;

    const room = await submitChoice(playerId, avatarId, action, solutionId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function submitRoomSelectionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = requireAvatarId(req);
    const action = body.action as EncounterAction;
    const solutionId = typeof body.solutionId === 'number' ? body.solutionId : undefined;

    const room = await submitSelection(playerId, avatarId, action, solutionId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function submitRoomFocusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = requireAvatarId(req);
    const focusState = body.focusState as ParticipantFocusStateDto;

    if (
      focusState !== 'none' &&
      focusState !== 'lore' &&
      focusState !== 'inventory' &&
      focusState !== 'skillbook' &&
      focusState !== 'avatar_details'
    ) {
      throw new RequestError('Invalid focusState');
    }

    const room = await setFocusState(playerId, avatarId, focusState);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function activateRoomLoreGemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = requireAvatarId(req);
    const encounterKey = typeof body.encounterKey === 'string' ? body.encounterKey : '';
    const result = await activateRoomLoreGem(playerId, avatarId, encounterKey);
    res.json({
      ...result,
      room: await toEncounterRoomSnapshotDto(result.room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function submitRoomContinueController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const avatarId = requireAvatarId(req);
    const room = await submitContinue(playerId, avatarId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function requestHelpController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const avatarId = typeof body.avatarId === 'string' ? body.avatarId : undefined;
    const result = await broadcastCallForHelp(playerId, avatarId);
    res.status(201).json(result);
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function respondHelpController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
    const accept = body.accept === true;
    const avatarId = typeof body.avatarId === 'string' ? body.avatarId : undefined;

    if (!inviteId) {
      throw new RequestError('inviteId is required');
    }

    const room = await respondHelp(playerId, inviteId, accept, avatarId);
    res.json({
      room: room ? await toEncounterRoomSnapshotDto(room, playerId) : null,
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function joinFriendRoomController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const body = req.body as Record<string, unknown>;
    const friendPlayerId = typeof body.friendPlayerId === 'string' ? body.friendPlayerId : '';
    const avatarId = typeof body.avatarId === 'string' ? body.avatarId : undefined;

    if (!friendPlayerId) {
      throw new RequestError('friendPlayerId is required');
    }

    const room = await joinFriendRoom(playerId, friendPlayerId, avatarId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function kickRoomParticipantController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId, avatarId } = await requireActiveAvatar(req);
    const body = req.body as Record<string, unknown>;
    const targetPlayerId = typeof body.targetPlayerId === 'string' ? body.targetPlayerId : '';

    if (!targetPlayerId) {
      throw new RequestError('targetPlayerId is required');
    }

    const room = await kickParticipant(playerId, avatarId, targetPlayerId);
    res.json({
      room: await toEncounterRoomSnapshotDto(room, playerId),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}

export async function listPendingHelpController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { playerId } = requireAuth(req);
    const invitations = await listPendingHelpInvitations(playerId);
    const playerIds = [...new Set(invitations.map((invite) => invite.fromPlayerId))];
    const names = new Map<string, string>();

    await Promise.all(playerIds.map(async (id) => {
      const player = await getPlayer<Partial<PlayerDocument>>(id);
      names.set(id, player?.playerName?.trim() || id);
    }));

    res.json({
      invitations: invitations.map((invite) => ({
        inviteId: invite.inviteId,
        roomId: invite.roomId,
        fromPlayerId: invite.fromPlayerId,
        fromPlayerName: names.get(invite.fromPlayerId) ?? invite.fromPlayerId,
        expiresAt: invite.expiresAt,
      })),
    });
  } catch (error) {
    handleRoomError(error, res, next);
  }
}
