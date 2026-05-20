import { useState } from 'react';

export const NAV_BUTTON_PRESS_MS = 240;

export function navButtonPressAnimation(pressed: boolean): string | undefined {
  return pressed
    ? `morkahja-nav-button-press ${NAV_BUTTON_PRESS_MS}ms ease-out`
    : undefined;
}

export function useNavButtonPress() {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  function pulse(key: string): void {
    setPressedKey(key);
    window.setTimeout(() => {
      setPressedKey((current) => (current === key ? null : current));
    }, NAV_BUTTON_PRESS_MS);
  }

  function isPressed(key: string): boolean {
    return pressedKey === key;
  }

  return { pulse, isPressed, pressAnimation: navButtonPressAnimation };
}
