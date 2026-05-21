import type { CSSProperties } from 'react';

export const FADE_DURATION_MS = 420;
export const FADE_DURATION_SECONDS = FADE_DURATION_MS / 1000;
export const ENCOUNTER_FADE_DURATION_MS = 720;
export const ENCOUNTER_ACTIONS_REVEAL_DELAY_MS = 160;
export const ENCOUNTER_ACTIONS_FADE_DURATION_MS = 1100;

export const fadeTransition = `opacity ${FADE_DURATION_MS}ms ease`;
export const encounterFadeTransition = `opacity ${ENCOUNTER_FADE_DURATION_MS}ms ease`;
export const encounterActionsFadeTransition = `opacity ${ENCOUNTER_ACTIONS_FADE_DURATION_MS}ms ease`;

export function fadeStyle(visible: boolean): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transition: fadeTransition,
  };
}

export function waitForFade(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, FADE_DURATION_MS);
  });
}
