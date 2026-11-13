import assert from 'node:assert/strict';
import test from 'node:test';

import { amendStep, canRedo, canUndo, recordStep, redoStep, startHistory, undoStep } from './creationHistory.js';

const same = (a: string, b: string): boolean => a === b;

test('undo and redo walk the saved combinations', () => {
  let history = startHistory('A');
  history = recordStep(history, 'B', same);
  history = recordStep(history, 'C', same);
  assert.equal(canRedo(history), false);
  history = undoStep(history);
  assert.equal(history.entries[history.index], 'B');
  history = undoStep(undoStep(history));
  assert.equal(history.entries[history.index], 'A', 'stops at the first');
  assert.equal(canUndo(history), false);
  history = redoStep(redoStep(redoStep(history)));
  assert.equal(history.entries[history.index], 'C', 'stops at the last');
});

test('a change after stepping back is inserted, and the later steps stay reachable', () => {
  let history = startHistory('A');
  history = recordStep(history, 'B', same);
  history = recordStep(history, 'C', same);
  history = undoStep(undoStep(history));
  history = recordStep(history, 'A2', same);
  assert.deepEqual(history.entries, ['A', 'A2', 'B', 'C']);
  assert.equal(history.entries[history.index], 'A2');
  history = redoStep(history);
  assert.equal(history.entries[history.index], 'B');
});

test('the same combination is not saved twice; typing a name amends the current step', () => {
  let history = startHistory('A');
  assert.equal(recordStep(history, 'A', same), history);
  history = recordStep(history, 'B', same);
  history = amendStep(history, 'B named');
  assert.deepEqual(history.entries, ['A', 'B named']);
});
