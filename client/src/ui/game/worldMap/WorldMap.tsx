import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useElementSize } from '../../common/LineFrame.js';
import { seededRandom, seedFromText } from '../blocks/encounterFrameGeometry.js';
import {
  EXPANSION_FOCUS,
  MAP_HEIGHT,
  MAP_PATHS,
  MAP_REGIONS,
  MAP_SITES,
  MAP_WIDTH,
  SKYLAND_FIELDS,
  type BorderStyle,
  type MapRegion,
  type MapSite,
  type Point,
  type Terrain,
} from './worldMapData.js';
import { clampView, scaleLimits, scatterInside, zoomAt, type MapView } from './worldMapGeometry.js';
import { ENCOUNTER_LOCATIONS } from './encounterLocations.js';

/**
 * Morkahja drawn as a map (Babuni's design, 2026-11-17): gold ground, every
 * line in the dark red, straight angled lines only, triangles as the only
 * symbols, and borders built like the encounter frame's lines.
 */
const GOLD = '#ffcc66';
const RED = '#330000';
const TITLE_FONT = "'Breathe Fire', Georgia, serif";

type Stroke = { width: number; color: string; dash?: string; opacity?: number };

/** Layered strokes on one path read as parallel lines: full, broken, thin, as in the frame. */
const BORDER_STROKES: Record<BorderStyle, Stroke[]> = {
  // Three lines: full, broken, full.
  realm: [
    { width: 9, color: RED },
    { width: 6.4, color: GOLD },
    { width: 1.8, color: RED, dash: '12 5' },
  ],
  // A full line beside a thin broken one.
  land: [
    { width: 6, color: RED },
    { width: 4.2, color: GOLD },
    { width: 1.1, color: RED, dash: '7 4' },
  ],
  // A thin full line crossed by short broken strokes.
  wild: [
    { width: 1.3, color: RED },
    { width: 6, color: RED, dash: '1.4 7', opacity: 0.8 },
  ],
  hidden: [{ width: 1.4, color: RED, dash: '5 4' }],
};

const PATH_STROKES: Record<'road' | 'stream' | 'pass', Stroke[]> = {
  road: [{ width: 1.6, color: RED, dash: '8 5', opacity: 0.85 }],
  stream: [
    { width: 4, color: RED, opacity: 0.55 },
    { width: 2.2, color: GOLD },
  ],
  pass: [{ width: 1.4, color: RED, dash: '2 4', opacity: 0.9 }],
};

