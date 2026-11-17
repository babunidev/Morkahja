import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  PANEL_FRAME,
  cornerLegAt,
  cornerTrianglesPath,
  octagonPath,
  octagonPerimeter,
  randomGapDashArray,
  tabPlatePath,
  tabbedFrameLine,
  type FrameSpec,
  type FrameTab,
} from '../game/blocks/encounterFrameGeometry.js';

/**
 * The game's one frame (Babuni's direction, 2026-11-13): the encounter
 * picture's lines — a line, a line with random gaps, a thin line, a small gap
 * and an outer line — with cut-off corners and small corner triangles. Panels,
 * menus and tooltips draw it inside their edge, a little thinner; the
 * encounter draws it outside the picture (DecorativeEdgeFrame).
 */
export const FRAME_LINE_COLOR = '#d8b06a';

/** Tracks an element's own (unscaled) size. */
export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const updateSize = (): void => {
      setSize((current) => (current.width === node.clientWidth && current.height === node.clientHeight
        ? current
        : { width: node.clientWidth, height: node.clientHeight }));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const svgStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  pointerEvents: 'none',
};

/**
 * The lines and corner triangles for a layer of `width` × `height` whose
 * framed area sits `spec.outset` px inside the layer's edge.
 */
export function FrameLinesSvg({
  spec,
  width,
  height,
  style,
  tab = null,
  tabFill,
}: {
  spec: FrameSpec;
  width: number;
  height: number;
  style?: CSSProperties;
  /** A plate on the top edge that the top lines go around (the encounter's region). */
  tab?: FrameTab | null;
  tabFill?: string;
}) {
  const innerWidth = width - 2 * spec.outset;
  const innerHeight = height - 2 * spec.outset;
  if (!(innerWidth > 0 && innerHeight > 0)) {
    return null;
  }
  return (
    <svg aria-hidden="true" focusable="false" style={{ ...svgStyle, ...style }} viewBox={`0 0 ${width} ${height}`}>
      <path d={cornerTrianglesPath(innerWidth, innerHeight, spec.outset, spec.cut)} fill={FRAME_LINE_COLOR} opacity={0.95} />
      {tab && tabFill ? (
        <path d={tabPlatePath(innerWidth, spec.outset, tab)} fill={tabFill} />
      ) : null}
      {tab ? spec.lines.map((line) => {
        const lines = tabbedFrameLine(innerWidth, innerHeight, line.offset, spec.outset, tab, spec.cut);
        const dash = (length: number, seed?: number) => (line.gapped
          ? randomGapDashArray(length, seed, spec.dashScale).join(' ')
          : undefined);
        return (
          <g key={line.offset} fill="none" opacity={line.opacity} stroke={FRAME_LINE_COLOR} strokeLinejoin="miter" strokeWidth={line.width}>
            <path d={lines.frame} strokeDasharray={dash(lines.frameLength)} />
            <path d={lines.ring} strokeDasharray={dash(lines.ringLength, 0x7265676e)} />
          </g>
        );
      }) : spec.lines.map((line) => (
        <path
          key={line.offset}
          d={octagonPath(innerWidth, innerHeight, line.offset, spec.outset, spec.cut)}
          fill="none"
          opacity={line.opacity}
          stroke={FRAME_LINE_COLOR}
          strokeDasharray={line.gapped
            ? randomGapDashArray(octagonPerimeter(innerWidth, innerHeight, line.offset, spec.cut), undefined, spec.dashScale).join(' ')
            : undefined}
          strokeLinejoin="miter"
          strokeWidth={line.width}
        />
      ))}
    </svg>
  );
}

/** The octagon a framed element's background is cut to, as a CSS clip-path. */
export function frameClipPath(spec: FrameSpec = PANEL_FRAME): string {
  const leg = Math.round(cornerLegAt(spec.outset, spec.cut) * 100) / 100;
  const l = `${leg}px`;
  const r = `calc(100% - ${leg}px)`;
  return `polygon(${l} 0, ${r} 0, 100% ${l}, 100% ${r}, ${r} 100%, ${l} 100%, 0 ${r}, 0 ${l})`;
}

/**
 * A panel's or tooltip's own style without its old rounded border, background
 * and shadow, which the LineFrame inside it draws instead. Keeps the element
 * positioned, so the frame can fill it.
 */
export function framedStyle(style: CSSProperties): CSSProperties {
  const {
    border: _border,
    borderRadius: _borderRadius,
    background: _background,
    boxShadow: _boxShadow,
    ...rest
  } = style;
  return {
    ...rest,
    position: rest.position && rest.position !== 'static' ? rest.position : 'relative',
    isolation: 'isolate',
  };
}

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  pointerEvents: 'none',
};

/**
 * Put as a child of a framed element (styled with `framedStyle`): draws its
 * background, cut to the frame's octagon and shadowed, behind the content, and
 * the frame's lines along its edge.
 */
export function LineFrame({
  spec = PANEL_FRAME,
  background,
  shadow = '0 10px 18px rgba(0, 0, 0, 0.55)',
}: {
  spec?: FrameSpec;
  background?: CSSProperties['background'];
  /** A CSS drop-shadow (offset, blur, colour) under the octagon; `null` for none. */
  shadow?: string | null;
}) {
  const layerRef = useRef<HTMLSpanElement>(null);
  const { width, height } = useElementSize(layerRef);
  return (
    <>
      {background ? (
        <span
          aria-hidden="true"
          style={{ ...layerStyle, zIndex: -1, filter: shadow ? `drop-shadow(${shadow})` : undefined }}
        >
          <span style={{ ...layerStyle, background, clipPath: frameClipPath(spec) }} />
        </span>
      ) : null}
      <span aria-hidden="true" ref={layerRef} style={layerStyle}>
        <FrameLinesSvg height={height} spec={spec} width={width} />
      </span>
    </>
  );
}

export default LineFrame;
