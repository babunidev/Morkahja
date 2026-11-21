import { useMemo, useRef, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react';
import { seedFromText } from '../game/blocks/encounterFrameGeometry.js';
import { FRAME_LINE_COLOR, useElementSize } from './LineFrame.js';
import { solutionArtRadius, solutionFrameLookForIcon } from './solutionFrameIndex.js';
import {
  solutionIconNameFromSrc,
  solutionPictureZoom,
  type SolutionElement,
  type SolutionFrameLook,
  type SolutionFrameTier,
} from './solutionFrameLook.js';
import {
  frameRound as round,
  ORNAMENT_GOLD,
  PLATE_FILL,
  solutionFrameSvgMarkup,
  solutionFrameSvgStyle,
} from './solutionFrameMarkup.js';

/**
 * The round frame of a solution picture (Babuni's design, 2026-11-21): the
 * encounter frame's lines made round. From the picture outward: a line on the
 * picture's edge, a line with random gaps, and a thin line.
 *
 * - An essence adds four corner pieces that make the frame almost square, with
 *   45° cut corners like the encounter frame, and a small plate in each corner
 *   with its god's element.
 * - A rare item adds an ornamental ring around that: an outer line broken at
 *   eight points, a ring of beads, diamonds at the four sides and points at
 *   the four corners. It reaches a few pixels past the picture's box.
 *
 * Everything is drawn in the box's own pixels, so lines stay as thin at every
 * size. The picture itself is drawn a little smaller, inside the lines.
 */

/** The frame lines for a box `size` px wide; place over the picture's box. */
export function SolutionFrameSvg({
  size,
  tier,
  element = null,
  seed,
}: {
  size: number;
  tier: SolutionFrameTier;
  element?: SolutionElement | null;
  seed: number;
}) {
  const markup = useMemo(
    () => (size > 0 ? solutionFrameSvgMarkup(size, tier, element, seed) : ''),
    [size, tier, element, seed],
  );
  if (!(size > 0)) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
      focusable="false"
      style={solutionFrameSvgStyle(size)}
      viewBox={`0 0 ${round(size)} ${round(size)}`}
    />
  );
}

/** The picture's own box: its old image style without what only an <img> uses. */
function boxStyleFrom(style: CSSProperties | undefined): CSSProperties {
  const rest: CSSProperties = { ...style };
  delete rest.objectFit;
  delete rest.objectPosition;
  return {
    display: 'block',
    ...rest,
    position: rest.position && rest.position !== 'static' ? rest.position : 'relative',
    aspectRatio: '1 / 1',
    overflow: 'visible',
  };
}

/** A pointy-top hexagon around 0,0 with radius `r`. */
function hexagonPoints(r: number): string {
  return [-90, -30, 30, 90, 150, 210]
    .map((degrees) => {
      const angle = (degrees * Math.PI) / 180;
      return `${round(r * Math.cos(angle))},${round(r * Math.sin(angle))}`;
    })
    .join(' ');
}

/**
 * The charges a player holds of an item (Babuni, 2026-11-21): a small hexagon
 * plate at the picture's bottom right, so the count needs no tooltip. Part of
 * the frame layer, in its gold lines.
 */
export function SolutionChargeBadge({ charges, size }: { charges: number; size: number }) {
  const plate = Math.max(18, Math.round((size > 0 ? size : 56) * 0.34));
  const text = charges > 99 ? '99+' : String(charges);
  const fontSize = round(plate * (text.length > 2 ? 0.34 : text.length > 1 ? 0.44 : 0.52));
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: plate,
        height: plate,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <svg
        focusable="false"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9))',
        }}
        viewBox="-1 -1 2 2"
      >
        <polygon fill={PLATE_FILL} points={hexagonPoints(0.96)} stroke={FRAME_LINE_COLOR} strokeLinejoin="miter" strokeWidth={0.11} />
        <polygon fill="none" opacity={0.55} points={hexagonPoints(0.74)} stroke={FRAME_LINE_COLOR} strokeWidth={0.05} />
      </svg>
      <span
        style={{
          position: 'relative',
          color: ORNAMENT_GOLD,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
          textShadow: '0 0 3px rgba(0, 0, 0, 0.95)',
        }}
      >
        {text}
      </span>
    </span>
  );
}

/** A framed picture in a box styled like the old <img>. */
export function FramedSolutionPicture({
  src,
  look,
  seed,
  style,
  imgProps,
  zoom = 1,
  charges = null,
  children,
}: {
  src: string;
  look: SolutionFrameLook;
  seed: number;
  style?: CSSProperties;
  imgProps?: ImgHTMLAttributes<HTMLImageElement>;
  /** >1 cuts away an older picture's painted rim. */
  zoom?: number;
  /** Charges held, shown in a hexagon at the bottom right; null or 0 shows none. */
  charges?: number | null;
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const { width } = useElementSize(boxRef);
  const inset = width > 0 ? width / 2 - solutionArtRadius(width) : null;
  return (
    <span aria-hidden="true" onContextMenu={imgProps?.onContextMenu as never} ref={boxRef} style={boxStyleFrom(style)}>
      {/* Layer 1: the picture, clipped round inside the frame. */}
      <span
        style={{
          position: 'absolute',
          left: inset === null ? '10%' : round(inset),
          top: inset === null ? '10%' : round(inset),
          width: inset === null ? '80%' : round(width - 2 * inset),
          height: inset === null ? '80%' : round(width - 2 * inset),
          borderRadius: '50%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <img
          alt=""
          draggable={false}
          {...imgProps}
          src={src}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            pointerEvents: 'none',
          }}
        />
      </span>
      {/* Layer 2: the frame, drawn by the UI on top. */}
      <SolutionFrameSvg element={look.element} seed={seed} size={width} tier={look.tier} />
      {charges && charges > 0 ? <SolutionChargeBadge charges={charges} size={width} /> : null}
      {children}
    </span>
  );
}

/**
 * Drop-in for a solution picture's <img>: every solution picture gets the drawn
 * frame on top; an older picture is zoomed so its painted rim is cut away.
 */
export function SolutionImage({
  src,
  style,
  charges = null,
  ...imgProps
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; charges?: number | null }) {
  const iconName = solutionIconNameFromSrc(src);
  const look = iconName ? solutionFrameLookForIcon(iconName) : null;
  const seed = seedFromText(iconName ?? src);
  if (!look || !iconName) {
    return <img alt="" {...imgProps} src={src} style={style} />;
  }
  return (
    <FramedSolutionPicture
      imgProps={imgProps}
      look={look}
      seed={seed}
      src={src}
      charges={charges}
      style={style}
      zoom={solutionPictureZoom(look)}
    />
  );
}


