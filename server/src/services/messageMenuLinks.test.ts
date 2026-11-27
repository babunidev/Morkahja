import assert from 'node:assert/strict';

import { resolveOpenMenuAction } from './gameEventService.js';

// Messages at the top lead into the matching menu (Babuni, 2026-11-27).
const own = (type: string, payload: Record<string, unknown> = {}) =>
  resolveOpenMenuAction({ type, playerId: 'p1', payload }, 'p1')?.menus;

assert.deepEqual(own('support_appreciation_nudge', { topic: 'soul_link' }), ['soul_link']);
assert.deepEqual(own('support_appreciation_nudge', { topic: 'support' }), ['expansions', 'dice_shop']);
assert.deepEqual(own('support_appreciation_nudge'), ['expansions', 'dice_shop'], 'older messages without topic');
assert.deepEqual(own('gems_received'), ['expansions', 'dice_shop']);
assert.deepEqual(own('homeland_opened'), ['expansions']);
assert.deepEqual(own('account_key_security_reminder'), ['settings']);
assert.equal(own('level_up'), undefined, 'other messages lead nowhere');
assert.equal(
  resolveOpenMenuAction({ type: 'gems_received', playerId: 'p2', payload: {} }, 'p1'),
  undefined,
  'someone else\'s gems lead nowhere',
);

console.log('messageMenuLinks.test.ts passed');
