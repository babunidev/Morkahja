import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { SlotStateDto } from '@shared/contracts';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../../sfx.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

const LOCK_ICON = '/UI/01_1_SignIn/LOCK.png';
const FRIENDS_ICON = '/UI/07_FriendsMenu/FriendsButt.webp';

const SLOT_OPTIONS: { value: SlotStateDto; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'friends_only', label: 'Friends only' },
  { value: 'locked', label: 'Locked' },
];

const slotStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  position: 'relative',
};

const triggerStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const indicatorStyle: CSSProperties = {
  display: 'block',
  width: 'clamp(22px, 4.2vw, 32px)',
  height: 'auto',
  objectFit: 'contain',
  filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5))',
};

const menuStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 40,
  display: 'grid',
  gap: 4,
  minWidth: 148,
  padding: '6px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 10,
  background: 'rgba(12, 7, 5, 0.96)',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.55), 0 0 12px rgba(255, 204, 102, 0.18)',
  pointerEvents: 'auto',
};

const menuOptionStyle: CSSProperties = {
  margin: 0,
  padding: '7px 10px',
  border: '1px solid rgba(255, 204, 102, 0.28)',
  borderRadius: 8,
  background: 'rgba(24, 14, 8, 0.92)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  lineHeight: 1.2,
  textAlign: 'left',
  cursor: 'pointer',
};

const menuOptionActiveStyle: CSSProperties = {
  borderColor: 'rgba(255, 204, 102, 0.82)',
  background: 'rgba(48, 28, 12, 0.96)',
  color: '#ffcc66',
};

function slotIndicator(slotState: SlotStateDto, animationDelayMs: number): ReactNode {
  if (slotState === 'locked') {
    return (
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={LOCK_ICON}
        style={indicatorStyle}
      />
    );
  }

  if (slotState === 'friends_only') {
    return (
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={FRIENDS_ICON}
        style={indicatorStyle}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="morkahja-party-slot-dot"
      style={animationDelayMs > 0 ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    />
  );
}

export function PartyEmptySlot({
  animationDelayMs = 0,
  canManage = false,
  menuOpen = false,
  onMenuOpenChange,
  onSlotStateChange,
  slotIndex,
  slotState,
}: {
  animationDelayMs?: number;
  canManage?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onSlotStateChange?: (slotIndex: number, slotState: SlotStateDto) => void;
  slotIndex: number;
  slotState: SlotStateDto;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const indicator = slotIndicator(slotState, animationDelayMs);
  const ariaLabel = `Player ${slotIndex + 1} slot ${
    slotState === 'locked'
      ? 'locked'
      : slotState === 'friends_only'
        ? 'friends only'
        : 'open'
  }`;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        onMenuOpenChange?.(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [menuOpen, onMenuOpenChange]);

  function handleSlotClick(): void {
    if (!canManage) {
      return;
    }

    playSfx(DEFAULT_BUTTON_SOUND);
    onMenuOpenChange?.(!menuOpen);
  }

  function handleOptionSelect(nextState: SlotStateDto): void {
    playSfx(DEFAULT_BUTTON_SOUND);
    onMenuOpenChange?.(false);

    if (nextState === slotState) {
      return;
    }

    onSlotStateChange?.(slotIndex, nextState);
  }

  return (
    <div
      aria-label={ariaLabel}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      ref={rootRef}
      style={slotStyle}
    >
      {canManage ? (
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`${ariaLabel}, change setting`}
          onClick={handleSlotClick}
          style={triggerStyle}
          type="button"
        >
          {indicator}
        </button>
      ) : (
        indicator
      )}
      {menuOpen && canManage ? (
        <div
          aria-label="Party slot settings"
          role="menu"
          style={menuStyle}
        >
          {SLOT_OPTIONS.map((option) => {
            const active = option.value === slotState;
            return (
              <button
                aria-checked={active}
                key={option.value}
                onClick={() => {
                  handleOptionSelect(option.value);
                }}
                role="menuitemradio"
                style={{
                  ...menuOptionStyle,
                  ...(active ? menuOptionActiveStyle : {}),
                }}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default PartyEmptySlot;
