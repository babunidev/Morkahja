import type { CSSProperties, ReactNode } from 'react';

interface GoldenSplitLayoutProps {
  top: ReactNode;
  bottom: ReactNode;
}

const layoutStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const topStyle: CSSProperties = {
  flex: '0 0 61.8%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'visible',
  position: 'relative',
  zIndex: 2,
};

const bottomStyle: CSSProperties = {
  flex: '0 0 38.2%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 1,
};

export function GoldenSplitLayout({ top, bottom }: GoldenSplitLayoutProps) {
  return (
    <div style={layoutStyle}>
      <section aria-label="Encounter Zone" style={topStyle}>{top}</section>
      <section aria-label="Player Hub" style={bottomStyle}>{bottom}</section>
    </div>
  );
}

export default GoldenSplitLayout;
