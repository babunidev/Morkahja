import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

export const TOOLTIP_LONG_PRESS_MS = 420;

/** Desktop mice and precise pointers — hover tooltips. */
const HOVER_TOOLTIP_QUERY = '(hover: hover) and (pointer: fine)';

/** Phones / tablets — long-press tooltips (also matches coarse pointers on hybrid devices). */
const TOUCH_TOOLTIP_QUERY = '(hover: none), (pointer: coarse)';

type TooltipTarget = HTMLElement;
type TooltipPointerEvent = PointerEvent<TooltipTarget>;
type TooltipMouseEvent = MouseEvent<TooltipTarget>;
type TooltipFocusEvent = FocusEvent<TooltipTarget>;

export interface TooltipRevealCallbacks {
  onShow: (event: TooltipPointerEvent | TooltipMouseEvent | TooltipFocusEvent) => void;
  onHide: () => void;
}

function readHoverCapable(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  if (window.matchMedia(TOUCH_TOOLTIP_QUERY).matches) {
    return false;
  }

  return window.matchMedia(HOVER_TOOLTIP_QUERY).matches;
}

function isTouchLikePointer(event: TooltipPointerEvent): boolean {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}

/** React clears `currentTarget` after the handler returns; keep a stable target for delayed show. */
function createTooltipShowEvent(
  pressTarget: TooltipTarget,
): TooltipPointerEvent {
  return { currentTarget: pressTarget, target: pressTarget } as unknown as TooltipPointerEvent;
}

function scheduleTooltipLongPressShow(
  pressTarget: TooltipTarget,
  callbacks: TooltipRevealCallbacks,
  clearTimer: () => void,
  timerRef: { current: number | null },
  longPressTriggeredRef: { current: boolean },
): void {
  longPressTriggeredRef.current = false;
  clearTimer();
  timerRef.current = window.setTimeout(() => {
    longPressTriggeredRef.current = true;
    callbacks.onShow(createTooltipShowEvent(pressTarget));
  }, TOOLTIP_LONG_PRESS_MS);
}

function longPressHandlers(
  callbacks: TooltipRevealCallbacks,
  clearTimer: () => void,
  timerRef: { current: number | null },
  longPressTriggeredRef: { current: boolean },
): TooltipRevealHandlerProps {
  return {
    onPointerDown: (event: TooltipPointerEvent) => {
      scheduleTooltipLongPressShow(
        event.currentTarget,
        callbacks,
        clearTimer,
        timerRef,
        longPressTriggeredRef,
      );
    },
    onPointerUp: () => {
      clearTimer();
      callbacks.onHide();
    },
    onPointerCancel: () => {
      clearTimer();
      longPressTriggeredRef.current = false;
      callbacks.onHide();
    },
    onPointerLeave: () => {
      clearTimer();
      longPressTriggeredRef.current = false;
      callbacks.onHide();
    },
  };
}

function eventTargetNode(target: TooltipMouseEvent['relatedTarget']): Node | null {
  return target instanceof Node ? target : null;
}

function isNodeInside(container: Node, node: Node | null): boolean {
  return node !== null && container.contains(node);
}

export type TooltipRevealHandlerProps = {
  onPointerDown?: (event: TooltipPointerEvent) => void;
  onPointerUp?: (event: TooltipPointerEvent) => void;
  onPointerCancel?: (event: TooltipPointerEvent) => void;
  onPointerLeave?: (event: TooltipPointerEvent) => void;
  onMouseOver?: (event: TooltipMouseEvent) => void;
  onMouseOut?: (event: TooltipMouseEvent) => void;
  onFocus?: (event: TooltipFocusEvent) => void;
  onBlur?: (event: TooltipFocusEvent) => void;
};

/** Long-press when the device cannot hover (typical phones). */
function useTooltipLongPressMode(): boolean {
  const [hoverCapable, setHoverCapable] = useState(readHoverCapable);

  useEffect(() => {
    const hoverQuery = window.matchMedia(HOVER_TOOLTIP_QUERY);
    const touchQuery = window.matchMedia(TOUCH_TOOLTIP_QUERY);

    function update(): void {
      setHoverCapable(readHoverCapable());
    }

    update();
    hoverQuery.addEventListener('change', update);
    touchQuery.addEventListener('change', update);

    return () => {
      hoverQuery.removeEventListener('change', update);
      touchQuery.removeEventListener('change', update);
    };
  }, []);

  return !hoverCapable;
}

