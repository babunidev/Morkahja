import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  resolveLoadingBackground,
  type LoadingBackground,
} from '../loading/backgroundResolver.js';
import { PROTECTED_BACKGROUND_ATTR } from '../protectedImage.js';
import {
  BackgroundContext,
  useSessionBackground,
} from './backgroundContext.js';

export function BackgroundProvider({
  children,
  now,
}: {
  children: ReactNode;
  now?: Date;
}) {
  const [background] = useState<LoadingBackground>(() =>
    resolveLoadingBackground(now ?? new Date()),
  );

  return (
    <BackgroundContext.Provider value={background}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function PersistentBackground() {
  const background = useSessionBackground();
  const style = useMemo<CSSProperties>(
    () => ({
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'auto',
      backgroundColor: '#090b12',
      backgroundImage: [
        'linear-gradient(180deg, rgba(7, 8, 12, 0.08), rgba(7, 8, 12, 0.58))',
        `url("${background.assetPath}")`,
      ].join(', '),
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }),
    [background.assetPath],
  );

  return (
    <div
      aria-hidden="true"
      {...{ [PROTECTED_BACKGROUND_ATTR]: '' }}
      data-background-season={background.season}
      data-background-time-of-day={background.timeOfDay}
      style={style}
    />
  );
}
