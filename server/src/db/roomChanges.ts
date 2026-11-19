/**
 * Room change signal (2026-11-19). Every saved room bumps its counter here, so
 * a player's open `GET /room/active?wait=…` request can answer the moment the
 * room changes instead of the client asking again every few seconds.
 *
 * In-process only: the API runs as a single process (PM2 `morkahja-api`). With
 * several processes a waiting request would still answer at its timeout, so
 * nothing breaks, it only gets slower.
 */
import { EventEmitter } from 'node:events';

const versions = new Map<string, number>();
const changes = new EventEmitter();
changes.setMaxListeners(0);

export function roomChangeVersion(roomId: string): number {
  return versions.get(roomId) ?? 0;
}

export function notifyRoomChanged(roomId: string): void {
  versions.set(roomId, roomChangeVersion(roomId) + 1);
  changes.emit(roomId);
}

/**
 * Resolves when the room changes after `sinceVersion`, at `timeoutMs`, or when
 * `signal` aborts (the player closed the request), whichever comes first.
 */
export function waitForRoomChange(
  roomId: string,
  sinceVersion: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (roomChangeVersion(roomId) !== sinceVersion || signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      changes.off(roomId, finish);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    changes.on(roomId, finish);
    signal?.addEventListener('abort', finish);
  });
}

/** Forget a deleted room's counter so the map does not grow forever. */
export function forgetRoom(roomId: string): void {
  notifyRoomChanged(roomId);
  versions.delete(roomId);
}
