import type { CSSProperties } from 'react';
import { AVATAR_ENTER_TARGET_ATTR } from '../avatar/AvatarPortraitStack.js';

export const AVATAR_ENTER_FADE_MS = 420;
export const AVATAR_ENTER_TO_CENTER_MS = 580;
export const AVATAR_ENTER_CENTER_GLOW_MS = 1400;
export const AVATAR_ENTER_TO_GAME_MS = 680;
export const AVATAR_ENTER_CENTER_SCALE = 1.12;

export type AvatarEnterHandoffPhase = 'to-center' | 'at-center' | 'to-game';

export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function readBounds(element: Element): Bounds {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function centerBounds(bounds: Bounds, scale = AVATAR_ENTER_CENTER_SCALE): Bounds {
  const width = bounds.width * scale;
  const height = bounds.height * scale;

  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

export function boundsToStyle(bounds: Bounds): CSSProperties {
  return {
    position: 'fixed',
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    zIndex: 60,
    pointerEvents: 'none',
  };
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export async function animateBounds(
  from: Bounds,
  to: Bounds,
  durationMs: number,
  onFrame: (bounds: Bounds) => void,
): Promise<void> {
  await waitForNextPaint();
  onFrame(from);
  await waitForNextPaint();
  onFrame(to);
  await waitMs(durationMs);
}

export async function waitForEnterTargetBounds(maxAttempts = 40): Promise<Bounds | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const target = document.querySelector(`[${AVATAR_ENTER_TARGET_ATTR}]`);
    if (target) {
      const bounds = readBounds(target);
      if (bounds.width > 0 && bounds.height > 0) {
        return bounds;
      }
    }

    await waitMs(32);
  }

  return null;
}