function hoverHandlers(callbacks: TooltipRevealCallbacks): TooltipRevealHandlerProps {
  return {
    onMouseOver: (event: TooltipMouseEvent) => {
      if (!isNodeInside(event.currentTarget, eventTargetNode(event.relatedTarget))) {
        callbacks.onShow(event);
      }
    },
    onMouseOut: (event: TooltipMouseEvent) => {
      if (!isNodeInside(event.currentTarget, eventTargetNode(event.relatedTarget))) {
        callbacks.onHide();
      }
    },
    onFocus: callbacks.onShow,
    onBlur: callbacks.onHide,
  };
}

/** Hover/focus tooltips on desktop; long-press on touch-primary devices. */
export function useTooltipReveal(enabled = true) {
  const useLongPress = useTooltipLongPressMode();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const show = useCallback((event: TooltipMouseEvent | TooltipFocusEvent) => {
    if (!enabled) {
      return;
    }

    setVisible(true);
    void event;
  }, [enabled]);

  const longPressTriggeredRef = useRef(false);

  const onPointerDown = useCallback((_event: TooltipPointerEvent) => {
    if (!enabled || !useLongPress) {
      return;
    }

    longPressTriggeredRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setVisible(true);
    }, TOOLTIP_LONG_PRESS_MS);
  }, [clearTimer, enabled, useLongPress]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!enabled) {
      hide();
    }
  }, [enabled, hide]);

  const onPointerUp = useCallback(() => {
    clearTimer();
    hide();
  }, [clearTimer, hide]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
    longPressTriggeredRef.current = false;
    hide();
  }, [clearTimer, hide]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
    longPressTriggeredRef.current = false;
    hide();
  }, [clearTimer, hide]);

  const handlers = enabled
    ? useLongPress
      ? {
          onPointerDown,
          onPointerUp,
          onPointerCancel,
          onPointerLeave,
        }
      : hoverHandlers({
          onShow: show,
          onHide: hide,
        })
    : {};

  return {
    visible: enabled && visible,
    handlers,
    hide,
    show: () => {
      if (enabled) {
        setVisible(true);
      }
    },
  };
}

/** Named targets (e.g. dashboard nav buttons). */
export function useTooltipRevealGroup() {
  const useLongPress = useTooltipLongPressMode();
  const [activeId, setActiveId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setActiveId(null);
  }, [clearTimer]);

  const show = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const bind = useCallback((id: string, enabled: boolean) => {
    if (!enabled) {
      return {};
    }

    if (useLongPress) {
      return {
        onPointerDown: (_event: TooltipPointerEvent) => {
          clearTimer();
          timerRef.current = window.setTimeout(() => {
            show(id);
          }, TOOLTIP_LONG_PRESS_MS);
        },
        onPointerUp: () => {
          clearTimer();
        },
        onPointerCancel: hide,
        onPointerLeave: hide,
      };
    }

    return hoverHandlers({
      onShow: () => {
        show(id);
      },
      onHide: hide,
    });
  }, [clearTimer, hide, show, useLongPress]);

  const isVisible = useCallback((id: string, enabled: boolean) => (
    enabled && activeId === id
  ), [activeId]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { bind, hide, isVisible };
}

/** Per-control bindings with show/hide side effects (solutions, avatar creation). */
export function useTooltipRevealBinding(enabled = true) {
  const useLongPress = useTooltipLongPressMode();
  const timerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consumeLongPressActivation = useCallback(() => {
    if (!longPressTriggeredRef.current) {
      return false;
    }

    longPressTriggeredRef.current = false;
    return true;
  }, []);

  const bind = useCallback((callbacks: TooltipRevealCallbacks): TooltipRevealHandlerProps => {
    if (!enabled) {
      return {};
    }

    if (useLongPress) {
      return longPressHandlers(callbacks, clearTimer, timerRef, longPressTriggeredRef);
    }

    const hover = hoverHandlers(callbacks);
    const touchLongPress = longPressHandlers(
      callbacks,
      clearTimer,
      timerRef,
      longPressTriggeredRef,
    );

    return {
      ...hover,
      onPointerDown: (event: TooltipPointerEvent) => {
        if (isTouchLikePointer(event)) {
          touchLongPress.onPointerDown?.(event);
        }
      },
      onPointerUp: (event: TooltipPointerEvent) => {
        if (isTouchLikePointer(event)) {
          touchLongPress.onPointerUp?.(event);
          return;
        }

        clearTimer();
      },
      onPointerCancel: (event: TooltipPointerEvent) => {
        if (isTouchLikePointer(event)) {
          touchLongPress.onPointerCancel?.(event);
        }
      },
      onPointerLeave: (event: TooltipPointerEvent) => {
        if (isTouchLikePointer(event)) {
          touchLongPress.onPointerLeave?.(event);
        }
      },
    };
  }, [clearTimer, enabled, useLongPress]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { bind, consumeLongPressActivation };
}
