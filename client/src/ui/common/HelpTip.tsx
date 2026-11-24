import { useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { GameTooltipFrame, gameTooltipFrameStyle } from '../game/GameTooltip.js';
import { encounterTooltipFrameStyle } from '../game/encounterTooltip.js';
import { useTipsEnabled } from '../tips.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';

/**
 * A small "?" that explains the part of the screen next to it, in the frame
 * every game tooltip has (Babuni, 2026-11-23). Hover or tap shows it. Hidden
 * entirely when Tips and tutorial is turned off in the settings.
 */

const buttonStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 18,
  height: 18,
  padding: 0,
  borderRadius: '50%',
  border: '1px solid rgba(255, 204, 102, 0.8)',
  background: 'rgba(51, 0, 0, 0.85)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'help',
  pointerEvents: 'auto',
};

/** As wide as there is room for, up to a comfortable reading width. */
const TOOLTIP_MAX_WIDTH_PX = 300;

const tooltipStyle: CSSProperties = {
  ...gameTooltipFrameStyle,
  // The encounter's solution tooltips' text (Babuni, 2026-11-24).
  padding: encounterTooltipFrameStyle.padding,
  fontSize: encounterTooltipFrameStyle.fontSize,
  lineHeight: encounterTooltipFrameStyle.lineHeight,
  // On the page itself, so no panel or scroll area can cut it off.
  position: 'fixed',
  zIndex: 1000,
  margin: 0,
  pointerEvents: 'none',
};

/** Above the "?" and centred on it, kept inside the window. */
function placement(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(TOOLTIP_MAX_WIDTH_PX, window.innerWidth - 16);
  const half = width / 2;
  const centre = Math.min(window.innerWidth - half - 8, Math.max(half + 8, rect.left + rect.width / 2));
  return { width, left: centre - half, bottom: window.innerHeight - rect.top + 6 };
}

export default function HelpTip({ label, text, disabled = false }: {
  /** For screen readers, for example "What is equipment?". */
  label: string;
  text: string;
  disabled?: boolean;
}) {
  const enabled = useTipsEnabled();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // After a touch the browser sends mouse events too; a tap must not close it again.
  const lastTouchAtRef = useRef(-Infinity);
  const recentTouch = (): boolean => performance.now() - lastTouchAtRef.current < 900;
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onMouseEnter={() => {
          if (!recentTouch()) {
            setOpen(true);
          }
        }}
        onMouseLeave={() => {
          if (!recentTouch()) {
            setOpen(false);
          }
        }}
        className="morkahja-panel-button"
        onPointerDown={(event) => {
          pulse('help');
          if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            lastTouchAtRef.current = performance.now();
          }
        }}
        ref={buttonRef}
        style={{ padding: 0, pointerEvents: disabled ? 'none' : 'auto' }}
        type="button"
      >
        <span className="morkahja-panel-button-visual" style={{ ...buttonStyle, animation: pressAnimation(isPressed('help')) }}>?</span>
      </button>
      {open && buttonRef.current ? createPortal(
        <div role="tooltip" style={{ ...tooltipStyle, ...placement(buttonRef.current) }}>
          <GameTooltipFrame />
          {text}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
