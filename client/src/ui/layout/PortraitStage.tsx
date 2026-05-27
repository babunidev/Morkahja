import type { CSSProperties, ReactNode } from 'react';
import { useLayoutMode } from './useLayoutMode.js';

const stageShellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  pointerEvents: 'none',
};

const stageShellMobileStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const stageStyle: CSSProperties = {
  width: 'min(100vw, calc(100dvh * 9 / 16))',
  height: 'min(100dvh, calc(100vw * 16 / 9))',
  aspectRatio: '9 / 16',
  overflow: 'hidden',
  color: '#f7efe0',
  pointerEvents: 'auto',
};

const stageMobileStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  color: '#f7efe0',
  pointerEvents: 'auto',
};

export function PortraitStage({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  const mobilePortrait = mode === 'mobile-portrait';

  return (
    <main
      aria-label="Portrait Stage"
      style={mobilePortrait ? stageShellMobileStyle : stageShellStyle}
    >
      <div style={mobilePortrait ? stageMobileStyle : stageStyle}>{children}</div>
    </main>
  );
}

export default PortraitStage;
