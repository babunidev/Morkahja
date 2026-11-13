import type { CSSProperties } from 'react';

/**
 * Tunable layout for the three game screen zones (design-canvas px for the
 * fixed 9:16 PortraitStage). Outer transform scales as one unit — avoid vw/vh.
 */
export const GAME_SCREEN_LAYOUT = {
  encounterRowFr: 58,
  partyRowFr: 30,
  actionMenuRowFr: 12,
  encounterPaddingTop: 28,
  partyZonePaddingTop: 12,
  partyCenterAvatarLiftPx: -6,
  partySlotGap: 10,
  actionMenuGap: 18,
  actionMenuPadding: '6px 18px',
  /** Keep footer near the window bottom so it clears the avatar. */
  actionMenuZonePaddingBottom: 8,
  actionMenuButtonMaxWidthPx: 72,
} as const;

export function gameScreenRootStyle(): CSSProperties {
  const { encounterRowFr, partyRowFr, actionMenuRowFr } = GAME_SCREEN_LAYOUT;

  return {
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateRows: `minmax(0, ${encounterRowFr}fr) minmax(0, ${partyRowFr}fr) minmax(0, ${actionMenuRowFr}fr)`,
    // One column, never wider than the stage. Without it the column grew to the
    // party strip's width (3 x 148 px + gaps), which pushed the whole screen off
    // centre: left-anchored and cut off on phones, 37 px right of centre on desktop.
    gridTemplateColumns: 'minmax(0, 1fr)',
    overflow: 'visible',
    minHeight: 0,
  };
}

export function encounterZoneStyle(): CSSProperties {
  return {
    gridRow: '1',
    position: 'relative',
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
    zIndex: 5,
  };
}

export function encounterZoneContentStyle(): CSSProperties {
  return {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: GAME_SCREEN_LAYOUT.encounterPaddingTop,
    boxSizing: 'border-box',
  };
}

export function partyZoneStyle(): CSSProperties {
  return {
    gridRow: '2',
    position: 'relative',
    minHeight: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 6,
    pointerEvents: 'none',
    paddingTop: GAME_SCREEN_LAYOUT.partyZonePaddingTop,
    boxSizing: 'border-box',
  };
}

export function partyStripStyle(): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: GAME_SCREEN_LAYOUT.partySlotGap,
    overflow: 'visible',
    pointerEvents: 'auto',
  };
}

export function actionMenuZoneStyle(): CSSProperties {
  return {
    gridRow: '3',
    position: 'relative',
    minHeight: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 8,
    paddingBottom: GAME_SCREEN_LAYOUT.actionMenuZonePaddingBottom,
    boxSizing: 'border-box',
  };
}

export function actionMenuRowStyle(): CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: GAME_SCREEN_LAYOUT.actionMenuGap,
    padding: GAME_SCREEN_LAYOUT.actionMenuPadding,
    boxSizing: 'border-box',
    // Never wider than the screen; on narrow phones the buttons shrink instead.
    width: '100%',
    maxWidth: 4 * GAME_SCREEN_LAYOUT.actionMenuButtonMaxWidthPx + 3 * GAME_SCREEN_LAYOUT.actionMenuGap + 36,
  };
}
