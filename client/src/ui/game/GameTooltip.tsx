import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  placeTooltipTowardCenter,
  type CornerAnchoredPlacement,
  type TooltipCorner,
} from '../hooks/anchoredTooltip.js';
import {
  useTooltipRevealBinding,
  type TooltipRevealCallbacks,
  type TooltipRevealHandlerProps,
} from '../hooks/useTooltipReveal.js';
import { LineFrame } from '../common/LineFrame.js';
import { frameDividerStyle } from '../common/simpleFrame.js';
import { TOOLTIP_FRAME, cornerLegAt } from './blocks/encounterFrameGeometry.js';

/**
 * One tooltip style for the game screen (Babuni's direction, 2026-11-12):
 * opens toward the middle of its bounds (the encounter picture, or the whole
 * game screen for the menu and avatar), anchored to its item by a corner, or by
 * the middle of an edge for a centred item, with a gold marker pointing at the
 * item; appears after a short hover delay and fades in and out.
 */
export const GAME_TOOLTIP_DELAY_MS = 350;
export const GAME_TOOLTIP_FADE_MS = 120;
export const TOOLTIP_GOLD = '#ffcc66';
const CORNER_BRACKET_PX = 14;
/** Where the tooltip frame's outer line cuts its corners. */
const MARKER_CORNER_LEG_PX = cornerLegAt(TOOLTIP_FRAME.outset, TOOLTIP_FRAME.cut);
const MARKER_CUT_LINE_PX = MARKER_CORNER_LEG_PX * Math.SQRT2 + 4;

/** The encounter picture; the default bounds for tooltips on the encounter. */
export const ENCOUNTER_PICTURE_SELECTOR = '[data-morkahja-encounter-art]';
/** The whole game screen; bounds for the action menu and the party strip. */
export const GAME_SCREEN_SELECTOR = '[data-morkahja-game-screen]';

const FADE_KEYFRAMES = '@keyframes morkahja-game-tooltip-in { from { opacity: 0; } to { opacity: 1; } }'
  + ' @keyframes morkahja-game-tooltip-out { from { opacity: 1; } to { opacity: 0; } }';

export const TOOLTIP_BACKGROUND = 'rgba(12, 9, 8, 0.96)';
export const TOOLTIP_SHADOW = '0 6px 10px rgba(0, 0, 0, 0.5)';

/**
 * The look every game tooltip shares; its frame is a LineFrame with
 * TOOLTIP_FRAME (see GameTooltipFrame), so the padding clears the lines.
 */
export const gameTooltipFrameStyle: CSSProperties = {
  padding: '9px 13px',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.68rem, 2.8vw, 0.82rem)',
  lineHeight: 1.3,
  textAlign: 'center',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxSizing: 'border-box',
  isolation: 'isolate',
};

/** The tooltip frame: put inside a positioned tooltip box. */
export function GameTooltipFrame({ background = TOOLTIP_BACKGROUND }: { background?: string }) {
  return <LineFrame background={background} shadow={TOOLTIP_SHADOW} spec={TOOLTIP_FRAME} />;
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: TOOLTIP_GOLD,
  fontSize: 'clamp(0.78rem, 3vw, 0.92rem)',
  fontWeight: 700,
  lineHeight: 1.15,
};

const cardLineStyle: CSSProperties = {
  margin: '1px 0 0',
  color: '#f7efe0',
};

/**
 * The line between a tooltip's title and its text (Babuni's direction,
 * 2026-11-13, after the reward tooltips): the frame's line plus a gapped
 * line, its ends meeting the tooltip frame. `bleed` = the tooltip's side
 * padding minus the frame's depth.
 */
export function TooltipDivider({ bleed = 6 }: { bleed?: number }) {
  // Stretches across even inside a centring flex column.
  return <div aria-hidden="true" style={{ ...frameDividerStyle({ side: 'top', bleed }), alignSelf: 'stretch', margin: '4px 0 3px' }} />;
}

/** A small text tooltip: a gold title and optional lines below it. */
export function GameTooltipCard({ title, lines = [] }: { title: string; lines?: string[] }) {
  return (
    <>
      <p style={cardTitleStyle}>{title}</p>
      {lines.length > 0 ? <TooltipDivider /> : null}
      {lines.map((line) => (
        <p key={line} style={cardLineStyle}>{line}</p>
      ))}
    </>
  );
}

/**
 * A gold marker where the tooltip touches its item: a bright line along the
 * frame's cut corner with a small diamond on it, or for a centred item a short
 * edge line with a diamond in the middle of the top or bottom edge.
 */
