import { useEffect, useState } from 'react';

export type LayoutMode = 'desktop' | 'mobile-portrait';

const MOBILE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 768px)';
const LAYOUT_MODE_PARAM = 'layoutMode';

function overrideMode(): LayoutMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(LAYOUT_MODE_PARAM);

  return value === 'mobile-portrait' || value === 'desktop'
    ? value
    : null;
}

function resolveMode(): LayoutMode {
  const override = overrideMode();

  if (override) {
    return override;
  }

  if (
    typeof window !== 'undefined'
    && window.matchMedia(MOBILE_PORTRAIT_QUERY).matches
  ) {
    return 'mobile-portrait';
  }

  return 'desktop';
}

export function useLayoutMode(): { mode: LayoutMode } {
  const [mode, setMode] = useState<LayoutMode>(() => resolveMode());

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_PORTRAIT_QUERY);

    function updateMode(): void {
      setMode(resolveMode());
    }

    updateMode();
    mediaQuery.addEventListener('change', updateMode);
    window.addEventListener('resize', updateMode);
    window.addEventListener('orientationchange', updateMode);
    window.addEventListener('popstate', updateMode);

    return () => {
      mediaQuery.removeEventListener('change', updateMode);
      window.removeEventListener('resize', updateMode);
      window.removeEventListener('orientationchange', updateMode);
      window.removeEventListener('popstate', updateMode);
    };
  }, []);

  return { mode };
}

export default useLayoutMode;
