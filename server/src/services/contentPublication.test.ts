import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  ContentPublicationError, listContentRevisions, publishContentRevision, readContentPointer,
  readContentRevision, readPublishedContent, restoreContentRevision, validateContentBundle,
} from './contentPublication.js';

function sample() {
  return {
    encounters: {
      '00001': {
        mEncounterDifficulty: 7, mEncounterExpansion: 1001, mEncounterFollow: 0,
        mEncounterID: 1, mEncounterImageName: 'help_heal_wounded_grimnir',
        mEncounterRewardAmount: 1, mEncounterRewardType: 3,
        mEncounterSolutiuonA: 10001, mEncounterSolutiuonB: 0,
        mEncounterSolutiuonC: 0, mEncounterSolutiuonD: 0,
        mEncounterSolutiuonTypeA: 0, mEncounterSolutiuonTypeB: 0,
        mEncounterSolutiuonTypeC: 0, mEncounterSolutiuonTypeD: 0,
        mEncounterText: 'A test lore', mEncounterTitle: 'Test',
        mEncounterType: 77, mEncounterElement: 'Core',
      },
    },
    solutions: {
      '10001': {
        mSolutionID: 10001, mSolutionIconName: 'skill_search',
        mSolutionInventoryType: 1, mSolutionName: 'Search',
        mSolutionRewardType: 1, mSolutionText: 'Test', mSolutionType: 1, mSolutionUses: 1,
      },
    },
    expansions: {
      expansions: {
        '1001': {
          mExtensioActive: true, mExtensioCollectionImage: 'expansion_keldor',
          mExtensioCost: 25, mExtensioPriceEurCents: 199,
          mExtensioHeaderImage: 'expansion_keldor', mExtensioID: 1001,
          mExtensioName: 'Keldor', mExtensioReward: 20,
          mExtensioSummaryText: '', mExtensioText: '', mExtensioUnlockButton: '',
        },
      },
    },
    frames: { Frames: [null, { frameID: 1, frameGem: 15, frameRace: 0, frameRole: 0, frameType: 1 }] },
    portraits: { Avatar: [null, {
      avatarID: 1, avatarName: 'Test', avatarGems: 0, avatarGenderID: 1,
      avatarRace: 1, avatarRole: 1, avatarType: 0,
    }] },
  };
}
function temporaryRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'morkahja-publication-'));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function errorCode(code: string) {
  return (err: unknown): boolean => err instanceof ContentPublicationError && err.code === code;
}

test('publishes an immutable baseline, preserving JSON keys, indexed arrays and expansion price', () => {
  temporaryRoot(root => {
    const content = sample();
    const first = publishContentRevision(root, {
      baseRevision: null, publicationId: 'initial_sample_001', content,
    });
    assert.equal(first.manifest.operation, 'initial');
    assert.equal(readContentPointer(root).revision, first.revision);
    const reloaded = readPublishedContent(root);
    assert.deepEqual(reloaded.content, content);
    assert.deepEqual(Object.keys((reloaded.content.encounters as typeof content.encounters)), ['00001']);
    assert.equal((reloaded.content.expansions as typeof content.expansions)
      .expansions['1001'].mExtensioPriceEurCents, 199);
    assert.equal(listContentRevisions(root).length, 1);
    assert.deepEqual(readContentRevision(root, first.revision).content, content);
  });
});

test('publishes new content without rewriting the previous revision and rejects stale writers', () => {
  temporaryRoot(root => {
    const initial = publishContentRevision(root, { baseRevision: null, publicationId: 'init_00002', content: sample() });
    const modified = sample();
    modified.encounters['00001'].mEncounterTitle = 'Revised encounter';
    const next = publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'update_00002', content: modified,
    });
    assert.equal(next.manifest.previousRevision, initial.revision);
    assert.equal(readPublishedContent(root).revision, next.revision);
    assert.equal((readContentRevision(root, initial.revision).content.encounters as typeof modified.encounters)
      ['00001'].mEncounterTitle, 'Test');
    assert.throws(() => publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'stale_00002', content: modified,
    }), errorCode('CONTENT_REVISION_CONFLICT'));
    assert.equal(readPublishedContent(root).revision, next.revision);
    assert.equal(publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'update_00002', content: modified,
    }).revision, next.revision); // retry only if it is still current
  });
});

