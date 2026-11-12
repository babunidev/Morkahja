export type TooltipAnchorX = 'left' | 'center' | 'right';

export interface AnchoredTooltipCoords {
  anchorX: TooltipAnchorX;
  x: number;
  y: number;
}

export function tooltipTransform(anchorX: TooltipAnchorX, gapPx = 12): string {
  const offsetY = `calc(-100% - ${gapPx}px)`;

  if (anchorX === 'left') {
    return `translate(0, ${offsetY})`;
  }

  if (anchorX === 'right') {
    return `translate(-100%, ${offsetY})`;
  }

  return `translate(-50%, ${offsetY})`;
}

/** Pick horizontal anchor from grid column so tooltips stay inside wide overlays. */
export function anchorXForGridColumn(columnIndex: number, columnCount: number): TooltipAnchorX {
  if (columnCount <= 1) {
    return 'center';
  }

  const leftThreshold = Math.floor((columnCount - 1) / 3);
  const rightThreshold = columnCount - 1 - leftThreshold;

  if (columnIndex <= leftThreshold) {
    return 'left';
  }

  if (columnIndex >= rightThreshold) {
    return 'right';
  }

  return 'center';
}

export function anchoredTooltipCoords(
  container: HTMLElement,
  trigger: HTMLElement,
  anchorX: TooltipAnchorX,
): AnchoredTooltipCoords {
  const containerRect = container.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const x = anchorX === 'left'
    ? triggerRect.left - containerRect.left
    : anchorX === 'right'
      ? triggerRect.right - containerRect.left
      : triggerRect.left - containerRect.left + triggerRect.width / 2;
  const y = triggerRect.top - containerRect.top;

  return { anchorX, x, y };
}

export function clampAnchoredTooltipPlacement(
  containerRect: DOMRectReadOnly,
  triggerRect: DOMRectReadOnly,
  tooltipRect: DOMRectReadOnly,
  anchorX: TooltipAnchorX,
  gapPx = 12,
  paddingPx = 8,
): { left: number; top: number } {
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;
  const relLeft = triggerRect.left - containerRect.left;
  const relTop = triggerRect.top - containerRect.top;
  const relBottom = triggerRect.bottom - containerRect.top;
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;

  let left = anchorX === 'left'
    ? relLeft
    : anchorX === 'right'
      ? relLeft + triggerRect.width - tooltipWidth
      : relLeft + triggerRect.width / 2 - tooltipWidth / 2;

  let top = relTop - tooltipHeight - gapPx;

  if (top < paddingPx) {
    top = relBottom + gapPx;
  }

  left = Math.max(paddingPx, Math.min(left, containerWidth - tooltipWidth - paddingPx));
  top = Math.max(paddingPx, Math.min(top, containerHeight - tooltipHeight - paddingPx));

  return { left, top };
}

/** Which corner of the tooltip touches the item. */
export type TooltipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface CornerAnchoredPlacement {
  /** Position of the tooltip relative to the container. */
  left: number;
  top: number;
  corner: TooltipCorner;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Babuni's placement for item tooltips in the encounter picture: the tooltip
 * opens toward the middle of the picture (right of an item on the left, above
 * an item in the lower half, and so on), its nearest corner anchored a short
 * diagonal distance from the item's centre, and it always stays inside the
 * picture, clear of the frame. If the preferred side does not fit, it flips.
 */
export function placeTooltipTowardCenter(
  containerRect: RectLike,
  triggerRect: RectLike,
  tooltipSize: { width: number; height: number },
  { insetPx = 14, cornerOffsetRatio = 0.3 }: { insetPx?: number; cornerOffsetRatio?: number } = {},
): CornerAnchoredPlacement {
  const minX = insetPx;
  const minY = insetPx;
  const maxX = containerRect.width - insetPx;
  const maxY = containerRect.height - insetPx;
  const centerX = triggerRect.left - containerRect.left + triggerRect.width / 2;
  const centerY = triggerRect.top - containerRect.top + triggerRect.height / 2;
  const offset = Math.min(triggerRect.width, triggerRect.height) * cornerOffsetRatio;
  const { width, height } = tooltipSize;

  let goRight = centerX <= containerRect.width / 2;
  let goUp = centerY > containerRect.height / 2;

  const leftFor = (right: boolean): number => (right ? centerX + offset : centerX - offset - width);
  const topFor = (up: boolean): number => (up ? centerY - offset - height : centerY + offset);
  const fitsX = (left: number): boolean => left >= minX && left + width <= maxX;
  const fitsY = (top: number): boolean => top >= minY && top + height <= maxY;

  if (!fitsX(leftFor(goRight)) && fitsX(leftFor(!goRight))) {
    goRight = !goRight;
  }
  if (!fitsY(topFor(goUp)) && fitsY(topFor(!goUp))) {
    goUp = !goUp;
  }

  const clamp = (value: number, low: number, high: number): number => (
    high < low ? low : Math.max(low, Math.min(value, high))
  );
  return {
    left: clamp(leftFor(goRight), minX, maxX - width),
    top: clamp(topFor(goUp), minY, maxY - height),
    corner: `${goUp ? 'bottom' : 'top'}-${goRight ? 'left' : 'right'}` as TooltipCorner,
  };
}
