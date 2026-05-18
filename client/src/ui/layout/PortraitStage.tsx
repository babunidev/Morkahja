import type { CSSProperties, ReactNode } from 'react';

const stageShellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
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

export function PortraitStage({ children }: { children: ReactNode }) {
  return (
    <main aria-label="Portrait Stage" style={stageShellStyle}>
      <div style={stageStyle}>{children}</div>
    </main>
  );
}

export default PortraitStage;
