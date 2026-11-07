import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { AvatarDocument, AvatarInventory } from '../types/avatar.js';
import type { DocumentTransaction } from '../db/postgresDocumentStore.js';
import { createInitialProgression } from '../domain/avatar/AvatarProgression.js';
import { publishContentRevision, readContentPointer } from './contentPublication.js';
import {
  getGameRuntimeContentSnapshot, getGameRuntimeContentSnapshotForRevision,
  invalidateGameDataCaches,
} from './gameData.js';
import {
  buildEncounterSnapshot, buildSlotEncounterSnapshots, prepareNextEncounter,
  preparedSystemEncounter, prepareParticipantOutcome, resolveNextEncounterForRoom,
  withPrecomputedSnapshotRewards,
} from './encounterGenerator.js';
import { addRewardToInventoryState, createEmptyInventory } from './inventoryService.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import type { EncounterData } from '../engine/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../game');
const filenames = {
  encounters: 'encountersdata.json', solutions: 'solutiondata.json',
  expansions: 'expansiondata.json', portraits: 'portraits.json', frames: 'frames.json',
};
function baseline(): Record<string, any> {
  return Object.fromEntries(Object.entries(filenames).map(([category, name]) =>
    [category, JSON.parse(readFileSync(join(fixtures, name), 'utf8'))]));
}
function withPublishedRoot(run: (root: string) => Promise<void> | void): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-pinned-gameplay-'));
  const previous = process.env.MORKAHJA_CONTENT_ROOT;
  process.env.MORKAHJA_CONTENT_ROOT = root;
  invalidateGameDataCaches();
  return Promise.resolve().then(() => run(root)).finally(() => {
    if (previous === undefined) delete process.env.MORKAHJA_CONTENT_ROOT;
    else process.env.MORKAHJA_CONTENT_ROOT = previous;
    invalidateGameDataCaches();
    rmSync(root, { recursive: true, force: true });
  });
}
function publish(root: string, previous: string | null, publicationId: string, data: unknown): string {
  return publishContentRevision(root, {
    baseRevision: previous, publicationId, content: data,
  }).revision;
}
function encounter(content: ReturnType<typeof getGameRuntimeContentSnapshot>, id = 20001): EncounterData {
  return Object.values(content.encounters).find(e => e.mEncounterID === id)!;
}
function sampleAvatar(): AvatarDocument {
  return {
    id: 'avatar-one', name: 'Test Adventurer', race: 'Grimnir', role: 'Mage',
    level: 1, experience: 0, createdAt: 1720000000000,
    inventory: createEmptyInventory(), profile: { roleRewardType: 37, raceRewardType: 43 },
    progression: {},
  };
}

test('solo snapshot and precomputed reward definitions remain pinned after publishing a new revision', async () => {
  await withPublishedRoot(async root => {
    const data = baseline();
    const firstRevision = publish(root, null, 'gameplay_initial_0001', data);
    const first = getGameRuntimeContentSnapshot();
    const old = encounter(first);
    const avatar = sampleAvatar();
    const prepared = prepareNextEncounter(old, [0], first.encounters, first.revision);
    const snapshot = buildEncounterSnapshot(
      'player-one', 'avatar-one', old, prepared, avatar, first.solutions, first.revision,
    );
    assert.equal(snapshot.contentRevision, firstRevision);
    assert.equal(snapshot.preparedEncounter.contentRevision, firstRevision);
    const stableTitle = snapshot.encounterTitle;
    const rewardId = Number(Object.keys(first.solutions)[0]);
    const originalUses = first.solutions[String(rewardId)]!.mSolutionUses;

    data.encounters[String(old.mEncounterID)].mEncounterTitle = 'Later publication';
    data.solutions[String(rewardId)].mSolutionUses = originalUses + 7;
    const secondRevision = publish(root, firstRevision, 'gameplay_update_0001', data);
    const current = getGameRuntimeContentSnapshot();
    assert.equal(current.revision, secondRevision);
    assert.equal(current.encounters[String(old.mEncounterID)].mEncounterTitle, 'Later publication');
    assert.equal(snapshot.encounterTitle, stableTitle);
    assert.equal(getGameRuntimeContentSnapshotForRevision(snapshot.contentRevision).encounters[String(old.mEncounterID)].mEncounterTitle, stableTitle);
    assert.equal(getGameRuntimeContentSnapshotForRevision(snapshot.contentRevision).solutions[String(rewardId)]!.mSolutionUses, originalUses);
    assert.equal(current.solutions[String(rewardId)]!.mSolutionUses, originalUses + 7);

    const oldReward = addRewardToInventoryState(createEmptyInventory(), rewardId, undefined,
      getGameRuntimeContentSnapshotForRevision(snapshot.contentRevision).solutions);
    const newReward = addRewardToInventoryState(createEmptyInventory(), rewardId, undefined, current.solutions);
    const chargeCount = (inventory: AvatarInventory): number =>
      [...inventory.spellbook, ...inventory.items, ...inventory.essences].find(x => x.solutionId === rewardId)?.uses ?? 0;
    assert.equal(chargeCount(oldReward), Math.max(1, originalUses));
    assert.equal(chargeCount(newReward), Math.max(1, originalUses + 7));
    assert.equal(withPrecomputedSnapshotRewards(snapshot, avatar), snapshot);
    assert.equal(readContentPointer(root).revision, secondRevision);
  });
});

