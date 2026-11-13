import type { CSSProperties } from 'react';
import { cornerLegAt, cornerTrianglesPath } from '../game/blocks/encounterFrameGeometry.js';

/**
 * The simple frame (Babuni's direction, 2026-11-13) for buttons, fields,
 * cards, badges and bars inside panels: the frame's solid line with one gapped
 * line around it, no rounded corners, cut corners with small triangles.
 *
 * Drawn as a nine-slice SVG border image (with its background baked in), so an
 * element only needs a style change: no extra child, no measuring, and a hover
 * glow (CSS drop-shadow) follows the cut shape.
 */

export const SIMPLE_FRAME_COLOR = '#d8b06a';

/** The SVG is IMAGE × IMAGE units; SLICE units at each edge are corners. */
const IMAGE = 100;
const SLICE = 10;
/** The framed area sits this far inside the edge. */
const INSET = 4;
const CUT = 5;
const SOLID_OFFSET = 0.5;
const GAPPED_OFFSET = 3.5;
const LINE_WIDTH = 1;
/** Dashes and gaps along one edge tile (the middle IMAGE − 2·SLICE units), repeated by the browser. */
export const SIMPLE_FRAME_EDGE_PATTERN = [24, 3, 17, 2.5, 30, 3.5] as const;

const round = (value: number): number => Math.round(value * 100) / 100;

function octagonPoints(offset: number): Array<[number, number]> {
  const lo = INSET - offset;
  const hi = IMAGE - INSET + offset;
  const leg = cornerLegAt(offset, CUT);
  return [
    [lo + leg, lo], [hi - leg, lo], [hi, lo + leg], [hi, hi - leg],
    [hi - leg, hi], [lo + leg, hi], [lo, hi - leg], [lo, lo + leg],
  ];
}

const pathOf = (points: Array<[number, number]>, close: boolean): string =>
  `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')}${close ? ' Z' : ''}`;

/** The gapped line: solid across the corners, dashed along the repeated edge tiles. */
function gappedPath(): string {
  const p = octagonPoints(GAPPED_OFFSET);
  const parts: string[] = [];
  // Corner diagonals.
  for (const [a, b] of [[1, 2], [3, 4], [5, 6], [7, 0]] as const) {
    parts.push(pathOf([p[a]!, p[b]!], false));
  }
  // Each straight edge: solid from the corner to the slice, dashes in the tile, solid again.
  const edges: Array<{ from: [number, number]; to: [number, number] }> = [
    { from: p[0]!, to: p[1]! }, { from: p[2]!, to: p[3]! }, { from: p[4]!, to: p[5]! }, { from: p[6]!, to: p[7]! },
  ];
  for (const { from, to } of edges) {
    const horizontal = from[1] === to[1];
    const sign = (horizontal ? to[0] - from[0] : to[1] - from[1]) > 0 ? 1 : -1;
    const fixed = horizontal ? from[1] : from[0];
    const at = (t: number): [number, number] => (horizontal ? [t, fixed] : [fixed, t]);
    const start = horizontal ? from[0] : from[1];
    const end = horizontal ? to[0] : to[1];
    const tileStart = sign > 0 ? SLICE : IMAGE - SLICE;
    const tileEnd = sign > 0 ? IMAGE - SLICE : SLICE;
    parts.push(pathOf([at(start), at(tileStart)], false));
    let t = tileStart;
    SIMPLE_FRAME_EDGE_PATTERN.forEach((length, index) => {
      const next = t + sign * length;
      if (index % 2 === 0) {
        parts.push(pathOf([at(t), at(next)], false));
      }
      t = next;
    });
    parts.push(pathOf([at(tileEnd), at(end)], false));
  }
  return parts.join(' ');
}

const imageCache = new Map<string, string>();

/** The border image for a simple frame in `color`, with `background` filling the cut shape. */
export function simpleFrameImage(color = SIMPLE_FRAME_COLOR, opacity = 0.9, background = 'none'): string {
  const key = `${color}|${opacity}|${background}`;
  const cached = imageCache.get(key);
  if (cached) {
    return cached;
  }
  const fillOffset = GAPPED_OFFSET + LINE_WIDTH / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${IMAGE} ${IMAGE}" width="${IMAGE}" height="${IMAGE}">`
    + (background !== 'none' ? `<path d="${pathOf(octagonPoints(fillOffset), true)}" fill="${background}"/>` : '')
    + `<g opacity="${opacity}">`
    + `<path d="${cornerTrianglesPath(IMAGE - 2 * INSET, IMAGE - 2 * INSET, INSET, CUT)}" fill="${color}"/>`
    + `<path d="${pathOf(octagonPoints(SOLID_OFFSET), true)}" fill="none" stroke="${color}" stroke-width="${LINE_WIDTH}" stroke-linejoin="miter"/>`
    + `<path d="${gappedPath()}" fill="none" stroke="${color}" stroke-width="${LINE_WIDTH}" stroke-linecap="butt"/>`
    + '</g></svg>';
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  imageCache.set(key, url);
  return url;
}

