import type { CSSProperties, ReactNode } from 'react';
import PortraitStage from './PortraitStage.js';
import {
  actionMenuZoneStyle,
  encounterZoneStyle,
  gameScreenRootStyle,
  partyZoneStyle,
} from '../game/gameScreenLayout.js';

interface GameLayoutProps {
  encounterZone: ReactNode;
  partyZone: ReactNode;
  actionMenuZone: ReactNode;
}

const shellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'visible',
};

export function GameLayout({
  encounterZone,
  partyZone,
  actionMenuZone,
}: GameLayoutProps) {
  return (
    <PortraitStage>
      <div style={shellStyle}>
        <div style={gameScreenRootStyle()}>
          <section aria-label="Encounter Zone" style={encounterZoneStyle()}>
            {encounterZone}
          </section>
          <section aria-label="Party Zone" style={partyZoneStyle()}>
            {partyZone}
          </section>
          <section aria-label="Action Menu" style={actionMenuZoneStyle()}>
            {actionMenuZone}
          </section>
        </div>
      </div>
    </PortraitStage>
  );
}

export default GameLayout;