export function tooltipCornerMarker(corner: TooltipCorner): ReactNode {
  const top = corner.startsWith('top');
  const diamond: CSSProperties = {
    position: 'absolute',
    width: 7,
    height: 7,
    margin: -3.5,
    background: TOOLTIP_GOLD,
    transform: 'rotate(45deg)',
    boxShadow: '0 0 6px rgba(255, 204, 102, 0.6)',
    pointerEvents: 'none',
  };
  if (corner.endsWith('center')) {
    return (
      <>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            [top ? 'top' : 'bottom']: 0,
            width: 2 * CORNER_BRACKET_PX,
            height: 2,
            background: TOOLTIP_GOLD,
            transform: 'translateX(-50%)',
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        />
        <span aria-hidden="true" style={{ ...diamond, left: '50%', [top ? 'top' : 'bottom']: 0.5 }} />
      </>
    );
  }
  const left = corner.endsWith('left');
  const horizontal = left ? 'left' : 'right';
  const vertical = top ? 'top' : 'bottom';
  // The cut runs up to the right at the top-left and bottom-right corners.
  const angle = left === top ? -45 : 45;
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          // Centred on the cut, as long as the cut plus a little.
          [horizontal]: MARKER_CORNER_LEG_PX / 2 - MARKER_CUT_LINE_PX / 2,
          [vertical]: MARKER_CORNER_LEG_PX / 2 - 1,
          width: MARKER_CUT_LINE_PX,
          height: 2,
          background: TOOLTIP_GOLD,
          borderRadius: 1,
          transform: `rotate(${angle}deg)`,
          boxShadow: '0 0 4px rgba(255, 204, 102, 0.5)',
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden="true"
        style={{ ...diamond, [horizontal]: MARKER_CORNER_LEG_PX / 2, [vertical]: MARKER_CORNER_LEG_PX / 2 }}
      />
    </>
  );
}

/**
 * Where a tooltip-like element goes: toward the middle of `boundsSelector`'s
 * element from `trigger` (placeTooltipTowardCenter), converted to the
 * element's own positioning parent, which may be a scaled stage.
 */
export function placeNearTrigger(
  element: HTMLElement,
  trigger: Element,
  boundsSelector: string,
): CornerAnchoredPlacement | null {
  const container = element.offsetParent;
  if (!(container instanceof HTMLElement) || !trigger.isConnected) {
    return null;
  }
  const containerRect = container.getBoundingClientRect();
  const tooltipRect = element.getBoundingClientRect();
  if (tooltipRect.width <= 0 || tooltipRect.height <= 0) {
    return null;
  }
  const boundsRect = document.querySelector(boundsSelector)?.getBoundingClientRect() ?? containerRect;
  const next = placeTooltipTowardCenter(boundsRect, trigger.getBoundingClientRect(), tooltipRect);
  // Measured in screen pixels; positioned in the (possibly scaled) stage's own pixels.
  const scale = container.offsetWidth > 0 ? containerRect.width / container.offsetWidth : 1;
  return {
    ...next,
    left: (next.left + boundsRect.left - containerRect.left) / scale,
    top: (next.top + boundsRect.top - containerRect.top) / scale,
  };
}

/**
 * A framed card that opens from an element like a game tooltip (Babuni's
 * direction, 2026-11-13: the avatar details): toward the middle of the game
 * screen, above or below, anchored by a corner or, for a centred element, by
 * the middle of an edge, with the gold marker. It stays until closed and can
 * hold buttons.
 */
