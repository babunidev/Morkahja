import type { CSSProperties } from 'react';
import { randomRingDashArray, seedFromText } from '../game/blocks/encounterFrameGeometry.js';
import { FRAME_LINE_COLOR } from './LineFrame.js';
import {
  ELEMENT_COLORS,
  solutionArtRadius,
  solutionFrameLookForIcon,
  solutionFrameUnit as unitFor,
} from './solutionFrameIndex.js';
import {
  solutionIconNameFromSrc,
  solutionPictureZoom,
  type SolutionElement,
  type SolutionFrameTier,
} from './solutionFrameLook.js';

/**
 * The drawing of a solution picture's frame (SolutionFrame.tsx), as SVG markup,
 * and the same framed picture for plain-DOM code.
 */

export const ORNAMENT_GOLD = '#ffcc66';
export const PLATE_FILL = '#1c0b06';

export function frameRound(value: number): number {
  return Math.round(value * 100) / 100;
}

function polar(c: number, radius: number, degrees: number): [number, number] {
  const angle = (degrees * Math.PI) / 180;
  return [frameRound(c + radius * Math.cos(angle)), frameRound(c + radius * Math.sin(angle))];
}

/** An arc from `from`° to `to`° (clockwise, 0° = right). */
function arcPath(c: number, radius: number, from: number, to: number): string {
  const [x1, y1] = polar(c, radius, from);
  const [x2, y2] = polar(c, radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${frameRound(radius)} ${frameRound(radius)} 0 ${large} 1 ${x2} ${y2}`;
}

/** An SVG element as markup; attributes in SVG spelling, undefined ones left out. */
function el(tag: string, attributes: Record<string, string | number | undefined>, inner = ''): string {
  const attrs = Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/** Element symbols in a -1…1 box, upright. */
const ELEMENT_SYMBOLS: Readonly<Record<SolutionElement, { d: string; stroke?: boolean }>> = {
  // A flame with a curled tip.
  fire: { d: 'M0.05 -1 C0.55 -0.45 0.8 -0.05 0.62 0.45 C0.5 0.8 0.25 1 0 1 C-0.3 1 -0.6 0.78 -0.66 0.4 C-0.72 0 -0.45 -0.2 -0.3 -0.55 C-0.2 -0.25 -0.05 -0.15 0.05 -0.35 C0.15 -0.55 0.1 -0.8 0.05 -1 Z' },
  // A drop.
  water: { d: 'M0 -1 C0.3 -0.55 0.7 -0.1 0.7 0.32 A0.7 0.7 0 0 1 -0.7 0.32 C-0.7 -0.1 -0.3 -0.55 0 -1 Z' },
  // Three wind strokes, two of them curling.
  air: {
    d: 'M-0.85 -0.38 H0.3 A0.3 0.3 0 1 0 0.02 -0.78 M-0.95 0.04 H0.7 M-0.8 0.46 H0.22 A0.28 0.28 0 1 1 -0.04 0.86',
    stroke: true,
  },
  // A mountain with a second peak.
  earth: { d: 'M-0.95 0.72 L-0.28 -0.42 L0.02 0.06 L0.36 -0.82 L0.98 0.72 Z' },
};

/** The four corner pieces of an essence's frame and the element plates in them. */
function essenceCorners(size: number, unit: number, element: SolutionElement | null): string {
  const c = size / 2;
  const R = size / 2;
  const h = R - unit; // half side of the square the corners belong to
  const cut = 0.34 * R; // legs of the 45° corner cut
  const arm = 0.2 * R; // how far each piece runs along the sides
  const plate = 0.2 * R; // half diagonal of the element plate
  const inner = 2.6 * unit; // offset of the second, thinner piece
  const innerCut = cut - inner * (2 - Math.SQRT2);
  const color = element ? ELEMENT_COLORS[element] : ORNAMENT_GOLD;
  const symbol = element ? ELEMENT_SYMBOLS[element] : null;

  // One corner (bottom right, in coordinates around the centre), turned for the others.
  const piece = (half: number, legs: number, length: number) => {
    const points: Array<[number, number]> = [
      [half, half - legs - length],
      [half, half - legs],
      [half - legs, half],
      [half - legs - length, half],
    ];
    return `M ${points.map(([x, y]) => `${frameRound(x)} ${frameRound(y)}`).join(' L ')}`;
  };
  const plateCenter = h - cut / 2;
  const diamond = `M ${frameRound(plateCenter)} ${frameRound(plateCenter - plate)} L ${frameRound(plateCenter + plate)} ${frameRound(plateCenter)} L ${frameRound(plateCenter)} ${frameRound(plateCenter + plate)} L ${frameRound(plateCenter - plate)} ${frameRound(plateCenter)} Z`;
  const symbolScale = plate * 0.56;
  const endDots: Array<[number, number]> = [
    [h, h - cut - arm],
    [h - cut - arm, h],
  ];

  return [0, 90, 180, 270].map((turn) => {
    const parts = [
      el('path', { d: piece(h, cut, arm), fill: 'none', opacity: 0.95, stroke: FRAME_LINE_COLOR, 'stroke-linejoin': 'miter', 'stroke-width': frameRound(1.3 * unit) }),
      el('path', { d: piece(h - inner, innerCut, arm * 0.7), fill: 'none', opacity: 0.7, stroke: FRAME_LINE_COLOR, 'stroke-linejoin': 'miter', 'stroke-width': frameRound(0.7 * unit) }),
      ...endDots.map(([x, y]) => el('rect', {
        fill: FRAME_LINE_COLOR,
        height: frameRound(2.2 * unit),
        transform: `rotate(45 ${frameRound(x)} ${frameRound(y)})`,
        width: frameRound(2.2 * unit),
        x: frameRound(x - 1.1 * unit),
        y: frameRound(y - 1.1 * unit),
      })),
      el('path', { d: diamond, fill: PLATE_FILL, stroke: FRAME_LINE_COLOR, 'stroke-linejoin': 'miter', 'stroke-width': frameRound(1.1 * unit) }),
      // Counter-turned, so every symbol stands upright.
      symbol
        ? el(
          'g',
          { transform: `translate(${frameRound(plateCenter)} ${frameRound(plateCenter)}) rotate(${-turn}) scale(${frameRound(symbolScale)})` },
          el('path', {
            d: symbol.d,
            fill: symbol.stroke ? 'none' : color,
            stroke: symbol.stroke ? color : 'none',
            'stroke-linecap': 'round',
            'stroke-width': symbol.stroke ? 0.26 : 0,
            style: `filter: drop-shadow(0 0 ${frameRound(unit)}px ${color})`,
          }),
        )
        : '',
    ];
    return el('g', { transform: `translate(${frameRound(c)} ${frameRound(c)}) rotate(${turn})` }, parts.join(''));
  }).join('');
}

/** The ornamental ring of a rare item's frame. */
function rareRing(size: number, unit: number): string {
  const c = size / 2;
  const R = size / 2;
  const ring = R + unit;
  const beads = R + 3.2 * unit;
  const sideGap = 9; // degrees kept free around each side's diamond
  const cornerGap = 5; // and around each corner's point
  const arcs: string[] = [];
  for (let side = 0; side < 4; side += 1) {
    const start = side * 90;
    arcs.push(arcPath(c, ring, start + sideGap, start + 45 - cornerGap));
    arcs.push(arcPath(c, ring, start + 45 + cornerGap, start + 90 - sideGap));
  }
  const stud = 3.1 * unit;
  const parts = [
    el('path', { d: arcs.join(' '), fill: 'none', opacity: 0.95, stroke: ORNAMENT_GOLD, 'stroke-linecap': 'round', 'stroke-width': frameRound(1.1 * unit) }),
    el('circle', {
      cx: frameRound(c),
      cy: frameRound(c),
      fill: 'none',
      opacity: 0.75,
      pathLength: 100,
      r: frameRound(beads),
      stroke: ORNAMENT_GOLD,
      'stroke-dasharray': '0.001 1.25',
      'stroke-linecap': 'round',
      'stroke-width': frameRound(1.25 * unit),
    }),
    ...[0, 90, 180, 270].map((angle) => {
      const [x, y] = polar(c, ring, angle);
      return el(
        'g',
        { transform: `rotate(${angle + 45} ${x} ${y})` },
        el('rect', { fill: ORNAMENT_GOLD, height: frameRound(2 * stud), width: frameRound(2 * stud), x: frameRound(x - stud), y: frameRound(y - stud) })
          + el('rect', { fill: PLATE_FILL, height: frameRound(stud), width: frameRound(stud), x: frameRound(x - stud / 2), y: frameRound(y - stud / 2) }),
      );
    }),
    ...[45, 135, 225, 315].map((angle) => {
      // A point facing outward, its sides at 45° like the frame's corners.
      const base = ring - 0.5 * unit;
      const tip = R + 6 * unit;
      const [lx, ly] = polar(c, base, angle - cornerGap);
      const [rx, ry] = polar(c, base, angle + cornerGap);
      const [tx, ty] = polar(c, tip, angle);
      const [ix, iy] = polar(c, R - 0.5 * unit, angle);
      return el('path', { d: `M ${lx} ${ly} L ${tx} ${ty} L ${rx} ${ry} L ${ix} ${iy} Z`, fill: ORNAMENT_GOLD, opacity: 0.95 });
    }),
  ];
  return parts.join('');
}

/**
 * The frame's SVG content for a box `size` px wide, as markup: one drawing for
 * the React pictures and for the plain-DOM ones in flight.
 */
export function solutionFrameSvgMarkup(size: number, tier: SolutionFrameTier, element: SolutionElement | null, seed: number): string {
  const unit = unitFor(size);
  const c = size / 2;
  const art = solutionArtRadius(size);
  const lines = [
    { radius: art + 0.6 * unit, width: 2 * unit, opacity: 0.95, gapped: false },
    { radius: art + 3.6 * unit, width: 1.5 * unit, opacity: 0.85, gapped: true },
    { radius: art + 6 * unit, width: 0.8 * unit, opacity: 0.75, gapped: false },
  ];
  const rings = lines.map((line) => el('circle', {
    cx: frameRound(c),
    cy: frameRound(c),
    fill: 'none',
    opacity: line.opacity,
    pathLength: line.gapped ? 100 : undefined,
    r: frameRound(line.radius),
    stroke: FRAME_LINE_COLOR,
    'stroke-dasharray': line.gapped ? randomRingDashArray(seed).join(' ') : undefined,
    'stroke-width': frameRound(line.width),
  })).join('');
  const extra = tier === 'essence' ? essenceCorners(size, unit, element) : tier === 'rare' ? rareRing(size, unit) : '';
  return rings + extra;
}

/** The frame SVG's own style: over the whole box, its ornaments may reach past it. */
export function solutionFrameSvgStyle(size: number): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: `drop-shadow(0 0 ${frameRound(1.5 * unitFor(size))}px rgba(0, 0, 0, 0.85))`,
  };
}

/**
 * A solution picture for plain-DOM code (pictures in flight, the avatar's
 * inflow): the picture clipped round with the frame on top, as one element.
 * `image` is the <img> to wait for. Anything that is not a solution picture
 * comes back as a plain <img>, both `root` and `image`.
 */
export function createSolutionPictureElement(src: string, size: number): { root: HTMLElement; image: HTMLImageElement } {
  const image = document.createElement('img');
  image.src = src;
  image.alt = '';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  const iconName = solutionIconNameFromSrc(src);
  if (!iconName || !(size > 0)) {
    return { root: image, image };
  }
  const look = solutionFrameLookForIcon(iconName);
  const zoom = solutionPictureZoom(iconName);
  const inset = frameRound(size / 2 - solutionArtRadius(size));

  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.style.width = `${size}px`;
  root.style.height = `${size}px`;

  const clip = document.createElement('div');
  Object.assign(clip.style, {
    position: 'absolute',
    left: `${inset}px`,
    top: `${inset}px`,
    width: `${frameRound(size - 2 * inset)}px`,
    height: `${frameRound(size - 2 * inset)}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  Object.assign(image.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    transform: zoom !== 1 ? `scale(${zoom})` : '',
  });
  clip.append(image);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('viewBox', `0 0 ${frameRound(size)} ${frameRound(size)}`);
  const svgStyle = solutionFrameSvgStyle(size);
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: String(svgStyle.filter),
  });
  svg.innerHTML = solutionFrameSvgMarkup(size, look.tier, look.element, seedFromText(iconName));

  root.append(clip, svg);
  return { root, image };
}
