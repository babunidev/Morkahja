/**
 * Geometry of the encounter frame (Babuni's design, 2026-11-12): thin lines
 * around the picture with cut-off corners. From the picture outward: a 2 px
 * line, a 2 px line with random gaps, a 1 px line, a small gap, and an outer
 * line. Small triangles fill the picture's corners, and every line cuts its
 * corners at the same 45° angle, so the frame reads as an octagon, not a square.
 */

export interface FrameLine {
  /** Distance of the line's centre outside the picture edge, in px. */
  offset: number;
  width: number;
  opacity: number;
  gapped?: boolean;
}

export const FRAME_LINES: readonly FrameLine[] = [
  { offset: 1, width: 2, opacity: 0.95 },
  { offset: 4, width: 2, opacity: 0.85, gapped: true },
  { offset: 6.5, width: 1, opacity: 0.75 },
  { offset: 10.5, width: 1, opacity: 0.6 },
];

/** How far the outermost line reaches outside the picture. */
export const FRAME_OUTSET_PX = 11;

/** Legs of the triangles that fill the picture's corners. */
export const FRAME_CORNER_CUT_PX = 12;

/**
 * One frame style: its lines, how far they reach outside what they frame, the
 * corner triangles' legs, and how long the gapped line's dashes and gaps are
 * (1 = the encounter's).
 */
export interface FrameSpec {
  lines: readonly FrameLine[];
  outset: number;
  cut: number;
  dashScale: number;
}

/** Around the encounter picture. */
export const ENCOUNTER_FRAME: FrameSpec = {
  lines: FRAME_LINES,
  outset: FRAME_OUTSET_PX,
  cut: FRAME_CORNER_CUT_PX,
  dashScale: 1,
};

/**
 * Panels and menus (Babuni's direction, 2026-11-13): the encounter's frame with
 * thinner lines, drawn inside the panel's edge.
 */
export const PANEL_FRAME: FrameSpec = {
  lines: [
    { offset: 0.75, width: 1.5, opacity: 0.95 },
    { offset: 3.25, width: 1.5, opacity: 0.8, gapped: true },
    { offset: 5.5, width: 0.75, opacity: 0.75 },
    { offset: 8.5, width: 0.75, opacity: 0.6 },
  ],
  outset: 9,
  cut: 10,
  dashScale: 0.8,
};

/** Tooltips: the same frame, smaller still. */
export const TOOLTIP_FRAME: FrameSpec = {
  lines: [
    { offset: 0.5, width: 1, opacity: 0.95 },
    { offset: 2.25, width: 1, opacity: 0.8, gapped: true },
    { offset: 3.9, width: 0.6, opacity: 0.75 },
    { offset: 6, width: 0.75, opacity: 0.6 },
  ],
  outset: 6.5,
  cut: 7,
  dashScale: 0.55,
};

const SQRT2 = Math.SQRT2;

/**
 * Corner leg of a line `offset` px outside the picture: parallel to the corner
 * triangles' long side, so all lines cut their corners at one angle.
 */
export function cornerLegAt(offset: number, cut = FRAME_CORNER_CUT_PX): number {
  return Math.max(0, cut + offset * (2 - SQRT2));
}

/**
 * Closed octagon path for a line `offset` px outside a picture of `width` ×
 * `height`, in coordinates where the picture's top-left corner is at
 * (`origin`, `origin`).
 */
export function octagonPath(width: number, height: number, offset: number, origin: number, cut = FRAME_CORNER_CUT_PX): string {
  const left = origin - offset;
  const top = origin - offset;
  const right = origin + width + offset;
  const bottom = origin + height + offset;
  const leg = Math.min(cornerLegAt(offset, cut), (right - left) / 2, (bottom - top) / 2);
  const points: Array<[number, number]> = [
    [left + leg, top],
    [right - leg, top],
    [right, top + leg],
    [right, bottom - leg],
    [right - leg, bottom],
    [left + leg, bottom],
    [left, bottom - leg],
    [left, top + leg],
  ];
  return `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')} Z`;
}

export function octagonPerimeter(width: number, height: number, offset: number, cut = FRAME_CORNER_CUT_PX): number {
  const outerWidth = width + 2 * offset;
  const outerHeight = height + 2 * offset;
  const leg = Math.min(cornerLegAt(offset, cut), outerWidth / 2, outerHeight / 2);
  return 2 * (outerWidth - 2 * leg) + 2 * (outerHeight - 2 * leg) + 4 * leg * SQRT2;
}

/** The four triangles that fill the picture's corners, as one path. */
export function cornerTrianglesPath(width: number, height: number, origin: number, cut = FRAME_CORNER_CUT_PX): string {
  const l = origin;
  const t = origin;
  const r = origin + width;
  const b = origin + height;
  const c = Math.min(cut, width / 2, height / 2);
  return [
    `M ${round(l)} ${round(t)} L ${round(l + c)} ${round(t)} L ${round(l)} ${round(t + c)} Z`,
    `M ${round(r)} ${round(t)} L ${round(r)} ${round(t + c)} L ${round(r - c)} ${round(t)} Z`,
    `M ${round(r)} ${round(b)} L ${round(r - c)} ${round(b)} L ${round(r)} ${round(b - c)} Z`,
    `M ${round(l)} ${round(b)} L ${round(l)} ${round(b - c)} L ${round(l + c)} ${round(b)} Z`,
  ].join(' ');
}

/** Small seeded generator, so the gaps are random but the same on every render. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const FRAME_GAP_SEED = 0x4d6f726b;

/**
 * A stroke-dasharray that interrupts a line of `length` px at random places:
 * dashes of 18–110 px separated by gaps of 3–9 px (times `scale`, gaps at
 * least 2 px), covering the whole length.
 */
export function randomGapDashArray(length: number, seed = FRAME_GAP_SEED, scale = 1): number[] {
  const random = seededRandom(seed);
  const dashes: number[] = [];
  let covered = 0;
  while (covered < length) {
    const dash = (18 + random() * 92) * scale;
    const gap = Math.max(2, (3 + random() * 6) * scale);
    dashes.push(round(dash), round(gap));
    covered += dash + gap;
  }
  return dashes;
}

/**
 * The timer on the bottom line: two bright segments that shrink from the
 * frame's ends toward the element being waited for. Returns the segments'
 * extent (in frame-relative px) when the timer starts.
 */
export function timerSegments(frameWidth: number, targetX: number, endInset: number): {
  left: { from: number; to: number };
  right: { from: number; to: number };
} {
  const start = Math.min(endInset, frameWidth / 2);
  const end = Math.max(frameWidth - endInset, frameWidth / 2);
  const target = Math.min(Math.max(targetX, start), end);
  return {
    left: { from: start, to: target },
    right: { from: target, to: end },
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Dashes for a ring with random gaps, in units of a path length of 100 (use
 * `pathLength="100"`): dashes of 7–24 units and gaps of 2–5, ending exactly
 * on the full circle. A different seed gives a different pattern.
 */
export function randomRingDashArray(seed: number): number[] {
  const random = seededRandom(seed);
  const dashes: number[] = [];
  let covered = 0;
  while (covered < 100) {
    const dash = Math.min(7 + random() * 17, 100 - covered);
    covered += dash;
    const gap = Math.min(2 + random() * 3, Math.max(0, 100 - covered));
    covered += gap;
    dashes.push(round(dash), round(gap));
  }
  return dashes;
}

/** A stable number for a text, to seed a pattern per item. */
export function seedFromText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}