test('all three multiplayer slots, system-event lineage and checkpoint-compatible room shell keep the original revision', async () => {
  await withPublishedRoot(root => {
    const data = baseline();
    const revision = publish(root, null, 'room_initial_0001', data);
    const first = getGameRuntimeContentSnapshot();
    const old = encounter(first);
    const prepared = prepareNextEncounter(old, [0], first.encounters, first.revision);
    const avatar = sampleAvatar();
    const participants = [
      { slotIndex: 0, playerId: 'leader', avatarId: 'a' },
      { slotIndex: 1, playerId: 'guest', avatarId: 'b' },
    ];
    const slots = buildSlotEncounterSnapshots(
      old, prepared, 'room-one', 'leader', 'a', avatar, participants, () => avatar, first,
    );
    assert.equal(new Set(slots.map(s => s.contentRevision)).size, 1);
    assert.deepEqual(slots.map(s => s.contentRevision), [revision, revision, revision]);
    assert.equal(new Set(slots.map(s => s.snapshotId)).size, 1);
    assert.equal(slots[0].preparedEncounter.contentRevision, revision);

    const system = preparedSystemEncounter(2, first);
    const systemTitle = first.encounters['00002']!.mEncounterTitle;
    data.encounters['00002'].mEncounterTitle = 'Different new level-up';
    publish(root, revision, 'room_update_0001', data);
    const resolved = resolveNextEncounterForRoom({
      originEncounterId: old.mEncounterID,
      originEncounterFollow: 0,
      originRollOutcome: null,
      originSuccess: true,
      preparedEncounter: system,
    }, [0], getGameRuntimeContentSnapshotForRevision(slots[0].contentRevision));
    assert.equal(resolved.encounter.mEncounterTitle, systemTitle);
    assert.equal(resolved.prepared.contentRevision, revision);
    assert.notEqual(getGameRuntimeContentSnapshot().encounters['00002']!.mEncounterTitle, systemTitle);
  });
});

test('room result preparation uses the pinned solutions even when publication changes during an active encounter', async () => {
  await withPublishedRoot(async root => {
    const data = baseline();
    const revision = publish(root, null, 'outcome_initial_0001', data);
    const first = getGameRuntimeContentSnapshot();
    const chosen = encounter(first);
    const avatar = sampleAvatar();
    const snapshot = buildEncounterSnapshot('p', 'avatar-one', chosen,
      prepareNextEncounter(chosen, [0], first.encounters, revision),
      avatar, first.solutions, revision);
    const originalName = first.solutions['10001']?.mSolutionName;
    data.solutions['10001'].mSolutionName = 'Changed while adventuring';
    publish(root, revision, 'outcome_update_0001', data);
    const transaction = {
      getAvatar: async () => avatar,
      getInventory: async () => createEmptyInventory(),
      getProgression: async () => createInitialProgression(avatar.createdAt!),
    } as unknown as DocumentTransaction;
    const prepared = await prepareParticipantOutcome(transaction, 'p', 'avatar-one',
      snapshot, { type: 'dice' });
    assert.ok(prepared.preparedCommit);
    assert.ok(prepared.resolution);
    assert.equal(getGameRuntimeContentSnapshotForRevision(snapshot.contentRevision).solutions['10001']?.mSolutionName, originalName);
    assert.equal(getGameRuntimeContentSnapshot().solutions['10001']?.mSolutionName, 'Changed while adventuring');
  });
});

test('pre-publication snapshots use the frozen legacy baseline, not the newest published revision', async () => {
  await withPublishedRoot(root => {
    const data = baseline();
    const initial = publish(root, null, 'legacy_initial_0001', data);
    const legacy = getGameRuntimeContentSnapshotForRevision(undefined);
    const original = legacy.encounters['20001']!.mEncounterTitle;
    data.encounters['20001'].mEncounterTitle = 'Live-only title';
    publish(root, initial, 'legacy_update_0001', data);
    const oldSnapshot = {
      contentRevision: undefined,
      encounterId: 20001,
      preparedEncounter: { encounterId: 20001, followMode: 'random' },
    } as EncounterSnapshot;
    assert.equal(getGameRuntimeContentSnapshotForRevision(oldSnapshot.contentRevision).encounters['20001']!.mEncounterTitle, original);
    assert.notEqual(getGameRuntimeContentSnapshot().encounters['20001']!.mEncounterTitle, original);
  });
});

test('historical revisions fail closed if removed or corrupted, and published content rejects repurposed inventory IDs', async () => {
  await withPublishedRoot(root => {
    const data = baseline();
    const revision = publish(root, null, 'safety_initial_0001', data);
    const rewardId = '10001';
    data.solutions[rewardId].mSolutionInventoryType = data.solutions[rewardId].mSolutionInventoryType === 1 ? 2 : 1;
    assert.throws(() => publish(root, revision, 'safety_unsafe_0001', data), /CONTENT_IDENTITY_CHANGE_NOT_SUPPORTED/);
    assert.equal(readContentPointer(root).revision, revision);
    data.solutions[rewardId].mSolutionInventoryType =
      baseline().solutions[rewardId].mSolutionInventoryType;
    data.encounters['20001'].mEncounterTitle = 'Safe editorial update';
    const newer = publish(root, revision, 'safety_update_0001', data);
    assert.equal(readContentPointer(root).revision, newer);
    assert.ok(getGameRuntimeContentSnapshotForRevision(revision).encounters['20001']);
    writeFileSync(join(root, 'revisions', revision, 'solutiondata.json'), 'corrupt');
    assert.throws(() => getGameRuntimeContentSnapshotForRevision(revision), /CONTENT_/);
    assert.equal(getGameRuntimeContentSnapshot().revision, newer);
    assert.throws(() => getGameRuntimeContentSnapshotForRevision('00000000-0000-0000-0000-000000000000'), /CONTENT_/);
  });
});
