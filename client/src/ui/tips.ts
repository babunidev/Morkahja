import { useEffect, useState } from 'react';

/**
 * Tips and tutorial (Babuni, 2026-11-23): one setting turns every "?" help in
 * the game on or off, and later the tutorial's tips too. Kept in the browser
 * like the sound settings; on unless turned off.
 */
export const TIPS_ENABLED_STORAGE_KEY = 'morkahja.tips.enabled';
const TIPS_CHANGED_EVENT = 'morkahja:tips-changed';

export function storedTipsEnabled(): boolean {
  try {
    return window.localStorage.getItem(TIPS_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setTipsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(TIPS_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Without storage the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(TIPS_CHANGED_EVENT, { detail: enabled }));
}

/** Whether tips show; follows the setting while the page is open. */
export function useTipsEnabled(): boolean {
  const [enabled, setEnabled] = useState(storedTipsEnabled);
  useEffect(() => {
    const update = (): void => setEnabled(storedTipsEnabled());
    window.addEventListener(TIPS_CHANGED_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(TIPS_CHANGED_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return enabled;
}
