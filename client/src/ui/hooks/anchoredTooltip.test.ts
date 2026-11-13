import assert from 'node:assert/strict';
import test from 'node:test';

import { placeTooltipTowardCenter } from './anchoredTooltip.js';

const container = { left: 100, top: 50, width: 400, height: 400 };
const tooltip = { width: 150, height: 90 };
const item = (x: number, y: number) => ({ left: container.left + x - 30, top: container.top + y - 30, width: 60, height: 60 });
const inside = (p: { left: number; top: number }) => (
  p.left >= 14 && p.top >= 14 && p.left + tooltip.width <= 386 && p.top + tooltip.height <= 386
);

test('bottom-left item: tooltip opens up and to the right, anchored by its bottom-left corner', () => {
  const p = placeTooltipTowardCenter(container, item(60, 340), tooltip);
  assert.equal(p.corner, 'bottom-left');
  assert.equal(p.left, 60 + 18);
  assert.equal(p.top, 340 - 18 - 90);
  assert.ok(inside(p));
});

test('top-right item: tooltip opens down and to the left', () => {
  const p = placeTooltipTowardCenter(container, item(340, 60), tooltip);
  assert.equal(p.corner, 'top-right');
  assert.ok(inside(p));
});

test('an item near the top edge never pushes the tooltip out of the picture', () => {
  for (const [x, y] of [[30, 30], [370, 30], [30, 370], [370, 370], [200, 200], [200, 380]]) {
    assert.ok(inside(placeTooltipTowardCenter(container, item(x!, y!), tooltip)), `item at ${x},${y}`);
  }
});

test('a tooltip too wide for either side next to a central item is still kept inside', () => {
  const wide = { width: 260, height: 60 };
  const p = placeTooltipTowardCenter(container, item(190, 300), wide);
  assert.ok(p.left >= 14 && p.left + wide.width <= 386);
  assert.ok(p.top >= 14 && p.top + wide.height <= 386);
});

test('middle-column item: tooltip is centred on it, touching it with the middle of an edge', () => {
  const lower = placeTooltipTowardCenter(container, item(200, 300), tooltip);
  assert.equal(lower.corner, 'bottom-center');
  assert.equal(lower.left, 200 - tooltip.width / 2);
  assert.equal(lower.top, 300 - 30 - 6 - tooltip.height);
  const upper = placeTooltipTowardCenter(container, item(200, 90), tooltip);
  assert.equal(upper.corner, 'top-center');
  assert.equal(upper.top, 90 + 30 + 6);
  assert.ok(inside(lower) && inside(upper));
});

