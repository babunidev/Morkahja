import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { gameSolutions } from '../../data/gameContent.js';
import { useLayoutMode } from '../layout/useLayoutMode.js';
import {
  PORTRAIT_STAGE_DESIGN_HEIGHT,
  PORTRAIT_STAGE_DESIGN_WIDTH,
  portraitStageFitScale,
} from '../layout/portraitStageSize.js';
import { FADE_DURATION_MS } from '../transitions/fade.js';
import { assetUrl } from '../../assetUrl.js';

const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');

/** How many solution icons twinkle at once. */
const STAR_COUNT = 28;

/** Every star rests fully invisible for this long before fading back in. */
const HOLD_AT_ZERO_MS = 730;

interface SolutionRecord {
  mSolutionIconName?: string;
}

let iconNamesCache: { source: Record<string, unknown>; names: string[] } | null = null;

/** Distinct solution icon names, recomputed only when the content changes. */
function iconNames(): string[] {
  const source = gameSolutions();
  if (iconNamesCache?.source !== source) {
    const names = Object.values(source as Record<string, SolutionRecord>)
      .map((record) => record.mSolutionIconName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    iconNamesCache = { source, names: Array.from(new Set(names)) };
  }
  return iconNamesCache.names;
}

const shellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1,
  overflow: 'visible',
  pointerEvents: 'none',
};

const shellMobileStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1,
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
  const names = iconNames();
  if (names.length === 0) {
    return '';
  }

  return names[Math.floor(Math.random() * names.length)];
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
    peak: randomBetween(0.37, 0.81),
    fadeInMs: randomBetween(640, 1040),
    fadeOutMs: randomBetween(1100, 1900),
    icon: randomIcon(),
  };
}

function createStar(id: number): StarState {
  return { id, visible: false, ...randomPlacement() };
}

function renderStars(stars: StarState[]) {
  return stars.map((star) => (
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
  ));
}

export function SolutionStarfield({ fadingOut = false }: { fadingOut?: boolean }) {
  const [stars, setStars] = useState<StarState[]>(() =>
    Array.from({ length: STAR_COUNT }, (_, index) => createStar(index)),
  );
  const timersRef = useRef<Map<number, number>>(new Map());
  const hasIcons = useMemo(() => iconNames().length > 0, []);
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (mobilePortrait) {
      return undefined;
    }

    const shell = shellRef.current;
    if (!shell) {
      return undefined;
    }

    const updateScale = (): void => {
      setScale(portraitStageFitScale(shell.clientWidth, shell.clientHeight));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [mobilePortrait]);

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
      schedule(id, fadeOutMs + HOLD_AT_ZERO_MS, () => appear(id));
    };

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
      ref={shellRef}
      style={{
        ...(mobilePortrait ? shellMobileStyle : shellStyle),
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
      }}
    >
      {mobilePortrait ? (
        <div style={stageMobileStyle}>{renderStars(stars)}</div>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: PORTRAIT_STAGE_DESIGN_WIDTH,
            height: PORTRAIT_STAGE_DESIGN_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {renderStars(stars)}
        </div>
      )}
    </div>
  );
}

export default SolutionStarfield;
