import { useEffect } from 'react';
import { useLayoutMode } from './useLayoutMode.js';

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function requestAppFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    return Promise.resolve();
  }

  const root = document.documentElement as FullscreenElement;
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);

  if (!request) {
    return Promise.resolve();
  }

  return Promise.resolve(request()).catch(() => undefined);
}

/** Request browser fullscreen on mobile portrait (retries on first user gesture). */
export function useMobileFullscreen(): void {
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';

  useEffect(() => {
    if (!mobilePortrait) {
      return undefined;
    }

    void requestAppFullscreen();

    function onFirstGesture(): void {
      void requestAppFullscreen();
    }

    document.addEventListener('pointerdown', onFirstGesture, { once: true });
    document.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', onFirstGesture);
      document.removeEventListener('touchstart', onFirstGesture);
    };
  }, [mobilePortrait]);
}

export default useMobileFullscreen;
