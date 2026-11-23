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

/** The side padding between a framed panel's edge and its content (inventory, skillbook, avatar overview). */
export const PANEL_SIDE_PADDING = 'clamp(5px, 1.2vw, 7px)';

/**
 * A divider's bleed from content `inset` px inside the panel's side padding to
 * the frame's inner line, which lies on the panel's edge (Babuni, 2026-11-23:
 * the lines between the parts reach the frame).
 */
export function panelEdgeDividerBleed(inset: number): string {
  return `calc(${PANEL_SIDE_PADDING} + ${inset}px)`;
}
