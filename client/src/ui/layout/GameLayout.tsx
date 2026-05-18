import type { CSSProperties, ReactNode } from 'react';
import GoldenSplitLayout from './GoldenSplitLayout.js';
import PortraitStage from './PortraitStage.js';

interface GameLayoutProps {
  top: ReactNode;
  bottom: ReactNode;
}

const GAME_BACKGROUND = '/UI/09_GAME/menuBGgame.webp';

const layoutStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const backgroundStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  backgroundImage: `url(${GAME_BACKGROUND})`,
  backgroundPosition: 'center 50px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  pointerEvents: 'none',
};

const contentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  height: '100%',
};

export function GameLayout({ top, bottom }: GameLayoutProps) {
  return (
    <PortraitStage>
      <div style={layoutStyle}>
        <div aria-hidden="true" style={backgroundStyle} />
        <div style={contentStyle}>
          <GoldenSplitLayout top={top} bottom={bottom} />
        </div>
      </div>
    </PortraitStage>
  );
}

export default GameLayout;
