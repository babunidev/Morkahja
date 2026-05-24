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

/** Touch-primary devices; desktop mice report hover even on hybrid hardware. */
const HOVER_TOOLTIP_QUERY = '(hover: hover)';

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

  return window.matchMedia(HOVER_TOOLTIP_QUERY).matches;
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
    const mediaQuery = window.matchMedia(HOVER_TOOLTIP_QUERY);

    function update(): void {
      setHoverCapable(mediaQuery.matches);
    }

    update();
    mediaQuery.addEventListener('change', update);

    return () => {
      mediaQuery.removeEventListener('change', update);
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

  const onPointerDown = useCallback((_event: TooltipPointerEvent) => {
    if (!enabled || !useLongPress) {
      return;
    }

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, TOOLTIP_LONG_PRESS_MS);
  }, [clearTimer, enabled, useLongPress]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!enabled) {
      hide();
    }
  }, [enabled, hide]);

  const handlers = enabled
    ? useLongPress
      ? {
          onPointerDown,
          onPointerUp: hide,
          onPointerCancel: hide,
          onPointerLeave: hide,
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
        onPointerUp: hide,
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

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const bind = useCallback((callbacks: TooltipRevealCallbacks): TooltipRevealHandlerProps => {
    if (!enabled) {
      return {};
    }

    if (useLongPress) {
      return {
        onPointerDown: (event: TooltipPointerEvent) => {
          clearTimer();
          timerRef.current = window.setTimeout(() => {
            callbacks.onShow(event);
          }, TOOLTIP_LONG_PRESS_MS);
        },
        onPointerUp: () => {
          clearTimer();
          callbacks.onHide();
        },
        onPointerCancel: () => {
          clearTimer();
          callbacks.onHide();
        },
        onPointerLeave: () => {
          clearTimer();
          callbacks.onHide();
        },
      };
    }

    return hoverHandlers(callbacks);
  }, [clearTimer, enabled, useLongPress]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return bind;
}
