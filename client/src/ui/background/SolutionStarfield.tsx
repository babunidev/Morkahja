import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import solutionData from '../../data/game/solutiondata.json';
import { useLayoutMode } from '../layout/useLayoutMode.js';
import { FADE_DURATION_MS } from '../transitions/fade.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

/** How many solution icons twinkle at once. */
const STAR_COUNT = 28;

/** Every star rests fully invisible for this long before fading back in. */
const HOLD_AT_ZERO_MS = 730;

interface SolutionRecord {
  mSolutionIconName?: string;
}

const ICON_NAMES: string[] = Array.from(
  new Set(
    Object.values(solutionData as Record<string, SolutionRecord>)
      .map((record) => record.mSolutionIconName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  ),
);

// Full-viewport shell that centres the play-area stage, mirroring PortraitStage.
const shellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  pointerEvents: 'none',
};

const shellMobileStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1,
  overflow: 'hidden',
  pointerEvents: 'none',
};

// The stage box the icons are confined to: matches PortraitStage's 9 / 16 frame.
const stageStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100vw, calc(100dvh * 9 / 16))',
  height: 'min(100dvh, calc(100vw * 16 / 9))',
  aspectRatio: '9 / 16',
  overflow: 'hidden',
  pointerEvents: 'none',
};

const stageMobileStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  pointerEvents: 'none',
};

const starBaseStyle: CSSProperties = {
  position: 'absolute',
  display: 'block',
  objectFit: 'contain',
  willChange: 'opacity, transform',
  filter:
    'drop-shadow(0 0 6px rgba(255, 221, 150, 0.5)) drop-shadow(0 0 14px rgba(255, 173, 86, 0.24))',
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomIcon(): string {
  if (ICON_NAMES.length === 0) {
    return '';
  }

  return ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)];
}

interface StarState {
  id: number;
  left: number;
  top: number;
  size: number;
  peak: number;
  fadeInMs: number;
  fadeOutMs: number;
  icon: string;
  visible: boolean;
}

function randomPlacement(): Pick<
  StarState,
  'left' | 'top' | 'size' | 'peak' | 'fadeInMs' | 'fadeOutMs' | 'icon'
> {
  return {
    left: randomBetween(1, 95),
    top: randomBetween(1, 93),
    size: randomBetween(32, 76),
    // Subtle presence so the icons read as faint stars, never foreground.
    peak: randomBetween(0.37, 0.81),
    // Snappier fade in, gentle smooth fade out.
    fadeInMs: randomBetween(640, 1040),
    fadeOutMs: randomBetween(1100, 1900),
    icon: randomIcon(),
  };
}

function createStar(id: number): StarState {
  return { id, visible: false, ...randomPlacement() };
}

export function SolutionStarfield({ fadingOut = false }: { fadingOut?: boolean }) {
  const [stars, setStars] = useState<StarState[]>(() =>
    Array.from({ length: STAR_COUNT }, (_, index) => createStar(index)),
  );
  const timersRef = useRef<Map<number, number>>(new Map());
  const hasIcons = useMemo(() => ICON_NAMES.length > 0, []);
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';

  useEffect(() => {
    if (!hasIcons) {
      return undefined;
    }

    const timers = timersRef.current;

    const schedule = (id: number, delayMs: number, run: () => void): void => {
      const handle = window.setTimeout(run, delayMs);
      timers.set(id, handle);
    };

    const appear = (id: number): void => {
      const placement = randomPlacement();
      // Re-seed position/icon while the star is still invisible, then fade in.
      setStars((current) =>
        current.map((star) =>
          star.id === id ? { ...star, ...placement, visible: true } : star,
        ),
      );
      const lingerMs = randomBetween(1500, 3200);
      schedule(id, placement.fadeInMs + lingerMs, () => disappear(id, placement.fadeOutMs));
    };

    const disappear = (id: number, fadeOutMs: number): void => {
      setStars((current) =>
        current.map((star) => (star.id === id ? { ...star, visible: false } : star)),
      );
      // Wait for the fade-out to finish, then rest at 0 opacity for 0.73s.
      schedule(id, fadeOutMs + HOLD_AT_ZERO_MS, () => appear(id));
    };

    // All stars begin fully invisible; they hold at 0 for at least 0.73s, with a
    // little extra random spread so they do not all light up in unison.
    for (let id = 0; id < STAR_COUNT; id += 1) {
      schedule(id, HOLD_AT_ZERO_MS + randomBetween(0, 1400), () => appear(id));
    }

    return () => {
      timers.forEach((handle) => window.clearTimeout(handle));
      timers.clear();
    };
  }, [hasIcons]);

  if (!hasIcons) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        ...(mobilePortrait ? shellMobileStyle : shellStyle),
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
      }}
    >
      <div style={mobilePortrait ? stageMobileStyle : stageStyle}>
        {stars.map((star) => (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            key={star.id}
            src={`${SOLUTION_IMAGE_ROOT}/${star.icon}.webp`}
            style={{
              ...starBaseStyle,
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              opacity: star.visible ? star.peak : 0,
              transform: star.visible ? 'scale(1)' : 'scale(0.9)',
              transition: `opacity ${star.visible ? star.fadeInMs : star.fadeOutMs}ms ease-in-out, transform ${star.visible ? star.fadeInMs : star.fadeOutMs}ms ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default SolutionStarfield;
