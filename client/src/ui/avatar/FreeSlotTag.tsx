import { useLayoutEffect, useRef, type CSSProperties } from 'react';

/**
 * "Free slot" (Babuni, 2026-11-26): a quiet notice instead of a popup. On the
 * avatar it blinks softly, so the player notices it by themselves. When the
 * avatar's card opens, the same tag flies from the avatar to the empty
 * equipment slot and hovers there, pulsing, until an item is equipped.
 */

export const FREE_SLOT_TEXT = 'Free slot';
/** The tag on the avatar; the slot's tag flies in from it. */
const SOURCE_ATTR = 'data-free-slot-source';
const FLIGHT_MS = 650;

const tagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid rgba(255, 204, 102, 0.85)',
  background: 'rgba(51, 0, 0, 0.92)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.62rem, 2.4vw, 0.74rem)',
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  boxShadow: '0 0 10px rgba(255, 204, 102, 0.35), 0 3px 8px rgba(0, 0, 0, 0.55)',
  pointerEvents: 'none',
  userSelect: 'none',
};

const avatarPlacementStyle: CSSProperties = {
  // Top centre of the portrait, clear of the gem (top left) and the choice badge (top right).
  position: 'absolute',
  left: '50%',
  top: '2%',
  zIndex: 8,
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
};

const slotPlacementStyle: CSSProperties = {
  // Across the slot's lower edge, so it never covers the "Equipment" heading.
  position: 'absolute',
  left: '50%',
  bottom: -9,
  zIndex: 3,
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
};

const KEYFRAMES = `
@keyframes morkahja-free-slot-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@keyframes morkahja-free-slot-hover {
  0%, 100% { transform: translateY(0); box-shadow: 0 0 8px rgba(255, 204, 102, 0.3), 0 3px 8px rgba(0, 0, 0, 0.55); }
  50% { transform: translateY(-3px); box-shadow: 0 0 16px rgba(255, 204, 102, 0.7), 0 3px 8px rgba(0, 0, 0, 0.55); }
}
@media (prefers-reduced-motion: reduce) {
  .morkahja-free-slot-tag { animation: none !important; }
}
`;

/**
 * On the avatar: blinks softly while a slot is free and an item could fill it.
 * `away` hides it while the card is open (the tag "moved" to the slot); it
 * stays in place, invisible, so the slot's tag can fly from where it was.
 */
export function FreeSlotAvatarTag({ visible, away = false }: { visible: boolean; away?: boolean }) {
  if (!visible) {
    return null;
  }
  return (
    <span style={{ ...avatarPlacementStyle, opacity: away ? 0 : 1, transition: 'opacity 200ms ease' }}>
      <style>{KEYFRAMES}</style>
      <span
        {...{ [SOURCE_ATTR]: '' }}
        aria-label="Free equipment slot. Open your avatar to equip an item."
        className="morkahja-free-slot-tag"
        role="status"
        style={{ ...tagStyle, animation: away ? 'none' : 'morkahja-free-slot-blink 1.6s ease-in-out infinite' }}
      >
        {FREE_SLOT_TEXT}
      </span>
    </span>
  );
}

/**
 * Above the free slot. When it first appears it flies in from the avatar's
 * tag, if that tag is on screen; otherwise it simply fades in. It sits
 * across the slot's lower edge and keeps hovering there.
 */
export function FreeSlotSlotTag() {
  const outerRef = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const target = outerRef.current;
    if (!target || typeof target.animate !== 'function') {
      return;
    }
    const reduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Where the avatar's tag is now, before the card covers anything.
    const from = document.querySelector(`[${SOURCE_ATTR}]`)?.getBoundingClientRect();
    // The card lays itself out over a few frames: wait until the slot stops
    // moving, hidden meanwhile, then fly from the avatar to it.
    target.style.opacity = '0';
    let frame = 0;
    let handle = 0;
    let last: DOMRect | null = null;
    let flying: HTMLElement | null = null;
    const start = (to: DOMRect) => {
      target.style.opacity = '';
      if (reduced || !from || from.width === 0 || to.width === 0) {
        target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
        return;
      }
      const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      // The card clips what is outside it, so a copy flies above everything
      // and the tag in the slot shows when it lands.
      const flyer = target.cloneNode(true) as HTMLElement;
      Object.assign(flyer.style, {
        position: 'fixed',
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        margin: '0',
        zIndex: '1000',
        pointerEvents: 'none',
      });
      document.body.appendChild(flyer);
      target.style.opacity = '0';
      flying = flyer;
      const flight = flyer.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.9 },
          { transform: 'translate(0, 0)', opacity: 1 },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' },
      );
      const land = () => {
        flyer.remove();
        flying = null;
        target.style.opacity = '';
      };
      flight.onfinish = land;
      flight.oncancel = land;
    };
    const step = () => {
      const rect = target.getBoundingClientRect();
      const settled = rect.width > 0 && last !== null
        && Math.abs(rect.left - last.left) < 0.5 && Math.abs(rect.top - last.top) < 0.5;
      if (settled || frame >= 30) {
        start(rect);
        return;
      }
      last = rect;
      frame += 1;
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(handle);
      flying?.remove();
      target.style.opacity = '';
    };
  }, []);
  return (
    <span style={slotPlacementStyle}>
      <style>{KEYFRAMES}</style>
      <span ref={outerRef} style={{ display: 'inline-block' }}>
        <span
          aria-hidden="true"
          className="morkahja-free-slot-tag"
          style={{ ...tagStyle, display: 'inline-block', animation: `morkahja-free-slot-hover 1.4s ease-in-out ${FLIGHT_MS}ms infinite` }}
        >
          {FREE_SLOT_TEXT}
        </span>
      </span>
    </span>
  );
}
