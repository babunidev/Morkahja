/**
 * Player change signals (2026-11-27). Like `roomChanges.ts` for rooms: every
 * write that can change what a player's dashboard or toasts show bumps that
 * player's counter, and every feed-visible game event bumps the feed counter.
 * `GET /player/changes` waits on these, so the client fetches achievements,
 * help invitations and the Scribes feed only when something changed instead of
 * asking every 5–10 seconds.
 *
 * In-process only, like room signals: with several API processes a waiting
 * request still answers at its timeout, so nothing breaks, it only gets slower.
 * The counters start at 0 on every server start; `BOOT_ID` tells the client
 * that its remembered counters belong to an earlier start.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

export const BOOT_ID = randomUUID().slice(0, 8);

// Player counters take their values from one rising sequence, so a counter
// that was dropped and bumped again can never repeat a number a client holds.
let sequence = 0;
const playerVersions = new Map<string, number>();
let feedVersion = 0;
const changes = new EventEmitter();
changes.setMaxListeners(0);

const FEED_EVENT = 'feed';

function playerEvent(playerId: string): string {
  return `player:${playerId}`;
}

export interface PlayerChangeVersions {
  player: number;
  feed: number;
}

export function playerChangeVersions(playerId: string): PlayerChangeVersions {
  return { player: playerVersions.get(playerId) ?? 0, feed: feedVersion };
}

export function notifyPlayerChanged(playerId: string | null | undefined): void {
  if (!playerId) {
    return;
  }
  sequence += 1;
  playerVersions.set(playerId, sequence);
  changes.emit(playerEvent(playerId));
}

export function notifyFeedChanged(): void {
  feedVersion += 1;
  changes.emit(FEED_EVENT);
}

/** Forget a player's counter once nothing waits on it, so the map stays small. */
function forgetIdlePlayer(playerId: string): void {
  if (changes.listenerCount(playerEvent(playerId)) === 0) {
    playerVersions.delete(playerId);
  }
}

/**
 * Resolves when the player's or the feed's counter differs from `since`, at
 * `timeoutMs`, or when `signal` aborts (the player closed the request).
 */
export function waitForPlayerChange(
  playerId: string,
  since: PlayerChangeVersions,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const current = playerChangeVersions(playerId);
  if (current.player !== since.player || current.feed !== since.feed || signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      changes.off(playerEvent(playerId), finish);
      changes.off(FEED_EVENT, finish);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    changes.on(playerEvent(playerId), finish);
    changes.on(FEED_EVENT, finish);
    signal?.addEventListener('abort', finish);
  });
}

/**
 * Counters of players nobody waits on are dropped now and then. A dropped
 * counter reads 0 again, which a client that remembered a higher number sees
 * as a change and simply fetches once more.
 */
setInterval(() => {
  for (const playerId of playerVersions.keys()) {
    forgetIdlePlayer(playerId);
  }
}, 10 * 60 * 1000).unref();
