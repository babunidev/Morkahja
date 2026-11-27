import assert from 'node:assert/strict';

import {
  createPlayerChangesWatcher,
  type PlayerChangesResponse,
} from './playerChangesWatcher.js';

// The change watcher (2026-11-27): refresh only on a reported change, nothing
// while the tab is hidden, a fresh refresh on return, spaced feed refreshes.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeServer() {
  let state: PlayerChangesResponse = { boot: 'b1', player: 0, feed: 0 };
  let wake: (() => void) | null = null;
  let requests = 0;
  let visible = true;
  let visibilityListener: (() => void) | null = null;

  const fetchChanges = (since: PlayerChangesResponse | null, signal: AbortSignal) => {
    requests += 1;
    return new Promise<PlayerChangesResponse>((resolve, reject) => {
      const differs = () => !since
        || since.boot !== state.boot
        || since.player !== state.player
        || since.feed !== state.feed;
      if (differs()) {
        resolve({ ...state });
        return;
      }
      wake = () => {
        if (differs()) {
          wake = null;
          resolve({ ...state });
        }
      };
      signal.addEventListener('abort', () => {
        wake = null;
        reject(new Error('aborted'));
      }, { once: true });
    });
  };

  return {
    watcher: createPlayerChangesWatcher({
      fetchChanges,
      isVisible: () => visible,
      onVisibilityChange: (listener) => { visibilityListener = listener; },
      timing: { safetyRefreshMs: 60_000, feedMinGapMs: 150, errorRetryMs: 50 },
    }),
    change(next: Partial<PlayerChangesResponse>) {
      state = { ...state, ...next };
      wake?.();
    },
    setVisible(next: boolean) {
      visible = next;
      visibilityListener?.();
    },
    get requests() { return requests; },
  };
}

const server = fakeServer();
const calls = { player: 0, feed: 0, both: 0 };
const stopPlayer = server.watcher(['player'], () => { calls.player += 1; });
const stopFeed = server.watcher(['feed'], () => { calls.feed += 1; });
const stopBoth = server.watcher(['player', 'feed'], () => { calls.both += 1; });
await sleep(20);
assert.deepEqual(calls, { player: 0, feed: 0, both: 0 }, 'the first answer only sets the starting point');

server.change({ player: 1 });
await sleep(20);
assert.deepEqual(calls, { player: 1, feed: 0, both: 1 }, 'a player change refreshes player subscribers');

server.change({ feed: 1 });
await sleep(20);
assert.deepEqual(calls, { player: 1, feed: 1, both: 2 }, 'a feed change refreshes feed subscribers');

// Feed changes right after each other are spaced, the last one is not lost.
server.change({ feed: 2 });
await sleep(20);
server.change({ feed: 3 });
await sleep(20);
assert.equal(calls.feed, 1, 'feed refreshes wait for the gap');
await sleep(200);
assert.equal(calls.feed, 2, 'one refresh follows after the gap');

// Hidden tab: the waiting request is dropped and nothing is asked.
server.setVisible(false);
const requestsWhileHidden = server.requests;
server.change({ player: 2 });
await sleep(50);
assert.equal(server.requests, requestsWhileHidden, 'no requests while hidden');
assert.equal(calls.player, 1, 'no refresh while hidden');

// Coming back refreshes everyone once and waits again.
server.setVisible(true);
await sleep(20);
assert.deepEqual(calls, { player: 2, feed: 3, both: 4 }, 'returning refreshes every subscriber once');

// A server restart (new boot id) refreshes everyone.
server.change({ boot: 'b2', player: 0, feed: 0 });
await sleep(20);
assert.deepEqual(calls, { player: 3, feed: 4, both: 5 }, 'a new server start refreshes every subscriber');

// After the last unsubscribe the watcher stops asking.
stopPlayer();
stopFeed();
stopBoth();
const requestsAfterStop = server.requests;
server.change({ player: 5 });
await sleep(50);
assert.equal(server.requests, requestsAfterStop, 'no requests without subscribers');

console.log('playerChangesWatcher.test.ts passed');
