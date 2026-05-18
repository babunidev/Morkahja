import { createContext, useContext } from 'react';
import type { LoadingBackground } from '../loading/backgroundResolver.js';

export const BackgroundContext = createContext<LoadingBackground | null>(null);

export function useSessionBackground(): LoadingBackground {
  const background = useContext(BackgroundContext);

  if (!background) {
    throw new Error('useSessionBackground must be used inside BackgroundProvider');
  }

  return background;
}
