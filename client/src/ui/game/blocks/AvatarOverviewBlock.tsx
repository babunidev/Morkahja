import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { GAME_PANEL_BACKGROUND } from './gamePanelBackground.js';

import { fadeTransition } from '../../transitions/fade.js';
import DecorativeEdgeFrame from './DecorativeEdgeFrame.js';
import { PANEL_SIDE_PADDING } from './decorativeFrameShared.js';

/**
 * The avatar overview in the game (Babuni, 2026-11-23): over the encounter
 * picture like the Inventory, so its equipment slots are the inventory's size.
 * The title plate closes it, like the Inventory's.
 */

/** The Inventory and Skillbook panels' layer (SolutionGridOverlay). */
const OVERLAY_Z_INDEX = 26;

const panelStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: OVERLAY_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: GAME_PANEL_BACKGROUND,
  overflow: 'hidden',
  transition: fadeTransition,
};

const scrollStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  // The Inventory's side room, so the slots are as wide as its pictures.
  padding: `clamp(22px, 5vw, 30px) ${PANEL_SIDE_PADDING} 0`,
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
  const asideRef = useRef<HTMLElement | null>(null);
  // A tap anywhere else closes it (Babuni, 2026-11-23: no back button). The
  // avatar itself toggles it, so a tap there is left to the avatar.
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && asideRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest('[data-morkahja-avatar-portrait]')) {
        return;
      }
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [visible, onClose]);

  return (
    <>
      <aside
        ref={asideRef}
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
