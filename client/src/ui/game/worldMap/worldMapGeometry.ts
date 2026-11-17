import { seededRandom, seedFromText } from '../blocks/encounterFrameGeometry.js';
import type { Point } from './worldMapData.js';

export function pointInPolygon([x, y]: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function distanceToOutline(point: Point, polygon: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, polygon[i]!, polygon[(i + 1) % polygon.length]!));
  }
  return best;
}

/**
 * `count` points inside `polygon`, at least `margin` from its edge and `gap`
 * from each other and from every point in `avoid`. Seeded by `seed`, so the
 * map is drawn the same every time.
 */
export function scatterInside(
  polygon: readonly Point[],
  count: number,
  seed: string,
  { margin = 14, gap = 22, avoid = [] as readonly Point[], avoidGap = 34 } = {},
): Point[] {
  const random = seededRandom(seedFromText(seed));
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const points: Point[] = [];
  for (let attempt = 0; attempt < count * 60 && points.length < count; attempt += 1) {
    const candidate: Point = [minX + random() * (maxX - minX), minY + random() * (maxY - minY)];
    if (!pointInPolygon(candidate, polygon) || distanceToOutline(candidate, polygon) < margin) {
      continue;
    }
    if (points.some(([x, y]) => Math.hypot(x - candidate[0], y - candidate[1]) < gap)) {
      continue;
    }
    if (avoid.some(([x, y]) => Math.hypot(x - candidate[0], y - candidate[1]) < avoidGap)) {
      continue;
    }
    points.push(candidate);
  }
  return points;
}

/** The angle at `b` between `a`–`b` and `b`–`c`, in degrees (0–180). */
export function cornerAngle(a: Point, b: Point, c: Point): number {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export interface MapView {
  /** Map point at the centre of the view. */
  cx: number;
  cy: number;
  /** Screen pixels per map unit. */
  scale: number;
}

/** The smallest scale shows the whole map; the largest is 4 times the scale the map opens at. */
export function scaleLimits(viewWidth: number, viewHeight: number, mapWidth: number, mapHeight: number): { min: number; open: number; max: number } {
  const fit = Math.min(viewWidth / mapWidth, viewHeight / mapHeight);
  const open = Math.max(fit, viewWidth / 460);
  return { min: fit, open, max: open * 4 };
}

/** Keeps the view over the map: a map larger than the view cannot be dragged past its edge. */
export function clampView(view: MapView, viewWidth: number, viewHeight: number, mapWidth: number, mapHeight: number, limits: { min: number; max: number }): MapView {
  const scale = Math.min(limits.max, Math.max(limits.min, view.scale));
  const halfW = viewWidth / scale / 2;
  const halfH = viewHeight / scale / 2;
  const cx = halfW * 2 >= mapWidth ? mapWidth / 2 : Math.min(mapWidth - halfW, Math.max(halfW, view.cx));
  const cy = halfH * 2 >= mapHeight ? mapHeight / 2 : Math.min(mapHeight - halfH, Math.max(halfH, view.cy));
  return { cx, cy, scale };
}

/** Zooms by `factor` keeping the map point under (`px`, `py`) (view pixels) in place. */
export function zoomAt(view: MapView, factor: number, px: number, py: number, viewWidth: number, viewHeight: number): MapView {
  const mapX = view.cx + (px - viewWidth / 2) / view.scale;
  const mapY = view.cy + (py - viewHeight / 2) / view.scale;
  const scale = view.scale * factor;
  return {
    scale,
    cx: mapX - (px - viewWidth / 2) / scale,
    cy: mapY - (py - viewHeight / 2) / scale,
  };
}
