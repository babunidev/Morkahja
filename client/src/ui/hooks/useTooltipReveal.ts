import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useLayoutMode } from '../layout/useLayoutMode.js';

export const TOOLTIP_LONG_PRESS_MS = 420;

type TooltipTarget = HTMLElement;
type TooltipPointerEvent = PointerEvent<TooltipTarget>;
type TooltipMouseEvent = MouseEvent<TooltipTarget>;
type TooltipFocusEvent = FocusEvent<TooltipTarget>;

export interface TooltipRevealCallbacks {
  onShow: (event: TooltipPointerEvent | TooltipMouseEvent | TooltipFocusEvent) => void;
  onHide: () => void;
}

function isMobilePortraitLayout(mode: string): boolean {
  return mode === 'mobile-portrait';
}

function useTooltipRevealMode() {
  const { mode } = useLayoutMode();
  return isMobilePortraitLayout(mode);
}

/** Hover/focus tooltips on desktop; long-press on mobile portrait. */
export function useTooltipReveal(enabled = true) {
  const mobile = useTooltipRevealMode();
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

  const show = useCallback(() => {
    if (!enabled) {
      return;
    }

    setVisible(true);
  }, [enabled]);

  const onPointerDown = useCallback((_event: TooltipPointerEvent) => {
    if (!enabled || !mobile) {
      return;
    }

    clearTimer();
    timerRef.current = window.setTimeout(show, TOOLTIP_LONG_PRESS_MS);
  }, [clearTimer, enabled, mobile, show]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!enabled) {
      hide();
    }
  }, [enabled, hide]);

  const handlers = enabled
    ? mobile
      ? {
          onPointerDown,
          onPointerUp: hide,
          onPointerCancel: hide,
          onPointerLeave: hide,
        }
      : {
          onMouseEnter: show,
          onMouseLeave: hide,
          onFocus: show,
          onBlur: hide,
        }
    : {};

  return {
    visible: enabled && visible,
    handlers,
    hide,
    show,
  };
}

/** Named targets (e.g. dashboard nav buttons). */
export function useTooltipRevealGroup() {
  const mobile = useTooltipRevealMode();
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

    if (mobile) {
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

    return {
      onMouseEnter: () => {
        show(id);
      },
      onMouseLeave: hide,
      onFocus: () => {
        show(id);
      },
      onBlur: hide,
    };
  }, [clearTimer, hide, mobile, show]);

  const isVisible = useCallback((id: string, enabled: boolean) => (
    enabled && activeId === id
  ), [activeId]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { bind, hide, isVisible };
}

/** Per-control bindings with show/hide side effects (solutions, avatar creation). */
export function useTooltipRevealBinding(enabled = true) {
  const mobile = useTooltipRevealMode();
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const bind = useCallback((callbacks: TooltipRevealCallbacks) => {
    if (!enabled) {
      return {};
    }

    if (mobile) {
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

    return {
      onPointerEnter: callbacks.onShow,
      onPointerLeave: callbacks.onHide,
      onFocus: callbacks.onShow,
      onBlur: callbacks.onHide,
    };
  }, [clearTimer, enabled, mobile]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return bind;
}
