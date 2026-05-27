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
