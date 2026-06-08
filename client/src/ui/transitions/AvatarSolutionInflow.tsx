import { useEffect, useRef, type CSSProperties } from 'react';
import solutionData from '../../data/game/solutiondata.json';
import type { AvatarInventory, PersistedAvatar } from '../../api/http.js';
import {
  AVATAR_ENTER_CENTER_GLOW_MS,
  AVATAR_ENTER_OVERLAY_ATTR,
  AVATAR_ENTER_TO_CENTER_MS,
  AVATAR_ENTER_TO_GAME_MS,
} from './avatarEnterTransition.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

/** Solutions are seeded across the avatar's whole travel (centre + glow + game). */
const SPAWN_WINDOW_MS =
  AVATAR_ENTER_TO_CENTER_MS + AVATAR_ENTER_CENTER_GLOW_MS + AVATAR_ENTER_TO_GAME_MS;

const FLIER_TRAVEL_MIN_MS = 620;
const FLIER_TRAVEL_MAX_MS = 1040;
// Full size roughly matches the in-game solution icon (SOLUTION_ACTION_SIZE_PX).
const FLIER_FULL_SIZE_MIN = 66;
const FLIER_FULL_SIZE_MAX = 88;
const MAX_FLIERS = 64;

/** Scale envelope: small on spawn, full size mid-flight, shrinks into the avatar. */
const FLIER_START_SCALE = 0.32;
const FLIER_ENTER_SCALE = 0.38;
const FLIER_GROW_PEAK = 0.66;

/** Quick fade-in, then fade-out as the icon sinks into the avatar. */
const FADE_IN_FRACTION = 0.16;
const FADE_OUT_FRACTION = 0.42;

interface SolutionRecord {
  mSolutionIconName?: string;
}

const solutionsById = solutionData as Record<string, SolutionRecord>;

const containerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Just beneath the moving avatar overlay (z 250) so icons vanish "into" it.
  zIndex: 249,
  overflow: 'hidden',
  pointerEvents: 'none',
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function inventorySolutionSrcs(inventory: AvatarInventory | undefined): string[] {
  if (!inventory) {
    return [];
  }

  const items = [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ].filter((item) => item.uses > 0);

  const srcs: string[] = [];
  for (const item of items) {
    const iconName = solutionsById[String(item.solutionId)]?.mSolutionIconName;
    if (iconName) {
      srcs.push(`${SOLUTION_IMAGE_ROOT}/${iconName}.webp`);
    }
  }

  return srcs;
}

function stageBounds(): { left: number; top: number; width: number; height: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(vw, (vh * 9) / 16);
  const height = Math.min(vh, (vw * 16) / 9);

  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
  };
}

interface Flier {
  el: HTMLImageElement;
  startX: number;
  startY: number;
  startTime: number;
  travelMs: number;
  size: number;
  peak: number;
  done: boolean;
}

export function AvatarSolutionInflow({ avatar }: { avatar: PersistedAvatar }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Capture the inventory once when the animation begins.
  const inventoryRef = useRef<AvatarInventory | undefined>(avatar.inventory);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const srcs = inventorySolutionSrcs(inventoryRef.current);
    if (srcs.length === 0) {
      return undefined;
    }

    const count = Math.min(srcs.length, MAX_FLIERS);
    const fliers: Flier[] = [];
    const timeouts: number[] = [];
    let running = true;
    let rafId = 0;

    const spawn = (src: string): void => {
      const stage = stageBounds();
      const startX = stage.left + stage.width * randomBetween(0.08, 0.92);
      const startY = stage.top + stage.height * randomBetween(0.08, 0.92);
      const size = randomBetween(FLIER_FULL_SIZE_MIN, FLIER_FULL_SIZE_MAX);

      const el = document.createElement('img');
      el.src = src;
      el.alt = '';
      el.draggable = false;
      el.setAttribute('aria-hidden', 'true');
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.objectFit = 'contain';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.willChange = 'transform, opacity';
      el.style.filter = 'drop-shadow(0 0 6px rgba(255, 221, 150, 0.55))';
      el.style.transform = `translate3d(${startX - size / 2}px, ${startY - size / 2}px, 0) scale(${FLIER_START_SCALE})`;
      container.appendChild(el);

      fliers.push({
        el,
        startX,
        startY,
        startTime: performance.now(),
        travelMs: randomBetween(FLIER_TRAVEL_MIN_MS, FLIER_TRAVEL_MAX_MS),
        size,
        peak: randomBetween(0.82, 1),
        done: false,
      });
    };

    // Spread the spawns across the whole animation so icons keep streaming in.
    for (let index = 0; index < count; index += 1) {
      const base = (index / count) * SPAWN_WINDOW_MS;
      const delay = Math.max(0, base + randomBetween(-70, 70));
      const src = srcs[index % srcs.length];
      timeouts.push(window.setTimeout(() => spawn(src), delay));
    }

    const tick = (): void => {
      if (!running) {
        return;
      }

      const now = performance.now();
      const overlay = document.querySelector(`[${AVATAR_ENTER_OVERLAY_ATTR}]`);
      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight / 2;
      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
      }

      for (const flier of fliers) {
        if (flier.done) {
          continue;
        }

        const raw = (now - flier.startTime) / flier.travelMs;
        if (raw >= 1) {
          flier.done = true;
          flier.el.remove();
          continue;
        }

        const progress = easeInOutCubic(raw);
        const x = flier.startX + (targetX - flier.startX) * progress;
        const y = flier.startY + (targetY - flier.startY) * progress;

        let envelope: number;
        if (raw < FADE_IN_FRACTION) {
          envelope = raw / FADE_IN_FRACTION;
        } else if (raw > 1 - FADE_OUT_FRACTION) {
          envelope = (1 - raw) / FADE_OUT_FRACTION;
        } else {
          envelope = 1;
        }

        // Grow to full size on the way in, then shrink as it enters the avatar.
        const scale = raw < FLIER_GROW_PEAK
          ? FLIER_START_SCALE + (1 - FLIER_START_SCALE) * (raw / FLIER_GROW_PEAK)
          : 1 - (1 - FLIER_ENTER_SCALE) * ((raw - FLIER_GROW_PEAK) / (1 - FLIER_GROW_PEAK));
        flier.el.style.transform =
          `translate3d(${x - flier.size / 2}px, ${y - flier.size / 2}px, 0) scale(${scale.toFixed(3)})`;
        flier.el.style.opacity = (Math.max(0, envelope) * flier.peak).toFixed(3);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(rafId);
      timeouts.forEach((handle) => window.clearTimeout(handle));
      for (const flier of fliers) {
        flier.el.remove();
      }
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" style={containerStyle} />;
}

export default AvatarSolutionInflow;
