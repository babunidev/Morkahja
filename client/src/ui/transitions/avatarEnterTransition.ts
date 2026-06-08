import type { CSSProperties } from 'react';
import type { EncounterRoomSnapshotDto, PersistedAvatar } from '../../api/http.js';
import { selectAvatar } from '../../api/http.js';
import { ensureSoloLeaderRoom } from '../game/roomSession.js';
import { AVATAR_ENTER_TARGET_ATTR } from '../avatar/AvatarPortraitStack.js';
import { waitForFade } from './fade.js';

export const AVATAR_ENTER_FADE_MS = 420;
export const AVATAR_ENTER_TO_CENTER_MS = 580;
export const AVATAR_ENTER_CENTER_GLOW_MS = 1400;
export const AVATAR_ENTER_TO_GAME_MS = 680;
// Avatar swells noticeably on its way to the middle, then shrinks down to the
// in-game portrait size as it flies into the game.
export const AVATAR_ENTER_CENTER_SCALE = 1.55;

/** Marks the moving avatar overlay so other effects can track its live bounds. */
export const AVATAR_ENTER_OVERLAY_ATTR = 'data-avatar-enter-overlay';

export type AvatarEnterHandoffPhase = 'to-center' | 'at-center' | 'to-game';

export interface AvatarEnterHandoffSnapshot {
  avatar: PersistedAvatar;
  bounds: Bounds;
  moveDurationMs: number;
  phase: AvatarEnterHandoffPhase;
  fading?: boolean;
}

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
    zIndex: 250,
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

export async function waitForEnterTargetBounds(maxAttempts = 80): Promise<Bounds | null> {
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

export async function runAvatarEnterHandoff({
  candidate,
  onEnterHandoffChange,
  onHandoffLand,
  onPrepareGame,
  sourceElement,
}: {
  candidate: PersistedAvatar;
  onEnterHandoffChange: (snapshot: AvatarEnterHandoffSnapshot | null) => void;
  onHandoffLand?: () => void;
  onPrepareGame: (avatar: PersistedAvatar, room: EncounterRoomSnapshotDto) => void;
  sourceElement: HTMLElement;
}): Promise<void> {
  const fromBounds = readBounds(sourceElement);
  onEnterHandoffChange({
    avatar: candidate,
    bounds: fromBounds,
    moveDurationMs: 0,
    phase: 'to-center',
  });

  const { avatar: selectedAvatar } = await selectAvatar(candidate);
  const room = await ensureSoloLeaderRoom(selectedAvatar.id);
  onPrepareGame(selectedAvatar, room);
  await waitForNextPaint();
  await waitMs(80);

  const centerTarget = centerBounds(fromBounds);
  await waitForNextPaint();
  onEnterHandoffChange({
    avatar: selectedAvatar,
    bounds: centerTarget,
    moveDurationMs: AVATAR_ENTER_TO_CENTER_MS,
    phase: 'to-center',
  });
  await waitMs(AVATAR_ENTER_TO_CENTER_MS);

  onEnterHandoffChange({
    avatar: selectedAvatar,
    bounds: centerTarget,
    moveDurationMs: 0,
    phase: 'at-center',
  });
  await waitMs(AVATAR_ENTER_CENTER_GLOW_MS);

  const gameTarget = await waitForEnterTargetBounds();
  if (gameTarget) {
    await waitForNextPaint();
    onEnterHandoffChange({
      avatar: selectedAvatar,
      bounds: gameTarget,
      moveDurationMs: AVATAR_ENTER_TO_GAME_MS,
      phase: 'to-game',
    });
    await waitMs(AVATAR_ENTER_TO_GAME_MS);
  }

  onHandoffLand?.();
  onEnterHandoffChange({
    avatar: selectedAvatar,
    bounds: gameTarget ?? centerTarget,
    moveDurationMs: AVATAR_ENTER_FADE_MS,
    phase: 'to-game',
    fading: true,
  });
  await waitForFade();
  onEnterHandoffChange(null);
}
