import type { CSSProperties, ReactNode } from 'react';
import GoldenSplitLayout from './GoldenSplitLayout.js';
import PortraitStage from './PortraitStage.js';

interface GameLayoutProps {
  top: ReactNode;
  bottom: ReactNode;
  raiseBottom?: boolean;
}

const layoutStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

export function GameLayout({ top, bottom, raiseBottom = false }: GameLayoutProps) {
  return (
    <PortraitStage>
      <div style={layoutStyle}>
        <GoldenSplitLayout raiseBottom={raiseBottom} top={top} bottom={bottom} />
      </div>
    </PortraitStage>
  );
}

export default GameLayout;
