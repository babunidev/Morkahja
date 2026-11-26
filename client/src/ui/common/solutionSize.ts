import { useEffect } from 'react';
import { FRAME_OUTSET_PX } from '../game/blocks/encounterFrameGeometry.js';
import { PANEL_SIDE_PADDING } from '../game/blocks/decorativeFrameShared.js';
import { PORTRAIT_STAGE_DESIGN_WIDTH, portraitStageFitScale } from '../layout/portraitStageSize.js';
import { useLayoutMode, type LayoutMode } from '../layout/useLayoutMode.js';

/**
 * One size for a solution picture everywhere (Babuni, 2026-11-26): the size it
 * has in the in-game Inventory. There the panel is the encounter art's width
 * (the stage less the frame's outset on both sides) and holds five pictures
 * with the grid's gap and the panel's side padding.
 *
 * Two CSS variables carry it: on the document in real pixels (the main menu,
 * its pickers), and on the game stage in the stage's own design pixels, which
 * the stage then scales like everything else in it.
 */

/** The gap between pictures in the Inventory grid and between equipment slots. */
export const SOLUTION_GAP = 'clamp(2px, 0.5vw, 4px)';

const SIZE_VAR = '--morkahja-solution-size';
const PANEL_WIDTH_VAR = '--morkahja-solution-panel-width';

/** A solution picture's width and height. */
export const SOLUTION_SIZE = `var(${SIZE_VAR}, 64px)`;
/** The width of the Inventory panel that holds five of them. */
export const SOLUTION_PANEL_WIDTH = `var(${PANEL_WIDTH_VAR}, 368px)`;

/** The panel width in stage pixels: the stage is the phone's width, or 390 on desktop. */
function stagePanelWidth(mode: LayoutMode): string {
  return mode === 'mobile-portrait'
    ? `(100vw - ${2 * FRAME_OUTSET_PX}px)`
    : `${PORTRAIT_STAGE_DESIGN_WIDTH - 2 * FRAME_OUTSET_PX}px`;
}

/** The two variables at a given scale (1 inside the stage). */
export function solutionSizeVars(mode: LayoutMode, scale: number): Record<string, string> {
  const panel = stagePanelWidth(mode);
  const size = `calc(${scale} * (${panel} - 2 * ${PANEL_SIDE_PADDING} - 4 * ${SOLUTION_GAP}) / 5)`;
  return {
    [SIZE_VAR]: size,
    // Five pictures plus the panel's own (unscaled) padding and gaps, so a
    // panel outside the stage gets pictures of exactly that size.
    [PANEL_WIDTH_VAR]: `calc(5 * ${size} + 2 * ${PANEL_SIDE_PADDING} + 4 * ${SOLUTION_GAP})`,
  };
}

/** Keeps the document's variables (real pixels) in step with the window. */
export function useDocumentSolutionSize(): void {
  const { mode } = useLayoutMode();
  useEffect(() => {
    const root = document.documentElement;
    const update = (): void => {
      const scale = mode === 'mobile-portrait' ? 1 : portraitStageFitScale(window.innerWidth, window.innerHeight);
      for (const [name, value] of Object.entries(solutionSizeVars(mode, scale))) {
        root.style.setProperty(name, value);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mode]);
}
