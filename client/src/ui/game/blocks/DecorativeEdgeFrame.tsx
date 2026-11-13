import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FrameLinesSvg, useElementSize } from '../../common/LineFrame.js';
import { subscribeFrameTimer, type FrameTimer } from '../frameTimer.js';
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
const TIMER_KEYFRAMES = '@keyframes morkahja-frame-timer-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }'
  + ' @keyframes morkahja-frame-timer-fade-in { from { opacity: 0; } to { opacity: 1; } }';

interface ShownTimer {
  timer: FrameTimer;
  targetX: number;
  /** How far the wait had run when this frame picked it up. */
  elapsedMs: number;
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
      // Measured on screen; drawn in the (possibly scaled) stage's own pixels.
      const frameRect = node.getBoundingClientRect();
      const scale = node.offsetWidth > 0 ? frameRect.width / node.offsetWidth : 1;
      const targetRect = timer.target?.isConnected ? timer.target.getBoundingClientRect() : null;
      const targetX = targetRect && targetRect.width > 0
        ? (targetRect.left + targetRect.width / 2 - frameRect.left) / scale
        : node.offsetWidth / 2;
      const elapsedMs = Math.max(0, performance.now() - timer.startedAt);
      setShownTimer({ timer, targetX, elapsedMs: Math.round(elapsedMs) });
      const remaining = timer.durationMs - elapsedMs;
      clearTimer = window.setTimeout(() => {
        setShownTimer((shown) => (shown?.timer.id === timer.id ? null : shown));
      }, Math.max(0, remaining));
    });
    return () => {
      unsubscribe();
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
      }
    };
  }, [showTimer]);

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
      // Fades in, then shrinks toward the target until the wait is over.
      animation: `morkahja-frame-timer-shrink ${shownTimer.timer.durationMs}ms linear -${shownTimer.elapsedMs}ms forwards, `
        + `morkahja-frame-timer-fade-in ${TIMER_FADE_IN_MS}ms ease-out`,
    };
    timerBars = (
      <>
        <div
          key={`l${shownTimer.timer.id}`}
          style={{
            ...barBase,
            left: segments.left.from,
            width: segments.left.to - segments.left.from,
            transformOrigin: 'right center',
          }}
        />
        <div
          key={`r${shownTimer.timer.id}`}
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
