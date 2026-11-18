import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { FRAME_LINE_COLOR, useElementSize } from '../../common/LineFrame.js';
import { bannerFieldPath, bannerLine, randomGapDashArray, type BannerShape } from './encounterFrameGeometry.js';

/**
 * "Make your choice" across the encounter picture (Babuni, 2026-11-18): the
 * region plate's look, stretched from frame to frame. A thick line on the
 * field's edge, a broken line, and a thin line a little further out.
 */
const BAND_HALF_PX = 6;
const PLATE_HALF_PX = 15;
const TEXT_PADDING_PX = 14;
const FIELD_FILL = '#330000';
const TEXT_COLOR = '#ffcc66';
const LINES = [
  { offset: 0, width: 2, opacity: 0.95, gapped: false },
  { offset: 3, width: 2, opacity: 0.85, gapped: true },
  { offset: 6, width: 1, opacity: 0.7, gapped: false },
] as const;
const SVG_PAD = 10;

const layerStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  pointerEvents: 'none',
  zIndex: 30,
};

const textStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  color: TEXT_COLOR,
  fontFamily: "'Breathe Fire', Georgia, serif",
  fontSize: 18,
  letterSpacing: '0.05em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
};

export function ChoiceBanner({
  text,
  bottomPx,
  style,
}: {
  text: string;
  /** Distance of the banner's middle above the picture's bottom edge. */
  bottomPx: number;
  style?: CSSProperties;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const { width } = useElementSize(layerRef);
  const [textWidth, setTextWidth] = useState(0);
  const height = 2 * (PLATE_HALF_PX + SVG_PAD);

  useLayoutEffect(() => {
    setTextWidth(textRef.current?.offsetWidth ?? 0);
  }, [text]);

  const shape: BannerShape | null = width > 0 && textWidth > 0
    ? {
      width,
      centerY: height / 2,
      band: BAND_HALF_PX,
      plate: PLATE_HALF_PX,
      straight: Math.min(textWidth + 2 * TEXT_PADDING_PX, width - 4 * PLATE_HALF_PX),
    }
    : null;

  return (
    <div
      aria-hidden="true"
      ref={layerRef}
      style={{ ...layerStyle, bottom: bottomPx - height / 2, height, ...style }}
    >
      {shape ? (
        <svg
          focusable="false"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.85))' }}
          viewBox={`0 0 ${width} ${height}`}
        >
          <path d={bannerFieldPath(shape)} fill={FIELD_FILL} />
          {LINES.map((line) => {
            const path = bannerLine(shape, line.offset);
            const dash = line.gapped ? randomGapDashArray(path.length, 0x62616e72 + line.offset).join(' ') : undefined;
            return (
              <g key={line.offset} fill="none" opacity={line.opacity} stroke={FRAME_LINE_COLOR} strokeLinejoin="miter" strokeWidth={line.width}>
                <path d={path.upper} strokeDasharray={dash} />
                <path d={path.lower} strokeDasharray={dash} />
              </g>
            );
          })}
        </svg>
      ) : null}
      <span ref={textRef} style={{ ...textStyle, visibility: shape ? 'visible' : 'hidden' }}>{text}</span>
    </div>
  );
}

export default ChoiceBanner;
