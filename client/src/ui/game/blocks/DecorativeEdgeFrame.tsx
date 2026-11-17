import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { FrameLinesSvg, useElementSize } from '../../common/LineFrame.js';
import { fractionAt, subscribeFrameTimer, type FrameTimer } from '../frameTimer.js';
import {
  ENCOUNTER_FRAME,
  FRAME_OUTSET_PX,
  cornerLegAt,
  fitTab,
  timerSegments,
} from './encounterFrameGeometry.js';

const FRAME_Z_INDEX = 25;
export { FRAME_LINE_COLOR } from '../../common/LineFrame.js';
const TIMER_COLOR = '#fff4cf';
/** The line the timer runs along: the gapped one, in the middle of the frame. */
const TIMER_LINE_OFFSET = 4;
const TIMER_THICKNESS_PX = 4;

const frameLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: -FRAME_OUTSET_PX,
  pointerEvents: 'none',
  overflow: 'visible',
};

const svgStyle: CSSProperties = {
  // Keeps the thin lines readable on bright pictures.
  filter: 'drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.85))',
};

/** The region plate (Babuni's design, 2026-11-17): the title font, gold on the dark red. */
const REGION_PLATE_HALF_PX = 10;
const REGION_PLATE_PADDING_PX = 8;
const REGION_PLATE_FILL = '#330000';
const REGION_TEXT_COLOR = '#ffcc66';

const regionLabelStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: FRAME_OUTSET_PX,
  transform: 'translate(-50%, -50%)',
  color: REGION_TEXT_COLOR,
  fontFamily: "'Breathe Fire', Georgia, serif",
  fontSize: 13,
  lineHeight: `${2 * REGION_PLATE_HALF_PX}px`,
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  pointerEvents: 'none',
};

const TIMER_FADE_IN_MS = 280;
const TIMER_KEYFRAMES = '@keyframes morkahja-frame-timer-fade-in { from { opacity: 0; } to { opacity: 1; } }';

interface ShownTimer {
  timer: FrameTimer;
  targetX: number;
}

/**
 * Lines around the encounter picture with cut-off corners (see
 * encounterFrameGeometry). With `showTimer`, the bottom line also shows the
 * frame timer: it shrinks toward whatever the player is waiting for.
 */
