import type { CSSProperties, ReactNode } from 'react';

import { assetUrl } from '../../../assetUrl.js';
import { fadeTransition } from '../../transitions/fade.js';
import DecorativeEdgeFrame from './DecorativeEdgeFrame.js';

/**
 * The avatar overview in the game (Babuni, 2026-11-23): over the encounter
 * picture like the Inventory, so its equipment slots are the inventory's size.
 * The title plate closes it, like the Inventory's.
 */

const OVERLAY_BACKGROUND = assetUrl('/UI/09_GAME/spellbook_bg.webp');
/** The Inventory and Skillbook panels' layer (SolutionGridOverlay). */
const OVERLAY_Z_INDEX = 26;

const panelStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: OVERLAY_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'rgba(10, 7, 5, 0.94)',
  backgroundImage: `url(${OVERLAY_BACKGROUND})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  overflow: 'hidden',
  transition: fadeTransition,
};

const scrollStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  // The Inventory's side room, so the slots are as wide as its pictures.
  padding: 'clamp(22px, 5vw, 30px) clamp(5px, 1.2vw, 7px) 0',
  boxSizing: 'border-box',
  overflowY: 'auto',
  scrollbarWidth: 'none',
};

const footerWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '0 6px clamp(18px, 4vw, 26px)',
};

const frameLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: OVERLAY_Z_INDEX + 1,
  pointerEvents: 'none',
  transition: fadeTransition,
};

export function AvatarOverviewBlock({
  title,
  visible,
  children,
  footer,
  onClose,
}: {
  title: string;
  visible: boolean;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <aside
        aria-hidden={!visible}
        aria-label="Avatar overview"
        inert={visible ? undefined : true}
        style={{
          ...panelStyle,
          opacity: visible ? 1 : 0,
          visibility: visible ? 'visible' : 'hidden',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <div style={scrollStyle}>{visible ? children : null}</div>
        <div style={footerWrapStyle}>{visible ? footer : null}</div>
      </aside>
      <div
        aria-hidden={!visible}
        style={{ ...frameLayerStyle, opacity: visible ? 1 : 0, visibility: visible ? 'visible' : 'hidden' }}
      >
        <DecorativeEdgeFrame
          onRegionClick={onClose}
          regionButtonLabel="Close the avatar overview"
          regionLabel={title}
          zIndex={1}
        />
      </div>
    </>
  );
}

export default AvatarOverviewBlock;
