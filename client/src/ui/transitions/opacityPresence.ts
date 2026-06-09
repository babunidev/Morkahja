import { useEffect, useState } from 'react';
import { FADE_DURATION_MS } from './fade.js';

export function useOpacityPresence(active: boolean): {
  mounted: boolean;
  visible: boolean;
} {
  const [mounted, setMounted] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      setVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, FADE_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active]);

  return { mounted, visible };
}
