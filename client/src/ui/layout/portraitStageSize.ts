/** Logical playfield size — always 9:16. The stage is laid out at this size, then scaled to fit. */
export const PORTRAIT_STAGE_DESIGN_WIDTH = 390;
export const PORTRAIT_STAGE_DESIGN_HEIGHT = Math.round(
  (PORTRAIT_STAGE_DESIGN_WIDTH * 16) / 9,
);

export function portraitStageFitScale(
  availableWidth: number,
  availableHeight: number,
): number {
  if (availableWidth <= 0 || availableHeight <= 0) {
    return 1;
  }

  return Math.min(
    availableWidth / PORTRAIT_STAGE_DESIGN_WIDTH,
    availableHeight / PORTRAIT_STAGE_DESIGN_HEIGHT,
  );
}
