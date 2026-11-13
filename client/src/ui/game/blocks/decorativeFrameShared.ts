import type { CSSProperties } from 'react';

/** Centers overlay controls on the framed bottom edge. */
export const BOTTOM_EDGE_ANCHOR_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 0,
  transform: 'translate(-50%, 50%)',
};

/** Slight upward nudge for the result bar relative to the bottom edge anchor. */
export const RESULT_BOTTOM_EDGE_NUDGE_PX = 8;

export function bottomEdgeAnchorStyle(nudgePx = 0): CSSProperties {
  if (nudgePx === 0) {
    return BOTTOM_EDGE_ANCHOR_STYLE;
  }

  return {
    ...BOTTOM_EDGE_ANCHOR_STYLE,
    transform: `translate(-50%, calc(50% - ${nudgePx}px))`,
  };
}

export const overlayPanelTitleStyle: CSSProperties = {
  margin: 0,
  padding: 'clamp(18px, 5vh, 36px) 18px 0',
  fontSize: 'clamp(1.5rem, 6.6vw, 2.4rem)',
  textAlign: 'center',
  flexShrink: 0,
};
