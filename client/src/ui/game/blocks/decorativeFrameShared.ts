import type { CSSProperties } from 'react';
import { assetUrl } from '../../../assetUrl.js';

export const FRAME_MASK = assetUrl('/UI/09_GAME/im_spacer_line.webp');
export const BAR_THICKNESS_PX = 10;
/**
 * How far the encounter frame sits outside the art square so the bars cover
 * the picture edge as an overlay (instead of sitting flush inside).
 */
export const FRAME_OUTSET_PX = 7;
/** Wider span for zone seams (FATE bar, footer) — not the encounter square frame. */
const HORIZONTAL_BAR_OVERHANG_RATIO = 1.08;
export const HORIZONTAL_BAR_SPAN = `${HORIZONTAL_BAR_OVERHANG_RATIO * 100}%`;
/** Encounter frame bars span the outset frame box (meets at corners). */
export const FRAME_HORIZONTAL_BAR_SPAN = '100%';

/** Sits on the outer top edge of the outset frame. */
export const TOP_BAR_STYLE: CSSProperties = {
  top: 0,
  left: '50%',
  width: FRAME_HORIZONTAL_BAR_SPAN,
  height: BAR_THICKNESS_PX,
  transform: 'translateX(-50%)',
};

/** Sits on the outer bottom edge of the outset frame. */
export const BOTTOM_BAR_STYLE: CSSProperties = {
  bottom: 0,
  left: '50%',
  width: FRAME_HORIZONTAL_BAR_SPAN,
  height: BAR_THICKNESS_PX,
  transform: 'translateX(-50%)',
};

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

/** Vertical side bars run between the top and bottom horizontal bars. */
export function sideBarVerticalSpanPx(
  containerHeight: number,
  topInsetPx = BAR_THICKNESS_PX,
  bottomInsetPx = BAR_THICKNESS_PX,
): number {
  return Math.max(0, containerHeight - topInsetPx - bottomInsetPx);
}