export function DecorativeEdgeFrame({
  zIndex = FRAME_Z_INDEX,
  showTimer = false,
  regionLabel,
  onRegionClick,
  regionPressed = false,
}: {
  zIndex?: number;
  showTimer?: boolean;
  /** The region's name, shown on a plate on the top edge. */
  regionLabel?: string | null;
  /** Makes the plate a button (it opens the world map). */
  onRegionClick?: () => void;
  regionPressed?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  useLayoutEffect(() => {
    const node = labelRef.current;
    if (!node) {
      setLabelWidth(0);
      return undefined;
    }
    const measure = (): void => setLabelWidth(node.scrollWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [regionLabel]);
  const [shownTimer, setShownTimer] = useState<ShownTimer | null>(null);

  useEffect(() => {
    if (!showTimer) {
      return undefined;
    }
    let clearTimer: number | null = null;
    const unsubscribe = subscribeFrameTimer((timer) => {
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
        clearTimer = null;
      }
      const node = frameRef.current;
      if (!timer || !node) {
        setShownTimer(null);
        return;
      }
      setShownTimer((shown) => {
        // The line keeps its place for the whole phase; only its timing changes.
        if (shown?.timer.id === timer.id) {
          return { ...shown, timer };
        }
        // Measured on screen; drawn in the (possibly scaled) stage's own pixels.
        const frameRect = node.getBoundingClientRect();
        const scale = node.offsetWidth > 0 ? frameRect.width / node.offsetWidth : 1;
        const targetRect = timer.target?.isConnected ? timer.target.getBoundingClientRect() : null;
        const targetX = targetRect && targetRect.width > 0
          ? (targetRect.left + targetRect.width / 2 - frameRect.left) / scale
          : node.offsetWidth / 2;
        return { timer, targetX };
      });
      clearTimer = window.setTimeout(() => {
        setShownTimer((shown) => (shown?.timer.id === timer.id && shown.timer.revision === timer.revision ? null : shown));
      }, Math.max(0, timer.planEnd - performance.now()));
    });
    return () => {
      unsubscribe();
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
      }
    };
  }, [showTimer]);

  // Each plan re-times the shrink from the line's current length to nothing.
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const timerRevision = shownTimer ? `${shownTimer.timer.id}:${shownTimer.timer.revision}` : '';
  useLayoutEffect(() => {
    const timer = shownTimer?.timer;
    if (!timer) {
      return undefined;
    }
    const now = performance.now();
    const from = fractionAt(timer, now);
    const duration = Math.max(1, timer.planEnd - now);
    const animations = barRefs.current
      .filter((bar): bar is HTMLDivElement => Boolean(bar))
      .map((bar) => bar.animate(
        [{ transform: `scaleX(${from})` }, { transform: 'scaleX(0)' }],
        { duration, easing: 'linear', fill: 'forwards' },
      ));
    return () => animations.forEach((animation) => animation.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRevision, size.width]);

  const pictureWidth = size.width - 2 * FRAME_OUTSET_PX;
  const pictureHeight = size.height - 2 * FRAME_OUTSET_PX;
  const drawable = pictureWidth > 0 && pictureHeight > 0;
  const tab = drawable && regionLabel && labelWidth > 0
    ? fitTab(
      { straight: labelWidth + 2 * REGION_PLATE_PADDING_PX, half: REGION_PLATE_HALF_PX },
      pictureWidth,
      FRAME_OUTSET_PX,
    )
    : null;

  let timerBars = null;
  if (drawable && shownTimer) {
    const endInset = FRAME_OUTSET_PX - TIMER_LINE_OFFSET + cornerLegAt(TIMER_LINE_OFFSET);
    const segments = timerSegments(size.width, shownTimer.targetX, endInset);
    const barBase: CSSProperties = {
      position: 'absolute',
      top: FRAME_OUTSET_PX + pictureHeight + TIMER_LINE_OFFSET - TIMER_THICKNESS_PX / 2,
      height: TIMER_THICKNESS_PX,
      borderRadius: TIMER_THICKNESS_PX,
      background: TIMER_COLOR,
      boxShadow: '0 0 8px 1px rgba(255, 222, 150, 0.95), 0 0 3px rgba(255, 255, 255, 0.8)',
      // Fades in when the phase starts; the shrink is animated from the plan above.
      transform: `scaleX(${fractionAt(shownTimer.timer, performance.now())})`,
      animation: `morkahja-frame-timer-fade-in ${TIMER_FADE_IN_MS}ms ease-out`,
    };
    timerBars = (
      <>
        <div
          key={`l${shownTimer.timer.id}`}
          ref={(bar) => { barRefs.current[0] = bar; }}
          style={{
            ...barBase,
            left: segments.left.from,
            width: segments.left.to - segments.left.from,
            transformOrigin: 'right center',
          }}
        />
        <div
          key={`r${shownTimer.timer.id}`}
          ref={(bar) => { barRefs.current[1] = bar; }}
          style={{
            ...barBase,
            left: segments.right.from,
            width: segments.right.to - segments.right.from,
            transformOrigin: 'left center',
          }}
        />
      </>
    );
  }

  return (
    <div ref={frameRef} aria-hidden={onRegionClick ? undefined : true} style={{ ...frameLayerStyle, zIndex }}>
      <FrameLinesSvg
        height={size.height}
        spec={ENCOUNTER_FRAME}
        style={svgStyle}
        tab={tab}
        tabFill={REGION_PLATE_FILL}
        width={size.width}
      />
      {regionLabel && tab && onRegionClick ? (
        <button
          aria-label={regionPressed ? `Close the world map (${regionLabel})` : `Open the world map (${regionLabel})`}
          aria-pressed={regionPressed}
          className="morkahja-region-plate-button"
          onClick={onRegionClick}
          style={{
            position: 'absolute',
            left: '50%',
            top: FRAME_OUTSET_PX,
            width: tab.straight + 2 * tab.half,
            height: 2 * tab.half + 8,
            transform: 'translate(-50%, -50%)',
            padding: 0,
            border: 'none',
            background: 'transparent',
            pointerEvents: 'auto',
            cursor: 'pointer',
            clipPath: `polygon(0 50%, ${tab.half}px 4px, calc(100% - ${tab.half}px) 4px, 100% 50%, calc(100% - ${tab.half}px) calc(100% - 4px), ${tab.half}px calc(100% - 4px))`,
          }}
          title={regionPressed ? 'Close the map' : 'Open the map'}
          type="button"
        />
      ) : null}
      {regionLabel ? (
        <span
          aria-hidden="true"
          ref={labelRef}
          style={{
            ...regionLabelStyle,
            // Measured at full width first; then capped to the plate that fits.
            maxWidth: tab ? tab.straight - REGION_PLATE_PADDING_PX : undefined,
            visibility: tab ? 'visible' : 'hidden',
          }}
        >
          {regionLabel}
        </span>
      ) : null}
      {timerBars ? (
        <>
          <style>{TIMER_KEYFRAMES}</style>
          {timerBars}
        </>
      ) : null}
    </div>
  );
}

export default DecorativeEdgeFrame;
