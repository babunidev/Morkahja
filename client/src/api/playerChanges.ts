/** The page's one change watcher; see `playerChangesWatcher.ts` (2026-11-27). */
import { fetchPlayerChanges } from './http.js';
import { createPlayerChangesWatcher } from './playerChangesWatcher.js';

export type { PlayerChangeTopic } from './playerChangesWatcher.js';

/**
 * Calls `refresh` whenever one of `topics` may have changed, and once a minute
 * as a safety net, while the tab is visible. The caller fetches once itself
 * when it subscribes. Returns the unsubscribe function.
 */
export const subscribePlayerChanges = createPlayerChangesWatcher({
  fetchChanges: fetchPlayerChanges,
  isVisible: () => document.visibilityState !== 'hidden',
  onVisibilityChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
  },
});
