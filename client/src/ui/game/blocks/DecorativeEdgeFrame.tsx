import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { FrameLinesSvg, useElementSize } from '../../common/LineFrame.js';
import { fractionAt, subscribeFrameTimer, type FrameTimer } from '../frameTimer.js';
import {
  ENCOUNTER_FRAME,
  FRAME_OUTSET_PX,
  cornerLegAt,
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
export function DecorativeEdgeFrame({ zIndex = FRAME_Z_INDEX, showTimer = false }: { zIndex?: number; showTimer?: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(frameRef);
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
    <div ref={frameRef} aria-hidden="true" style={{ ...frameLayerStyle, zIndex }}>
      <FrameLinesSvg height={size.height} spec={ENCOUNTER_FRAME} style={svgStyle} width={size.width} />
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
