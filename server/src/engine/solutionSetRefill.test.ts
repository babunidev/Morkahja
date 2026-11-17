import assert from 'node:assert/strict';
import test from 'node:test';

import { allocateSolutionSet, type SolutionSetRequirements } from '@shared/solutionSet.js';

// Babuni (2026-11-17): when the item in a slot has no charge left, the slot
// refills from another item of the same kind, so one encounter can use several.
const KEY_TYPE = 7;
const LIGHT_TYPE = 9;
const typeOf = (solutionId: number): number | undefined => ({
  101: KEY_TYPE,
  102: KEY_TYPE,
  103: KEY_TYPE,
  201: LIGHT_TYPE,
  202: LIGHT_TYPE,
  500: KEY_TYPE,
} as Record<number, number>)[solutionId];

const requirements: SolutionSetRequirements = {
  A: { primarySolutionId: 0, secondarySolutionType: KEY_TYPE },
  B: { primarySolutionId: 0, secondarySolutionType: LIGHT_TYPE },
  C: { primarySolutionId: 500, secondarySolutionType: KEY_TYPE },
  D: { primarySolutionId: 0, secondarySolutionType: 0 },
};

test('a slot whose item is spent refills from another item of its kind', () => {
  // One charge of 101 and one of 102, both keys: slot A can be used twice.
  const allocation = allocateSolutionSet(['A', 'A'], { ...requirements, C: { primarySolutionId: 0, secondarySolutionType: 0 } }, [101, 102], typeOf);
  assert.ok(allocation);
  assert.deepEqual(allocation.map((pick) => pick.solutionId), [101, 102]);
  assert.deepEqual(allocation.map((pick) => pick.copyIndex), [0, 1], 'each copy has its own roll');
});

test('the same item is used while it has charges, then the refill', () => {
  const noC = { ...requirements, C: { primarySolutionId: 0, secondarySolutionType: 0 } };
  const allocation = allocateSolutionSet(['A', 'A', 'A'], noC, [101, 101, 103], typeOf);
  assert.deepEqual(allocation?.map((pick) => pick.solutionId), [101, 101, 103]);
});

test('without another item of that kind, the slot is spent', () => {
  const noC = { ...requirements, C: { primarySolutionId: 0, secondarySolutionType: 0 } };
  assert.equal(allocateSolutionSet(['A', 'A'], noC, [101, 201], typeOf), null);
});

test("an item shown in another slot stays that slot's", () => {
  // C shows its named item 500 (a key); A shows 101. A's second pick may not take 500.
  assert.equal(allocateSolutionSet(['A', 'A'], requirements, [101, 500], typeOf), null);
  assert.deepEqual(allocateSolutionSet(['A', 'C'], requirements, [101, 500], typeOf)?.map((pick) => pick.solutionId), [101, 500]);
});

test('a named item that runs out refills from the alternatives', () => {
  // C names 500; with one charge, the second C pick takes a key of the alternative type.
  const allocation = allocateSolutionSet(['C', 'C'], { ...requirements, A: { primarySolutionId: 0, secondarySolutionType: 0 } }, [500, 102], typeOf);
  assert.deepEqual(allocation?.map((pick) => [pick.solutionId, pick.lane]), [[500, 'primary'], [102, 'secondary']]);
});

test('adding a pick never changes the items of the picks already locked', () => {
  const noC = { ...requirements, C: { primarySolutionId: 0, secondarySolutionType: 0 } };
  const inventory = [101, 102, 103, 201, 202];
  const sequence: Array<'A' | 'B'> = ['A', 'B', 'A', 'B'];
  let previous: number[] = [];
  for (let length = 1; length <= sequence.length; length += 1) {
    const ids = allocateSolutionSet(sequence.slice(0, length), noC, inventory, typeOf)!.map((pick) => pick.solutionId);
    assert.deepEqual(ids.slice(0, previous.length), previous);
    previous = ids;
  }
  assert.deepEqual(previous, [101, 201, 102, 202]);
});
