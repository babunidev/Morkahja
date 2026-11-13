import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/**
 * Menus and panels open only once the pictures inside them are loaded and
 * decoded (Babuni, 2026-11-13: "load it first and then show it"). Meanwhile
 * the button that opened it pulses (`useMenuPreparing`). A browser decodes an
 * image only when it first becomes visible, so a panel mounted but hidden
 * still stutters on its first opening unless its pictures are decoded first.
 */

/** Never wait longer than this for pictures: a slow network still opens the menu. */
export const MENU_READY_TIMEOUT_MS = 3000;

const decodedUrls = new Set<string>();
const pendingUrls = new Map<string, Promise<void>>();

/** Loads and decodes one picture once; later calls resolve at once. */
export function preloadImage(url: string): Promise<void> {
  if (!url || decodedUrls.has(url)) {
    return Promise.resolve();
  }
  const pending = pendingUrls.get(url);
  if (pending) {
    return pending;
  }
  const image = new Image();
  image.src = url;
  const promise = (typeof image.decode === 'function'
    ? image.decode()
    : new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    }))
    .catch(() => undefined)
    .then(() => {
      decodedUrls.add(url);
      pendingUrls.delete(url);
    });
  pendingUrls.set(url, promise);
  return promise;
}

const CSS_URL_PATTERN = /url\(["']?([^"')]+)["']?\)/g;

/** Every picture shown inside `root`: `<img>` sources and CSS background images. */
export function imageUrlsIn(root: Element | null): string[] {
  if (!root) {
    return [];
  }
  const urls = new Set<string>();
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    if (element instanceof HTMLImageElement) {
      const source = element.currentSrc || element.src;
      if (source && element.loading !== 'lazy') {
        urls.add(source);
      }
    }
    const background = getComputedStyle(element).backgroundImage;
    if (background && background !== 'none') {
      for (const match of background.matchAll(CSS_URL_PATTERN)) {
        if (match[1] && !match[1].startsWith('data:')) {
          urls.add(match[1]);
        }
      }
    }
  }
  return [...urls];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

/** Resolves once every picture inside `root` is decoded, or after the time-out. */
export async function waitForImagesIn(
  root: Element | null,
  timeoutMs = MENU_READY_TIMEOUT_MS,
): Promise<void> {
  const pending = imageUrlsIn(root).filter((url) => !decodedUrls.has(url));
  if (pending.length === 0) {
    return;
  }
  await Promise.race([Promise.all(pending.map(preloadImage)), wait(timeoutMs)]);
}

// --- Which menu buttons are waiting (they pulse meanwhile) ------------------

const preparingKeys = new Set<string>();
const listeners = new Set<() => void>();
let preparingVersion = 0;

function notify(): void {
  preparingVersion += 1;
  listeners.forEach((listener) => listener());
}

export function setMenuPreparing(key: string, preparing: boolean): void {
  const had = preparingKeys.has(key);
  if (preparing && !had) {
    preparingKeys.add(key);
    notify();
  } else if (!preparing && had) {
    preparingKeys.delete(key);
    notify();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while the menu opened by this button is still loading its pictures. */
export function useMenuPreparing(key: string): boolean {
  useSyncExternalStore(subscribe, () => preparingVersion, () => 0);
  return preparingKeys.has(key);
}

/** For a group of buttons (a menu bar): `isPreparing(key)` for each. */
export function useMenuPreparingCheck(): (key: string) => boolean {
  useSyncExternalStore(subscribe, () => preparingVersion, () => 0);
  return (key) => preparingKeys.has(key);
}

/** Class for a button whose menu is loading: a soft pulse (see index.css). */
export function menuPreparingClass(preparing: boolean): string {
  return preparing ? ' morkahja-menu-preparing' : '';
}

/**
 * Opens a menu once it is ready: marks `key` as preparing, waits a frame for
 * the menu's content to be in the page, waits for `isDataReady` (polled each
 * frame, for menus that fetch their list first), then for every picture
 * inside `root()`, then calls `reveal`. Returns a cancel function.
 */
export function revealMenuWhenReady(
  key: string | null,
  root: () => Element | null,
  reveal: () => void,
  isDataReady: () => boolean = () => true,
): () => void {
  let cancelled = false;
  if (key) {
    setMenuPreparing(key, true);
  }
  const started = performance.now();

  void (async () => {
    await nextFrame();
    while (!cancelled && !isDataReady() && performance.now() - started < MENU_READY_TIMEOUT_MS) {
      await nextFrame();
    }
    if (cancelled) {
      return;
    }
    // A frame for the list that just arrived to be drawn, then its pictures.
    await nextFrame();
    const remaining = Math.max(400, MENU_READY_TIMEOUT_MS - (performance.now() - started));
    await waitForImagesIn(root(), remaining);
    if (cancelled) {
      return;
    }
    if (key) {
      setMenuPreparing(key, false);
    }
    reveal();
  })();

  return () => {
    cancelled = true;
    if (key) {
      setMenuPreparing(key, false);
    }
  };
}

/**
 * For something that appears on its own (a new avatar in the avatar menu):
 * false until every picture inside `ref` is decoded, then true. `resetKey`
 * starts over when the content changes.
 */
export function useImagesReady(ref: RefObject<Element | null>, resetKey: string): boolean {
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void nextFrame()
      .then(() => waitForImagesIn(ref.current))
      .then(() => {
        if (!cancelled) {
          setReadyKey(resetKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ref, resetKey]);

  return readyKey === resetKey;
}
