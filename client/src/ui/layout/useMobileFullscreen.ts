import { useEffect } from 'react';
import { useLayoutMode } from './useLayoutMode.js';

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isInstalledStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function requestAppFullscreen(): Promise<void> {
  if (document.fullscreenElement || isInstalledStandalone()) {
    return Promise.resolve();
  }

  const root = document.documentElement as FullscreenElement;
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);

  if (!request) {
    return Promise.resolve();
  }

  return Promise.resolve(request()).catch(() => undefined);
}

/** Request browser fullscreen on mobile portrait (retries on user gestures). */
export function useMobileFullscreen(): void {
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';

  useEffect(() => {
    if (!mobilePortrait || isInstalledStandalone()) {
      return undefined;
    }

    void requestAppFullscreen();

    function onGesture(): void {
      if (document.fullscreenElement) {
        return;
      }
      void requestAppFullscreen();
    }

    document.addEventListener('pointerdown', onGesture);
    document.addEventListener('touchstart', onGesture, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('touchstart', onGesture);
    };
  }, [mobilePortrait]);
}

export default useMobileFullscreen;