export function AnchoredGamePopover({
  anchorRef,
  boundsSelector = GAME_SCREEN_SELECTOR,
  children,
  width = 200,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  boundsSelector?: string;
  children: ReactNode;
  width?: number;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<CornerAnchoredPlacement | null>(null);

  useLayoutEffect(() => {
    const element = popoverRef.current;
    const trigger = anchorRef.current;
    if (!element || !trigger) {
      return undefined;
    }
    const place = (): void => {
      const next = placeNearTrigger(element, trigger, boundsSelector);
      if (next) {
        setPlacement((previous) => (
          previous
          && Math.abs(previous.left - next.left) < 0.5
          && Math.abs(previous.top - next.top) < 0.5
          && previous.corner === next.corner
            ? previous
            : next
        ));
      }
    };
    place();
    const frame = window.requestAnimationFrame(place);
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [anchorRef, boundsSelector]);

  return (
    <div
      ref={popoverRef}
      style={{
        ...gameTooltipFrameStyle,
        position: 'absolute',
        zIndex: 60,
        width,
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        visibility: placement ? 'visible' : 'hidden',
        animation: placement ? `morkahja-game-tooltip-in ${GAME_TOOLTIP_FADE_MS}ms ease-out` : 'none',
      }}
    >
      <style>{FADE_KEYFRAMES}</style>
      <GameTooltipFrame />
      {children}
      {placement ? tooltipCornerMarker(placement.corner) : null}
    </div>
  );
}

export interface GameTooltipContent {
  /** Identifies the item; moving to another item cross-fades. */
  key: string;
  body: ReactNode;
  /** Width and any extra frame styling for this tooltip. */
  shellStyle?: CSSProperties;
}

interface ActiveTooltip extends GameTooltipContent {
  trigger: HTMLElement;
}

interface FadingTooltip {
  id: number;
  body: ReactNode;
  shellStyle?: CSSProperties;
  placement: CornerAnchoredPlacement;
}

type ShowEvent = Parameters<TooltipRevealCallbacks['onShow']>[0];

export function useGameTooltip({
  boundsSelector = ENCOUNTER_PICTURE_SELECTOR,
  delayMs = GAME_TOOLTIP_DELAY_MS,
}: { boundsSelector?: string; delayMs?: number } = {}) {
  const { bind, consumeLongPressActivation } = useTooltipRevealBinding();
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [placement, setPlacement] = useState<CornerAnchoredPlacement | null>(null);
  const [fading, setFading] = useState<FadingTooltip | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const shownRef = useRef<{ active: ActiveTooltip | null; placement: CornerAnchoredPlacement | null }>({
    active: null,
    placement: null,
  });
  shownRef.current = { active, placement };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const retire = useCallback(() => {
    const shown = shownRef.current;
    if (shown.active && shown.placement) {
      setFading({ id: Date.now(), body: shown.active.body, shellStyle: shown.active.shellStyle, placement: shown.placement });
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    retire();
    setActive(null);
    setPlacement(null);
  }, [clearTimer, retire]);

  const open = useCallback((trigger: HTMLElement, content: GameTooltipContent, immediate: boolean) => {
    clearTimer();
    const show = (): void => {
      if (shownRef.current.active?.key === content.key) {
        setActive({ ...content, trigger });
        return;
      }
      retire();
      setActive({ ...content, trigger });
      setPlacement(null);
    };
    if (immediate) {
      show();
    } else {
      timerRef.current = window.setTimeout(show, delayMs);
    }
  }, [clearTimer, delayMs, retire]);

  /** Event handlers for one trigger element; `content` is read when it shows. */
  const bindTooltip = useCallback((content: () => GameTooltipContent | null): TooltipRevealHandlerProps => bind({
    onShow: (event: ShowEvent) => {
      const trigger = event.currentTarget;
      const next = content();
      if (!(trigger instanceof HTMLElement) || !next) {
        return;
      }
      // A mouse hover waits a moment; focus and a touch long press (which has
      // already waited) show at once.
      const hover = event.type === 'mouseover' || event.type === 'mouseenter';
      open(trigger, next, !hover);
    },
    onHide: hide,
  }), [bind, hide, open]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!fading) {
      return undefined;
    }
    const timer = window.setTimeout(() => setFading(null), GAME_TOOLTIP_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [fading]);

  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!active || !element) {
      return;
    }

    const place = (): void => {
      const next = placeNearTrigger(element, active.trigger, boundsSelector);
      if (next) {
        setPlacement(next);
      }
    };

    place();
    const frame = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(frame);
  }, [active, boundsSelector]);

  const shellBase: CSSProperties = {
    ...gameTooltipFrameStyle,
    position: 'absolute',
    zIndex: 60,
    pointerEvents: 'none',
  };

  const layer = (
    <>
      <style>{FADE_KEYFRAMES}</style>
      {active ? (
        <div
          aria-live="polite"
          ref={tooltipRef}
          role="tooltip"
          style={{
            ...shellBase,
            ...active.shellStyle,
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            // Measured first, then faded in place: never flashes in the wrong spot.
            visibility: placement ? 'visible' : 'hidden',
            animation: placement ? `morkahja-game-tooltip-in ${GAME_TOOLTIP_FADE_MS}ms ease-out` : 'none',
          }}
        >
          <GameTooltipFrame />
          {active.body}
          {placement ? tooltipCornerMarker(placement.corner) : null}
        </div>
      ) : null}
      {fading ? (
        <div
          aria-hidden="true"
          key={fading.id}
          style={{
            ...shellBase,
            ...fading.shellStyle,
            left: fading.placement.left,
            top: fading.placement.top,
            animation: `morkahja-game-tooltip-out ${GAME_TOOLTIP_FADE_MS}ms ease-in forwards`,
          }}
        >
          <GameTooltipFrame />
          {fading.body}
          {tooltipCornerMarker(fading.placement.corner)}
        </div>
      ) : null}
    </>
  );

  return { bindTooltip, layer, hide, consumeLongPressActivation, isShowing: active !== null };
}
