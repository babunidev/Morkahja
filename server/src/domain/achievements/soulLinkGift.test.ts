import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPlayer, pool, setPlayer } from '../../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../../types/player.js';
import { loadAchievementProgress } from './achievementPersistence.js';
import { deliverSoulLinkGiftsForPlayer, soulLinkGiftDue, tryDeliverSoulLinkGift } from './soulLinkGift.js';
import { SPIRITGUIDE_ACHIEVEMENT_ID } from './spiritguideAchievement.js';
import { ALPHA_PLAYER_ACHIEVEMENT_ID } from './alphaPlayerAchievement.js';
import { isAlphaPlayerGloballyLocked, loadAlphaPlayerGlobalState } from './alphaPlayerGlobalLock.js';
import { getSoulLinkStatus } from '../../services/soulLinkService.js';
import { acknowledgeExpansionReveal, getPendingExpansionReveals } from '../../services/playerService.js';

// Alpha Player stops counting once sealed; a sealed local database skips those checks.
const alphaOpen = !isAlphaPlayerGloballyLocked(await loadAlphaPlayerGlobalState());

const now = Date.UTC(2026, 10, 24, 12);
const today = '2026-11-24';
const played = (count: number, utcDay = today) => ({ dailyReward: { utcDay, encountersPlayed: count } });
const base = (id: string) => ({ playerId: id, playerName: id, unlockedExpansions: [0] });
const link = (targetId: string) => ({ soulLink: { targetId, targetName: targetId, linkedAt: now - 1000 } });

// Pure rule.
const linker = { ...base('a'), ...link('b'), ...played(42) } as PlayerDocument;
const target = { ...base('b'), ...played(42) } as PlayerDocument;
assert.equal(soulLinkGiftDue(linker, target, today), true);
assert.equal(soulLinkGiftDue({ ...linker, ...played(41) } as PlayerDocument, target, today), false,
  'the new player must have played 42 encounters today');
assert.equal(soulLinkGiftDue(linker, { ...target, ...played(41) } as PlayerDocument, today), false,
  'the soul-linked player must also have played 42 encounters today');
assert.equal(soulLinkGiftDue(linker, { ...target, ...played(42, '2026-11-23') } as PlayerDocument, today), false,
  'encounters from another day do not count');
assert.equal(soulLinkGiftDue(linker, { ...target, soulLinkGiftDay: today } as PlayerDocument, today), false,
  'only one gift per day');
assert.equal(soulLinkGiftDue({ ...linker, soulLink: { ...linker.soulLink!, giftDeliveredAt: 1 } } as PlayerDocument,
  target, today), false, 'a link pays only once');

// Database: two newcomers linked to one main account, both reaching 42 at once.
const mainId = `soul-main-${randomUUID()}`;
const firstId = `soul-new-a-${randomUUID()}`;
const secondId = `soul-new-b-${randomUUID()}`;
await setPlayer(mainId, { ...base(mainId), ...played(10) });
await setPlayer(firstId, { ...base(firstId), ...link(mainId), ...played(42) });
await setPlayer(secondId, { ...base(secondId), ...link(mainId), ...played(42) });

assert.equal(await tryDeliverSoulLinkGift(firstId, now), false, 'main account has not played 42 yet');

await setPlayer(mainId, played(42), { merge: true });
const results = await Promise.all([
  tryDeliverSoulLinkGift(firstId, now),
  tryDeliverSoulLinkGift(secondId, now),
  deliverSoulLinkGiftsForPlayer(mainId, now),
]);
assert.equal(results.filter((value) => value === true).length, 1, 'exactly one gift per day');
assert.equal((await getPlayer<PlayerDocument>(mainId))?.soulLinkGiftDay, today);
const delivered = await Promise.all([firstId, secondId].map((id) => getPlayer<PlayerDocument>(id)));
assert.equal(delivered.filter((player) => player?.soulLink?.giftDeliveredAt !== undefined).length, 1);
assert.equal((await loadAchievementProgress(mainId, SPIRITGUIDE_ACHIEVEMENT_ID))?.progress, 1);

// D-068: the newcomer receives Aetherion and its unlock card; the main account Alpha Player points.
const welcomed = delivered.find((player) => player?.soulLink?.giftDeliveredAt !== undefined)!;
assert.equal(welcomed.soulLink?.welcomeGift, 'aetherion');
assert.ok(welcomed.unlockedExpansions.includes(1004), 'Aetherion unlocked for the newcomer');
assert.deepEqual(await getPendingExpansionReveals(welcomed.playerId), [1004], 'its unlock card is due');
assert.deepEqual(await acknowledgeExpansionReveal(welcomed.playerId, 1004), [], 'Proceed clears it');
if (alphaOpen) {
  assert.equal((await loadAchievementProgress(mainId, ALPHA_PLAYER_ACHIEVEMENT_ID))?.progress, 5);
}

// The Soul Link window: both newcomers listed for the main account, one delivered.
const status = await getSoulLinkStatus(mainId, now);
assert.equal(status.linkedSouls.length, 2);
assert.equal(status.linkedSouls.filter((soul) => soul.giftDeliveredAt !== undefined).length, 1);
assert.equal(status.encountersToday, 42);
assert.equal(status.encountersRequired, 42);

// Next day: the remaining link pays once both have played 42 again.
const tomorrow = now + 24 * 60 * 60 * 1000;
const tomorrowKey = '2026-11-25';
const waitingId = delivered[0]?.soulLink?.giftDeliveredAt === undefined ? firstId : secondId;
// This newcomer already owns Aetherion: the gift day records it as owned.
await setPlayer(waitingId, { unlockedExpansions: [0, 1004] }, { merge: true });
const waitingStatus = await getSoulLinkStatus(waitingId, now);
assert.equal(waitingStatus.soulLink?.targetId, mainId);
assert.equal(waitingStatus.soulLink?.targetEncountersToday, 42, 'the pending link shows the other side today');
await setPlayer(waitingId, played(42, tomorrowKey), { merge: true });
await setPlayer(mainId, played(42, tomorrowKey), { merge: true });
await deliverSoulLinkGiftsForPlayer(mainId, tomorrow);
assert.notEqual((await getPlayer<PlayerDocument>(waitingId))?.soulLink?.giftDeliveredAt, undefined);
assert.equal((await loadAchievementProgress(mainId, SPIRITGUIDE_ACHIEVEMENT_ID))?.progress, 2);
assert.equal((await getPlayer<PlayerDocument>(waitingId))?.soulLink?.welcomeGift, 'owned');
assert.deepEqual(await getPendingExpansionReveals(waitingId), [], 'no unlock card for an expansion already owned');
if (alphaOpen) {
  assert.equal((await loadAchievementProgress(mainId, ALPHA_PLAYER_ACHIEVEMENT_ID))?.progress, 10);
}

await pool.query('DELETE FROM players WHERE id = ANY($1)', [[mainId, firstId, secondId]]);
await pool.end();
console.log('soulLinkGift.test.ts passed');
