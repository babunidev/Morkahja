import assert from 'node:assert/strict';

import {
  AMBIANCE_FADE_IN_MS,
  AMBIANCE_FADE_OUT_MS,
  openingRun,
  pickPiece,
  stepAfterPiece,
  type AmbianceRun,
} from './ambianceCycle.js';

assert.equal(AMBIANCE_FADE_IN_MS, 1000);
assert.equal(AMBIANCE_FADE_OUT_MS, 2000);

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}

assert.equal(openingRun(() => 0).piecesLeft, 3);
assert.equal(openingRun(() => 0.999999).piecesLeft, 7);
assert.equal(openingRun(() => 0).stage, 'A');

const continued = stepAfterPiece({ stage: 'A', piecesLeft: 4 }, () => 0);
assert.equal(continued.gap, 'rest');
assert.equal(continued.restMs, 7000);
assert.deepEqual(continued.next, { stage: 'A', piecesLeft: 3 });

assert.equal(stepAfterPiece({ stage: 'D', piecesLeft: 3 }, sequence([])).gap, 'crossfade');
assert.deepEqual(stepAfterPiece({ stage: 'D', piecesLeft: 3 }, sequence([])).next, {
  stage: 'D',
  piecesLeft: 2,
});

function finish(run: AmbianceRun, rolls: number[]) {
  return stepAfterPiece(run, sequence(rolls));
}

const towardWind = finish({ stage: 'A', piecesLeft: 1 }, [0.19, 0, 0]);
assert.equal(towardWind.gap, 'rest');
assert.deepEqual(towardWind.next, { stage: 'B', piecesLeft: 1 });

const stayCalm = finish({ stage: 'A', piecesLeft: 1 }, [0.2, 0, 0]);
assert.deepEqual(stayCalm.next, { stage: 'A', piecesLeft: 3 });

const windToCalm = finish({ stage: 'B', piecesLeft: 1 }, [0.49, 0, 0]);
assert.deepEqual(windToCalm.next, { stage: 'A', piecesLeft: 3 });

const windToApproach = finish({ stage: 'B', piecesLeft: 1 }, [0.5, 0]);
assert.equal(windToApproach.gap, 'rest');
assert.deepEqual(windToApproach.next, { stage: 'C', piecesLeft: 1 });

const approachToStorm = finish({ stage: 'C', piecesLeft: 1 }, [0.79, 0]);
assert.equal(approachToStorm.gap, 'crossfade');
assert.equal(approachToStorm.restMs, 0);
assert.deepEqual(approachToStorm.next, { stage: 'D', piecesLeft: 2 });

const approachBackToWind = finish({ stage: 'C', piecesLeft: 1 }, [0.8, 0, 0]);
assert.equal(approachBackToWind.gap, 'rest');
assert.deepEqual(approachBackToWind.next, { stage: 'B', piecesLeft: 1 });

const stormToWind = finish({ stage: 'D', piecesLeft: 1 }, [0.49, 0, 0]);
assert.equal(stormToWind.gap, 'fade-out');
assert.deepEqual(stormToWind.next, { stage: 'B', piecesLeft: 1 });

const stormToCalm = finish({ stage: 'D', piecesLeft: 1 }, [0.5, 0, 0]);
assert.deepEqual(stormToCalm.next, { stage: 'A', piecesLeft: 3 });

assert.equal(pickPiece(['one'], 'one', () => 0), 'one');
assert.equal(pickPiece(['one', 'two'], 'one', () => 0), 'two');
assert.equal(pickPiece(['one', 'two', 'three'], 'two', () => 0.999), 'three');

for (let roll = 0; roll < 20; roll += 1) {
  const step = finish({ stage: 'B', piecesLeft: 1 }, [roll / 20, 0, 0]);
  assert.notEqual(step.next.stage, 'D');
}