function polyline(points: readonly Point[], closed = false): string {
  return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}${closed ? ' Z' : ''}`;
}

function triangle(x: number, y: number, width: number, height: number, tilt = 0): string {
  // Base centred on (x, y), apex `height` above, leaning by `tilt` units.
  return polyline([[x - width / 2, y], [x + tilt, y - height], [x + width / 2, y]], true);
}

function Layered({ d, strokes, fill = 'none', fillOpacity }: { d: string; strokes: Stroke[]; fill?: string; fillOpacity?: number }) {
  return (
    <>
      {fill !== 'none' ? <path d={d} fill={fill} fillOpacity={fillOpacity} stroke="none" /> : null}
      {strokes.map((stroke, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          opacity={stroke.opacity}
          stroke={stroke.color}
          strokeDasharray={stroke.dash}
          strokeLinejoin="miter"
          strokeWidth={stroke.width}
        />
      ))}
    </>
  );
}

/** One terrain symbol, from triangles and straight strokes only. */
function terrainSymbol(terrain: Terrain, [x, y]: Point, random: () => number, key: string): ReactNode {
  const size = 0.8 + random() * 0.45;
  switch (terrain) {
    case 'meadow':
      return (
        <path key={key} d={polyline([[x - 6 * size, y], [x - 3 * size, y - 7 * size], [x, y], [x + 3 * size, y - 9 * size], [x + 6 * size, y]])} fill="none" stroke={RED} strokeOpacity={0.7} strokeWidth={1.1} />
      );
    case 'forest':
      return <path key={key} d={triangle(x, y, 10 * size, 20 * size)} fill={RED} fillOpacity={0.88} />;
    case 'cursed-forest': {
      const tilt = (random() - 0.5) * 12;
      return (
        <g key={key}>
          <path d={triangle(x, y, 10 * size, 22 * size, tilt)} fill={RED} />
          <path d={polyline([[x + tilt * 0.3, y - 3], [x + tilt * 0.8, y - 17 * size]])} stroke={GOLD} strokeOpacity={0.6} strokeWidth={0.8} />
        </g>
      );
    }
    case 'mountain':
    case 'snow-mountain':
    case 'volcano': {
      const w = 34 * size;
      const h = 28 * size;
      return (
        <g key={key}>
          <path d={triangle(x, y, w, h)} fill={GOLD} stroke={RED} strokeLinejoin="miter" strokeWidth={1.6} />
          <path d={polyline([[x, y - h], [x + w / 2, y], [x + w * 0.12, y]], true)} fill={RED} fillOpacity={0.75} />
          {terrain === 'snow-mountain' ? (
            <path d={polyline([[x - w * 0.2, y - h * 0.6], [x - w * 0.08, y - h * 0.5], [x, y - h * 0.62], [x + w * 0.1, y - h * 0.5], [x + w * 0.2, y - h * 0.6]])} fill="none" stroke={GOLD} strokeWidth={1.4} />
          ) : null}
          {terrain === 'volcano' ? (
            <>
              <path d={polyline([[x - 4, y - h - 9], [x, y - h - 1], [x + 4, y - h - 9]], true)} fill={RED} />
              <path d={triangle(x - 7, y - h - 12, 3, 5, -1)} fill={RED} />
              <path d={triangle(x + 7, y - h - 14, 3, 5, 1)} fill={RED} />
            </>
          ) : null}
        </g>
      );
    }
    case 'tundra':
      return (
        <g key={key}>
          <path d={triangle(x, y, 18 * size, 7 * size, 3)} fill="none" stroke={RED} strokeWidth={1.2} />
          <path d={triangle(x + 11 * size, y + 2, 8 * size, 4 * size, -1)} fill={RED} fillOpacity={0.7} />
        </g>
      );
    case 'desert':
      return (
        <g key={key}>
          <path d={triangle(x, y, 36 * size, 9 * size, 6)} fill="none" stroke={RED} strokeOpacity={0.75} strokeWidth={1.2} />
          <path d={polyline([[x + 6, y - 9 * size], [x + 18 * size, y], [x + 4, y]], true)} fill={RED} fillOpacity={0.35} />
        </g>
      );
    case 'swamp':
      return (
        <g key={key} stroke={RED} strokeOpacity={0.75} strokeWidth={1.1}>
          <path d={polyline([[x - 10, y], [x - 2, y]])} />
          <path d={polyline([[x + 2, y], [x + 10, y]])} />
          <path d={polyline([[x - 5, y + 5], [x + 5, y + 5]])} />
          <path d={triangle(x - 3, y - 1, 3, 10, -2)} fill={RED} stroke="none" />
          <path d={triangle(x + 4, y - 1, 3, 13, 2)} fill={RED} stroke="none" />
        </g>
      );
    case 'skyland':
      return <path key={key} d={polyline([[x - 14, y], [x + 14, y], [x + 2, y + 16]], true)} fill={RED} fillOpacity={0.8} />;
    case 'underground':
      return <path key={key} d={triangle(x, y, 18, 14)} fill="none" stroke={RED} strokeDasharray="3 3" strokeWidth={1.2} />;
    default:
      return null;
  }
}

function siteSymbol(site: MapSite): ReactNode {
  const [x, y] = site.at;
  switch (site.kind) {
    case 'capital': {
      // Walls as an octagon in the frame's lines, towers as triangles.
      const r = 26;
      const leg = r * 0.41;
      const oct: Point[] = [[x - leg, y - r], [x + leg, y - r], [x + r, y - leg], [x + r, y + leg], [x + leg, y + r], [x - leg, y + r], [x - r, y + leg], [x - r, y - leg]];
      return (
        <g>
          <Layered d={polyline(oct, true)} fill={GOLD} strokes={BORDER_STROKES.land} />
          <path d={triangle(x, y + 10, 12, 30)} fill={RED} />
          <path d={triangle(x - 12, y + 12, 9, 18, -1)} fill={RED} />
          <path d={triangle(x + 12, y + 12, 9, 18, 1)} fill={RED} />
        </g>
      );
    }
    case 'city': {
      const r = 13;
      const leg = r * 0.41;
      const oct: Point[] = [[x - leg, y - r], [x + leg, y - r], [x + r, y - leg], [x + r, y + leg], [x + leg, y + r], [x - leg, y + r], [x - r, y + leg], [x - r, y - leg]];
      return (
        <g>
          <path d={polyline(oct, true)} fill={GOLD} stroke={RED} strokeWidth={1.6} />
          <path d={triangle(x - 4, y + 6, 8, 15, -1)} fill={RED} />
          <path d={triangle(x + 5, y + 6, 7, 11, 1)} fill={RED} />
        </g>
      );
    }
    case 'temple':
      return (
        <g>
          <path d={triangle(x, y + 7, 22, 18)} fill={GOLD} stroke={RED} strokeWidth={1.5} />
          <path d={triangle(x, y + 3, 9, 8)} fill={RED} />
        </g>
      );
    case 'ruin':
      return (
        <g stroke={RED} strokeWidth={1.6} fill="none">
          <path d={polyline([[x - 12, y + 8], [x - 3, y - 10]])} />
          <path d={polyline([[x + 2, y - 8], [x + 12, y + 8], [x + 3, y + 8]])} />
          <path d={triangle(x - 5, y + 8, 6, 5, 1)} fill={RED} stroke="none" />
        </g>
      );
    case 'oasis':
      return (
        <g>
          <path d={polyline([[x, y - 11], [x + 8, y], [x, y + 11], [x - 8, y]], true)} fill={RED} />
          <path d={polyline([[x, y - 5], [x + 3.5, y], [x, y + 5], [x - 3.5, y]], true)} fill={GOLD} />
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
            return <path key={index} d={triangle(x + Math.cos(angle) * 17, y + Math.sin(angle) * 17 + 3, 5, 8)} fill={RED} />;
          })}
        </g>
      );
    case 'peak':
      return (
        <g>
          <path d={triangle(x, y + 8, 22, 26)} fill={RED} />
          <path d={polyline([[x - 4, y - 8], [x, y - 18], [x + 4, y - 8]])} fill="none" stroke={GOLD} strokeWidth={1.3} />
        </g>
      );
    case 'hollow':
      return (
        <g>
          <path d={polyline([[x - 13, y - 8], [x + 13, y - 8], [x, y + 12]], true)} fill={GOLD} stroke={RED} strokeDasharray="4 3" strokeWidth={1.6} />
          <path d={polyline([[x - 5, y - 4], [x + 5, y - 4], [x, y + 4]], true)} fill={RED} />
        </g>
      );
    default:
      return <path d={polyline([[x - 7, y - 10], [x + 7, y - 10], [x, y + 4]], true)} fill={RED} />;
  }
}

const labelOffsets: Record<NonNullable<MapSite['labelSide']>, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  above: { dx: 0, dy: -22, anchor: 'middle' },
  below: { dx: 0, dy: 30, anchor: 'middle' },
  left: { dx: -20, dy: 5, anchor: 'end' },
  right: { dx: 20, dy: 5, anchor: 'start' },
};

function MapText({ x, y, size, children, anchor = 'middle', italic = false }: { x: number; y: number; size: number; children: string; anchor?: 'start' | 'middle' | 'end'; italic?: boolean }) {
  return (
    <text
      fill={RED}
      fontFamily={italic ? 'Georgia, serif' : TITLE_FONT}
      fontSize={size}
      fontStyle={italic ? 'italic' : undefined}
      letterSpacing={italic ? 0.4 : size * 0.06}
      paintOrder="stroke"
      stroke={GOLD}
      strokeLinejoin="miter"
      strokeWidth={size * 0.28}
      textAnchor={anchor}
      x={x}
      y={y}
    >
      {children}
    </text>
  );
}

function RegionLand({ region, current }: { region: MapRegion; current: boolean }) {
  const d = polyline(region.outline, true);
  return (
    <Layered
      d={d}
      fill={RED}
      fillOpacity={current ? 0.16 : 0.05}
      strokes={BORDER_STROKES[region.border]}
    />
  );
}

/** The static drawing: built once, then only the view box moves. */
function MapDrawing({ currentRegionId }: { currentRegionId: string | null }) {
  const symbols = useMemo(() => {
    const avoid = MAP_SITES.map((site) => site.at);
    return MAP_REGIONS.flatMap((region) => {
      const random = seededRandom(seedFromText(`terrain:${region.id}`));
      const spots = scatterInside(region.outline, region.density, region.id, {
        margin: region.terrain.includes('mountain') || region.terrain === 'volcano' ? 22 : 14,
        gap: region.terrain.includes('mountain') || region.terrain === 'volcano' ? 40 : 24,
        avoid: [...avoid, region.label],
        avoidGap: 40,
      });
      return spots.map((spot, index) => terrainSymbol(region.terrain, spot, random, `${region.id}-${index}`));
    });
  }, []);

  const skylands = useMemo(() => SKYLAND_FIELDS.flatMap((field, fieldIndex) => {
    const random = seededRandom(seedFromText(`sky:${fieldIndex}`));
    return Array.from({ length: field.count }, (_, index) => {
      const point: Point = [field.at[0] + (random() - 0.5) * field.spread * 2, field.at[1] + (random() - 0.5) * field.spread];
      return terrainSymbol('skyland', point, random, `sky-${fieldIndex}-${index}`);
    });
  }), []);

  // The map's own edge: an octagon in the frame's three lines.
  const cut = 46;
  const edge: Point[] = [[cut, 14], [MAP_WIDTH - cut, 14], [MAP_WIDTH - 14, cut], [MAP_WIDTH - 14, MAP_HEIGHT - cut], [MAP_WIDTH - cut, MAP_HEIGHT - 14], [cut, MAP_HEIGHT - 14], [14, MAP_HEIGHT - cut], [14, cut]];

  return (
    <g>
      <rect fill={GOLD} height={MAP_HEIGHT} width={MAP_WIDTH} x={0} y={0} />
      <Layered d={polyline(edge, true)} strokes={BORDER_STROKES.realm} />
      {MAP_REGIONS.map((region) => <RegionLand key={region.id} current={region.id === currentRegionId} region={region} />)}
      {MAP_PATHS.map((path) => <Layered key={path.id} d={polyline(path.points)} strokes={PATH_STROKES[path.kind]} />)}
      {symbols}
      {skylands}
      {MAP_SITES.map((site) => {
        const side = labelOffsets[site.labelSide ?? 'below'];
        const big = site.kind === 'capital';
        return (
          <g key={site.id}>
            {siteSymbol(site)}
            <MapText anchor={side.anchor} size={big ? 22 : 13} x={site.at[0] + side.dx} y={site.at[1] + side.dy + (big ? 12 : 0)}>
              {site.name}
            </MapText>
          </g>
        );
      })}
      {MAP_REGIONS.map((region) => (
        <g key={`label-${region.id}`}>
          <MapText size={region.id === 'vale' ? 30 : 22} x={region.label[0]} y={region.label[1]}>
            {region.name}
          </MapText>
          {region.subtitle ? (
            <MapText italic size={11} x={region.label[0]} y={region.label[1] + 16}>
              {region.subtitle}
            </MapText>
          ) : null}
        </g>
      ))}
    </g>
  );
}

/**
 * Where the player is: an octagon of frame lines around the spot, with four
 * triangles that overlap it and point to the middle (Babuni, 2026-11-17).
 */
function HereMarker({ at }: { at: Point }) {
  const [x, y] = at;
  const r = 34;
  const leg = r * 0.41;
  const oct: Point[] = [[x - leg, y - r], [x + leg, y - r], [x + r, y - leg], [x + r, y + leg], [x + leg, y + r], [x - leg, y + r], [x - r, y + leg], [x - r, y - leg]];
  return (
    <g className="morkahja-map-here" pointerEvents="none">
      <Layered d={polyline(oct, true)} strokes={BORDER_STROKES.realm} />
      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d={polyline([[x - 11, y - r - 12], [x + 11, y - r - 12], [x, y - r + 8]], true)}
          fill={RED}
          stroke={GOLD}
          strokeWidth={1.5}
          transform={`rotate(${angle} ${x} ${y})`}
        />
      ))}
    </g>
  );
}

function Compass() {
  // Four triangles; north is the filled one.
  return (
    <svg aria-hidden="true" height={58} style={compassStyle} viewBox="-30 -30 60 60" width={58}>
      <path d="M 0 -26 L 6 -4 L -6 -4 Z" fill={RED} />
      <path d="M 0 26 L 6 4 L -6 4 Z" fill={GOLD} stroke={RED} strokeWidth={1.2} />
      <path d="M 26 0 L 4 6 L 4 -6 Z" fill={GOLD} stroke={RED} strokeWidth={1.2} />
      <path d="M -26 0 L -4 6 L -4 -6 Z" fill={GOLD} stroke={RED} strokeWidth={1.2} />
      <text fill={RED} fontFamily={TITLE_FONT} fontSize={9} textAnchor="middle" x={0} y={-17}>N</text>
    </svg>
  );
}

const compassStyle: CSSProperties = {
  position: 'absolute',
  right: 22,
  bottom: 22,
  pointerEvents: 'none',
  filter: 'drop-shadow(0 0 2px rgba(255, 204, 102, 0.9))',
};

const containerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: GOLD,
  touchAction: 'none',
  userSelect: 'none',
};

const svgStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};

const MARKER_KEYFRAMES = `
@keyframes morkahja-map-here { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.morkahja-map-here { animation: morkahja-map-here 1.73s ease-in-out infinite; }
`;

/**
 * Where the marker goes: the encounter's own place from Babuni's placement
 * list, else its expansion's land. Atranor and the level-up are not places.
 */
export function mapFocusFor(encounterId: number | null, expansion: number | null): { regionId: string; at: Point } | null {
  if (encounterId != null && encounterId in ENCOUNTER_LOCATIONS) {
    return ENCOUNTER_LOCATIONS[encounterId] ?? null;
  }
  return expansion != null ? EXPANSION_FOCUS[expansion] ?? null : null;
}

/**
 * The map, filling its parent. Opens centred on where the encounter happens;
 * drag to move, wheel or pinch to zoom.
 */
export function WorldMap({ encounterId, expansion, open }: { encounterId: number | null; expansion: number | null; open: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const focus = mapFocusFor(encounterId, expansion);
  const [view, setView] = useState<MapView | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const viewRef = useRef<MapView | null>(null);
  viewRef.current = view;

  const limits = size.width > 0 && size.height > 0 ? scaleLimits(size.width, size.height, MAP_WIDTH, MAP_HEIGHT) : null;

  // Each time the map opens, it opens on the land the player is in.
  useEffect(() => {
    if (!open || !limits) {
      return;
    }
    const at = focus?.at ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2];
    setView(clampView({ cx: at[0], cy: at[1], scale: limits.open }, size.width, size.height, MAP_WIDTH, MAP_HEIGHT, limits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, encounterId, expansion, size.width > 0 && size.height > 0]);

  function update(next: (current: MapView) => MapView): void {
    if (!limits) {
      return;
    }
    setView((current) => (current ? clampView(next(current), size.width, size.height, MAP_WIDTH, MAP_HEIGHT, limits) : current));
  }

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const ratio = node.clientWidth > 0 ? rect.width / node.clientWidth : 1;
      const factor = Math.exp(-event.deltaY * 0.0016);
      update((current) => zoomAt(current, factor, (event.clientX - rect.left) / ratio, (event.clientY - rect.top) / ratio, size.width, size.height));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  });

  function localPoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const node = containerRef.current!;
    const rect = node.getBoundingClientRect();
    const ratio = node.clientWidth > 0 ? rect.width / node.clientWidth : 1;
    return { x: (event.clientX - rect.left) / ratio, y: (event.clientY - rect.top) / ratio };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, localPoint(event));
    event.currentTarget.dataset.dragging = 'true';
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) {
      return;
    }
    const point = localPoint(event);
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
    if (others.length === 0) {
      update((current) => ({ ...current, cx: current.cx - (point.x - previous.x) / current.scale, cy: current.cy - (point.y - previous.y) / current.scale }));
    } else {
      // Pinch: zoom by the change in finger distance, about the midpoint.
      const other = others[0]!;
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(point.x - other.x, point.y - other.y);
      if (before > 0) {
        const midX = (point.x + other.x) / 2;
        const midY = (point.y + other.y) / 2;
        update((current) => zoomAt(current, after / before, midX, midY, size.width, size.height));
      }
    }
    pointers.current.set(event.pointerId, point);
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      delete event.currentTarget.dataset.dragging;
    }
  }

  const viewBox = view && size.width > 0
    ? `${view.cx - size.width / view.scale / 2} ${view.cy - size.height / view.scale / 2} ${size.width / view.scale} ${size.height / view.scale}`
    : `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;

  return (
    <div
      ref={containerRef}
      aria-label="World map of Morkahja. Drag to move, scroll or pinch to zoom."
      className="morkahja-map-cursor"
      data-morkahja-world-map=""
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      role="img"
      style={containerStyle}
    >
      <style>{MARKER_KEYFRAMES}</style>
      <svg preserveAspectRatio="xMidYMid meet" style={svgStyle} viewBox={viewBox}>
        <MapDrawing currentRegionId={focus?.regionId ?? null} />
        {focus ? <HereMarker at={focus.at} /> : null}
      </svg>
      <Compass />
    </div>
  );
}

export default WorldMap;
