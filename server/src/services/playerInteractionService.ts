import { getPlayer, setPlayer } from '../db/postgresDocumentStore.js';
import { HELP_SEEN_WINDOW_MS } from '../domain/rooms/roomConstants.js';
import type { PlayerDocument } from '../types/player.js';

export class ActiveAvatarConflictError extends Error {
  constructor() {
    super('Another avatar is active in this account');
    this.name = 'ActiveAvatarConflictError';
  }
}

export function readLastInteractionAt(player: PlayerDocument): number {
  const lastInteractionAt = player.lastInteractionAt;
  if (typeof lastInteractionAt === 'number') {
    return lastInteractionAt;
  }

  return typeof player.lastPlayedAt === 'number' ? player.lastPlayedAt : 0;
}

export function isPlayerRecentlyActive(player: PlayerDocument, now: number = Date.now()): boolean {
  return now - readLastInteractionAt(player) <= HELP_SEEN_WINDOW_MS;
}

export async function touchPlayerInteraction(playerId: string): Promise<void> {
  const now = Date.now();
  await setPlayer(
    playerId,
    {
      lastInteractionAt: now,
      lastPlayedAt: now,
    },
    { merge: true },
  );
}

export async function assertActiveAvatarForRequest(
  playerId: string,
  avatarId: string,
): Promise<void> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const activeAvatarId = player?.activeAvatarId;
  if (typeof activeAvatarId === 'string' && activeAvatarId.length > 0 && activeAvatarId !== avatarId) {
    throw new ActiveAvatarConflictError();
  }
}
