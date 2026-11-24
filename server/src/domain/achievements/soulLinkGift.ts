import {
  listPendingSoulLinkerIds,
  withDocumentTransaction,
} from '../../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../../types/player.js';
import { awardSpiritguidePoint } from './spiritguideProgress.js';

/** Encounters both soul-linked players must play on the same UTC day. */
export const SOUL_LINK_GIFT_ENCOUNTERS_REQUIRED = 42;

function utcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function encountersPlayedOn(player: PlayerDocument | null, utcDay: string): number {
  const state = player?.dailyReward;
  return state && state.utcDay === utcDay ? Math.max(0, state.encountersPlayed ?? 0) : 0;
}

/**
 * Pure rule for the "Gift of the Gods" (D-062): the link pays once, on a UTC day
 * when the new player and the soul-linked player have both played 42 encounters,
 * and a soul-linked player receives at most one gift per day.
 */
export function soulLinkGiftDue(
  linker: PlayerDocument | null,
  target: PlayerDocument | null,
  utcDay: string,
): boolean {
  const soulLink = linker?.soulLink;
  if (!soulLink || soulLink.giftDeliveredAt !== undefined || !target) {
    return false;
  }
  if (target.soulLinkGiftDay === utcDay) {
    return false;
  }
  return encountersPlayedOn(linker, utcDay) >= SOUL_LINK_GIFT_ENCOUNTERS_REQUIRED
    && encountersPlayedOn(target, utcDay) >= SOUL_LINK_GIFT_ENCOUNTERS_REQUIRED;
}

/**
 * Delivers the linker's pending gift if it is due today. Both player rows are
 * locked (in id order, so two deliveries cannot deadlock) before the check, so
 * parallel encounters cannot pay twice or pay a target twice in one day.
 */
export async function tryDeliverSoulLinkGift(
  linkerId: string,
  timestamp = Date.now(),
): Promise<boolean> {
  const utcDay = utcDayKey(timestamp);

  return withDocumentTransaction(async (transaction) => {
    const unlocked = await transaction.query<{ target: string | null }>(
      `SELECT data->'soulLink'->>'targetId' AS target FROM players WHERE id = $1`,
      [linkerId],
    );
    const targetId = unlocked.rows[0]?.target;
    if (!targetId || targetId === linkerId) {
      return false;
    }

    const [firstId, secondId] = [linkerId, targetId].sort();
    const first = await transaction.getPlayer<PlayerDocument>(firstId);
    const second = await transaction.getPlayer<PlayerDocument>(secondId);
    const linker = firstId === linkerId ? first : second;
    const target = firstId === linkerId ? second : first;

    if (linker?.soulLink?.targetId !== targetId || !soulLinkGiftDue(linker, target, utcDay)) {
      return false;
    }

    const now = Date.now();
    await transaction.setPlayer(
      linkerId,
      { soulLink: { ...linker.soulLink, giftDeliveredAt: timestamp }, updatedAt: now },
      { merge: true },
    );
    await transaction.setPlayer(
      targetId,
      { soulLinkGiftDay: utcDay, updatedAt: now },
      { merge: true },
    );
    transaction.onCommit(() => awardSpiritguidePoint(targetId, timestamp));
    return true;
  });
}

/**
 * Called when a player reaches 42 encounters today: delivers their own pending
 * gift, and the oldest pending gift of an adventurer who linked to them.
 */
export async function deliverSoulLinkGiftsForPlayer(
  playerId: string,
  timestamp = Date.now(),
): Promise<void> {
  await tryDeliverSoulLinkGift(playerId, timestamp);

  for (const linkerId of await listPendingSoulLinkerIds(playerId)) {
    if (await tryDeliverSoulLinkGift(linkerId, timestamp)) {
      return;
    }
  }
}
