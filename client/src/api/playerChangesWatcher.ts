/**
 * One change watcher for the whole page (2026-11-27). Achievements, help
 * invitations and the Scribes feed used to be fetched every 5–10 seconds, even
 * in a hidden tab. Now one waiting `GET /player/changes` request tells the
 * subscribers when the player's data (`player`) or the feed (`feed`) changed,
 * and each one fetches only then.
 *
 * - Hidden tab: no requests at all. Coming back refreshes every subscriber once.
 * - Safety net: every subscriber refreshes at least once a minute anyway, for
 *   changes the server does not announce (a new UTC day, a server restart).
 * - Feed refreshes are spaced at least 3 s apart, because many
 *   players' events wake the feed.
 */
export interface PlayerChangesResponse {
  boot: string;
  player: number;
  feed: number;
}

export interface PlayerChangesEnvironment {
  fetchChanges: (since: PlayerChangesResponse | null, signal: AbortSignal) => Promise<PlayerChangesResponse>;
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => void;
  /** Tests shorten these. */
  timing?: Partial<typeof DEFAULT_TIMING>;
}

export type PlayerChangeTopic = 'player' | 'feed';

interface Subscriber {
  topics: ReadonlySet<PlayerChangeTopic>;
  refresh: () => void;
}

const DEFAULT_TIMING = {
  safetyRefreshMs: 60_000,
  feedMinGapMs: 3_000,
  errorRetryMs: 5_000,
};

export type SubscribePlayerChanges = (
  topics: readonly PlayerChangeTopic[],
  refresh: () => void,
) => () => void;

export function createPlayerChangesWatcher(
  environment: PlayerChangesEnvironment,
): SubscribePlayerChanges {
  const { safetyRefreshMs, feedMinGapMs, errorRetryMs } = { ...DEFAULT_TIMING, ...environment.timing };
  const subscribers = new Set<Subscriber>();
  let running: AbortController | null = null;
  let safetyTimer: ReturnType<typeof setInterval> | undefined;
  let lastFeedRefreshAt = 0;
  let feedTimer: ReturnType<typeof setTimeout> | undefined;

  function refreshAll(): void {
    for (const subscriber of subscribers) {
      subscriber.refresh();
    }
  }

  function refreshTopic(topic: PlayerChangeTopic, alreadyRefreshed: Set<Subscriber>): void {
    for (const subscriber of subscribers) {
      if (subscriber.topics.has(topic) && !alreadyRefreshed.has(subscriber)) {
        alreadyRefreshed.add(subscriber);
        subscriber.refresh();
      }
    }
  }

  function refreshFeedSpaced(alreadyRefreshed: Set<Subscriber>): void {
    const wait = lastFeedRefreshAt + feedMinGapMs - Date.now();
    if (wait <= 0) {
      lastFeedRefreshAt = Date.now();
      refreshTopic('feed', alreadyRefreshed);
      return;
    }
    if (feedTimer === undefined) {
      feedTimer = globalThis.setTimeout(() => {
        feedTimer = undefined;
        lastFeedRefreshAt = Date.now();
        refreshTopic('feed', new Set());
      }, wait);
    }
  }

  function pause(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = globalThis.setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        globalThis.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  async function watch(signal: AbortSignal): Promise<void> {
    // The subscribers fetched when they subscribed (or when the tab came back),
    // so the first answer only sets the starting point.
    let known: PlayerChangesResponse | null = null;
    while (!signal.aborted) {
      try {
        const next = await environment.fetchChanges(known, signal);
        if (signal.aborted) {
          return;
        }
        if (known) {
          const refreshed = new Set<Subscriber>();
          if (next.boot !== known.boot) {
            refreshAll();
          } else {
            if (next.player !== known.player) {
              refreshTopic('player', refreshed);
            }
            if (next.feed !== known.feed) {
              refreshFeedSpaced(refreshed);
            }
          }
        }
        known = next;
      } catch {
        if (signal.aborted) {
          return;
        }
        // Changes may have been missed while the server was unreachable.
        known = null;
        await pause(errorRetryMs, signal);
        if (!signal.aborted) {
          refreshAll();
        }
      }
    }
  }

  function start(): void {
    if (running || subscribers.size === 0 || !environment.isVisible()) {
      return;
    }
    running = new AbortController();
    void watch(running.signal);
    safetyTimer = globalThis.setInterval(refreshAll, safetyRefreshMs);
  }

  function stop(): void {
    running?.abort();
    running = null;
    globalThis.clearInterval(safetyTimer);
    safetyTimer = undefined;
    globalThis.clearTimeout(feedTimer);
    feedTimer = undefined;
  }

  function onVisibilityChange(): void {
    if (!environment.isVisible()) {
      stop();
      return;
    }
    if (!running && subscribers.size > 0) {
      refreshAll();
      start();
    }
  }

  let visibilityListening = false;

  /**
   * Calls `refresh` whenever one of `topics` may have changed, and once a minute
   * as a safety net, while the tab is visible. The caller fetches once itself
   * when it subscribes. Returns the unsubscribe function.
   */
  function subscribe(
    topics: readonly PlayerChangeTopic[],
    refresh: () => void,
  ): () => void {
    if (!visibilityListening) {
      environment.onVisibilityChange(onVisibilityChange);
      visibilityListening = true;
    }
    const subscriber: Subscriber = { topics: new Set(topics), refresh };
    subscribers.add(subscriber);
    start();
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
      }
    };
  }

  return subscribe;
}
