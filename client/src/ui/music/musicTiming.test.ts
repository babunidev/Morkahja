import assert from 'node:assert/strict';

import {
  ENCOUNTER_LOOP_BREAK_MAX_MS,
  ENCOUNTER_LOOP_BREAK_MIN_MS,
  loopBreakMs,
  MENU_LOOP_BREAK_MAX_MS,
  MENU_LOOP_BREAK_MIN_MS,
  PIECE_FADE_IN_MS,
  PIECE_FADE_OUT_MS,
} from './musicTiming.js';

assert.equal(loopBreakMs('menu', () => 0), MENU_LOOP_BREAK_MIN_MS);
assert.equal(loopBreakMs('ambient', () => 0), ENCOUNTER_LOOP_BREAK_MIN_MS);
assert.equal(loopBreakMs('menu', () => 0.999999), MENU_LOOP_BREAK_MAX_MS);
assert.equal(loopBreakMs('ambient', () => 0.999999), ENCOUNTER_LOOP_BREAK_MAX_MS);

for (let index = 0; index < 200; index += 1) {
  const menu = loopBreakMs('menu', () => index / 200);
  const encounter = loopBreakMs('ambient', () => index / 200);
  assert.ok(menu >= MENU_LOOP_BREAK_MIN_MS && menu <= MENU_LOOP_BREAK_MAX_MS);
  assert.ok(encounter >= ENCOUNTER_LOOP_BREAK_MIN_MS && encounter <= ENCOUNTER_LOOP_BREAK_MAX_MS);
}

// 2026-11-17: a piece may follow straight on; every piece fades in and out over one second.
assert.equal(MENU_LOOP_BREAK_MIN_MS, 0);
assert.equal(ENCOUNTER_LOOP_BREAK_MIN_MS, 0);
assert.equal(PIECE_FADE_IN_MS, 1000);
assert.equal(PIECE_FADE_OUT_MS, 2000);
