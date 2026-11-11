import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useLayoutMode } from './useLayoutMode.js';
import {
  PORTRAIT_STAGE_DESIGN_HEIGHT,
  PORTRAIT_STAGE_DESIGN_WIDTH,
  portraitStageFitScale,
} from './portraitStageSize.js';

const stageShellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  // Desktop: do not clip fly-ins / solution reveal that extend past the column.
  overflow: 'visible',
  pointerEvents: 'none',
};

const stageShellMobileStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const stageMobileStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'visible',
  color: '#f7efe0',
  pointerEvents: 'auto',
};

/**
 * Centers a fixed 9:16 playfield and scales it uniformly to fit the window.
 * Desktop keeps overflow visible so ornaments/animations can spill into the
 * letterbox; mobile portrait still clips to the screen.
 */
export function PortraitStage({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';
  const shellRef = useRef<HTMLElement | null>(null);
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

  if (mobilePortrait) {
    return (
      <main
        aria-label="Portrait Stage"
        ref={shellRef}
        style={stageShellMobileStyle}
      >
        <div style={stageMobileStyle}>{children}</div>
      </main>
    );
  }

  return (
    <main
      aria-label="Portrait Stage"
      ref={shellRef}
      style={stageShellStyle}
    >
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
          pointerEvents: 'auto',
          color: '#f7efe0',
        }}
      >
        {children}
      </div>
    </main>
  );
}

export default PortraitStage;