/**
 * Style for an element framed by the simple frame. Replaces its border,
 * rounded corners and background (`background` must be a plain colour).
 * `scale` shrinks the frame for small things such as bars and badges.
 */
export function simpleFrameStyle({
  background,
  color = SIMPLE_FRAME_COLOR,
  opacity = 0.9,
  scale = 1,
}: {
  background?: string;
  color?: string;
  opacity?: number;
  scale?: number;
} = {}): CSSProperties {
  return {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 0,
    borderImageSource: simpleFrameImage(color, opacity, background ?? 'none'),
    borderImageSlice: `${SLICE} fill`,
    borderImageWidth: `${round(SLICE * scale)}px`,
    borderImageRepeat: 'round',
    background: 'none',
  };
}

/** Only the border image of a simple frame, for a variant that changes its colour. */
export function simpleFrameVariant(options: Parameters<typeof simpleFrameStyle>[0]): CSSProperties {
  const { borderImageSource } = simpleFrameStyle(options);
  return { borderImageSource };
}

/** Clip path cutting an element (an image, a bar fill) to the simple frame's corners at `scale`. */
export function simpleFrameClipPath(scale = 1, insetLeg?: number): string {
  const leg = round(insetLeg ?? (cornerLegAt(GAPPED_OFFSET, CUT) + INSET - GAPPED_OFFSET) * scale);
  const l = `${leg}px`;
  const r = `calc(100% - ${leg}px)`;
  return `polygon(${l} 0, ${r} 0, 100% ${l}, 100% ${r}, ${r} 100%, ${l} 100%, 0 ${r}, 0 ${l})`;
}

/** Divider: ends (with the triangles) are END units wide; the middle tile repeats. */
const DIVIDER_END = 6;
const DIVIDER_TILE = 60;
const DIVIDER_HEIGHT = 7;
export const DIVIDER_PATTERN = [18, 2.5, 27, 2, 8.5, 2] as const;

const dividerCache = new Map<string, string>();

function dividerImage(color: string, opacity: number): string {
  const key = `${color}|${opacity}`;
  const cached = dividerCache.get(key);
  if (cached) {
    return cached;
  }
  const width = 2 * DIVIDER_END + DIVIDER_TILE;
  const solidY = 1.5;
  const gappedY = 4.5;
  const dashes: string[] = [];
  let x = DIVIDER_END;
  DIVIDER_PATTERN.forEach((length, index) => {
    if (index % 2 === 0) {
      dashes.push(`M ${x} ${gappedY} L ${x + length} ${gappedY}`);
    }
    x += length;
  });
  const h = DIVIDER_HEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="${width}" height="${h}">`
    + `<g opacity="${opacity}" fill="${color}" stroke="${color}" stroke-width="1">`
    // Triangles joining the divider to the frame line at both ends.
    + `<path stroke="none" d="M 0 0 L ${DIVIDER_END} ${h / 2} L 0 ${h} Z M ${width} 0 L ${width - DIVIDER_END} ${h / 2} L ${width} ${h} Z"/>`
    + `<path fill="none" d="M 0 ${solidY} L ${width} ${solidY}"/>`
    + `<path fill="none" d="M 0 ${gappedY} L ${DIVIDER_END} ${gappedY} ${dashes.join(' ')} M ${width - DIVIDER_END} ${gappedY} L ${width} ${gappedY}"/>`
    + '</g></svg>';
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  dividerCache.set(key, url);
  return url;
}

/**
 * A divider on an element's top or bottom edge, replacing a plain borderTop or
 * borderBottom: the frame's line plus a gapped line, ending in small triangles.
 * `bleed` extends its ends outward (without moving the content) so they meet
 * the frame's inner line instead of stopping short in a right angle.
 */
export function frameDividerStyle({
  side = 'top',
  bleed = 0,
  color = SIMPLE_FRAME_COLOR,
  opacity = 0.75,
}: { side?: 'top' | 'bottom'; bleed?: number; color?: string; opacity?: number } = {}): CSSProperties {
  const top = side === 'top';
  const h = DIVIDER_HEIGHT;
  const e = DIVIDER_END;
  return {
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderWidth: top ? `${h}px 0 0` : `0 0 ${h}px`,
    borderImageSource: dividerImage(color, opacity),
    borderImageSlice: top ? `${h} ${e} 0 ${e}` : `0 ${e} ${h} ${e}`,
    borderImageWidth: top ? `${h}px ${e}px 0 ${e}px` : `0 ${e}px ${h}px ${e}px`,
    borderImageOutset: `0 ${bleed}px`,
    borderImageRepeat: 'round',
  };
}

/** Bleed that brings a divider to a panel frame's inner line, for content `padding` px inside the panel edge. */
export function panelDividerBleed(padding: number): number {
  return Math.max(0, padding - 9.5);
}
