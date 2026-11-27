import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  BOOT_ID,
  playerChangeVersions,
  waitForPlayerChange,
} from '../db/playerChanges.js';

/** Same as the room wait: below Nginx's default 60 s proxy timeout. */
export const PLAYER_CHANGES_WAIT_MS = 25_000;

function readCounter(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

/**
 * `GET /player/changes?boot=…&player=…&feed=…` (2026-11-27). Answers with the
 * current counters at once if they differ from the ones the client sends (or
 * the client sends none, or remembers an earlier server start), otherwise as
 * soon as one changes or after PLAYER_CHANGES_WAIT_MS. The client then fetches
 * only what changed: `player` covers achievements, the daily reward and help
 * invitations, `feed` the Scribes feed.
 */
export async function getPlayerChangesController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const player = readCounter(req.query.player);
  const feed = readCounter(req.query.feed);
  const sameBoot = req.query.boot === BOOT_ID;

  if (sameBoot && player !== undefined && feed !== undefined) {
    const closed = new AbortController();
    res.on('close', () => closed.abort());
    await waitForPlayerChange(playerId, { player, feed }, PLAYER_CHANGES_WAIT_MS, closed.signal);
    if (closed.signal.aborted && !res.writableEnded) {
      return;
    }
  }

  res.json({ boot: BOOT_ID, ...playerChangeVersions(playerId) });
}