test('rejects schema errors, missing references, deletions and pointer-swap failure', () => {
  temporaryRoot(root => {
    const initial = publishContentRevision(root, { baseRevision: null, publicationId: 'init_00003', content: sample() });
    const bad = sample();
    bad.frames.Frames[0] = { frameID: 0, frameGem: 1, frameRace: 0, frameRole: 0, frameType: 1 } as never;
    assert.throws(() => validateContentBundle(bad), errorCode('CONTENT_INVALID_Frames'));
    const brokenRef = sample();
    brokenRef.encounters['00001'].mEncounterSolutiuonA = 99999;
    assert.throws(() => publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'invalid_00003', content: brokenRef,
    }), errorCode('CONTENT_MISSING_SOLUTION'));
    const deleted = sample();
    delete (deleted.solutions as Record<string, unknown>)['10001'];
    assert.throws(() => publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'deletion_00003', content: deleted,
    }), errorCode('CONTENT_MISSING_SOLUTION'));
    assert.throws(() => publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'failed_00003', content: sample(),
      beforePointerSwap: () => { throw new Error('INJECTED_FAILURE'); },
    }), /INJECTED_FAILURE/);
    assert.equal(readPublishedContent(root).revision, initial.revision);
  });
});

test('detects changed bytes and fails closed without a published pointer', () => {
  temporaryRoot(root => {
    assert.throws(() => readPublishedContent(root));
    const initial = publishContentRevision(root, { baseRevision: null, publicationId: 'init_00004', content: sample() });
    const file = join(root, 'revisions', initial.revision, 'encountersdata.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('A test lore', 'Different lore'));
    assert.throws(() => readPublishedContent(root), errorCode('CONTENT_CHECKSUM_MISMATCH'));
  });
});

test('enforces exclusive publication lock and supports explicit rollback as a new revision', () => {
  temporaryRoot(root => {
    const initial = publishContentRevision(root, { baseRevision: null, publicationId: 'init_00005', content: sample() });
    const changed = sample();
    changed.encounters['00001'].mEncounterTitle = 'New';
    assert.throws(() => publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'locked_00005', content: changed,
      beforePointerSwap: () => {
        assert.throws(() => publishContentRevision(root, {
          baseRevision: initial.revision, publicationId: 'other_00005', content: changed,
        }), errorCode('CONTENT_PUBLICATION_LOCKED'));
        throw new Error('STOP_BEFORE_COMMIT');
      },
    }), /STOP_BEFORE_COMMIT/);
    const next = publishContentRevision(root, {
      baseRevision: initial.revision, publicationId: 'update_00005', content: changed,
    });
    const restored = restoreContentRevision(root, next.revision, initial.revision, 'restore_00005');
    assert.equal(restored.manifest.operation, 'rollback');
    assert.equal(restored.manifest.restoredFrom, initial.revision);
    assert.equal((readPublishedContent(root).content.encounters as typeof changed.encounters)
      ['00001'].mEncounterTitle, 'Test');
    assert.equal(listContentRevisions(root).length, 4); // includes aborted pre-commit revision
  });
});


test('the actual checked-in five-dataset legacy baseline validates without changing authored fields', () => {
  const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const names = {
    encounters: 'encountersdata.json', solutions: 'solutiondata.json',
    expansions: 'expansiondata.json', frames: 'frames.json', portraits: 'portraits.json',
  };
  const bundle = Object.fromEntries(Object.entries(names).map(([kind, file]) => [
    kind, JSON.parse(readFileSync(join(serverRoot, 'game', file), 'utf8')) as unknown,
  ]));
  validateContentBundle(bundle);
  temporaryRoot(root => {
    const imported = publishContentRevision(root, {
      baseRevision: null, publicationId: 'legacy_fixture_baseline', content: bundle,
    });
    assert.deepEqual(readContentRevision(root, imported.revision).content, bundle);
  });
});
