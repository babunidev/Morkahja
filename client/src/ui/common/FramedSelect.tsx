import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { simpleFrameStyle } from './simpleFrame.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

/**
 * A dropdown in the game's look (Babuni's direction, 2026-11-13): a framed
 * button, and a framed list in the same colours below it. Replaces a native
 * <select>, whose open list the browser draws in its own style.
 */
export interface FramedSelectOption {
  value: string;
  label: string;
}

const BUTTON_BACKGROUND = 'rgba(51, 0, 0, 0.82)';
const LIST_BACKGROUND = 'rgba(34, 6, 3, 0.97)';

const buttonVisualStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  width: '100%',
  minHeight: 30,
  padding: '4px 10px',
  ...simpleFrameStyle({ background: BUTTON_BACKGROUND, opacity: 0.94 }),
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.8rem',
  lineHeight: 1.2,
  textAlign: 'left',
};

const buttonLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const chevronStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: '0.7rem',
  opacity: 0.85,
  transition: 'transform 160ms ease',
};

const listStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 10000,
  margin: 0,
  padding: 6,
  listStyle: 'none',
  display: 'grid',
  gap: 2,
  maxHeight: 'min(50vh, 260px)',
  overflowY: 'auto',
  scrollbarWidth: 'none',
  ...simpleFrameStyle({ background: LIST_BACKGROUND, opacity: 0.94 }),
  fontFamily: 'Georgia, serif',
  fontSize: '0.8rem',
};

const optionStyle: CSSProperties = {
  padding: '6px 10px',
  color: '#ffcc66',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const optionActiveStyle: CSSProperties = {
  background: 'rgba(120, 36, 14, 0.75)',
  color: '#ffe0a0',
};

const optionSelectedStyle: CSSProperties = {
  fontWeight: 700,
};

export function FramedSelect({
  ariaLabel,
  disabled = false,
  onChange,
  options,
  style,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: FramedSelectOption[];
  /** Outer button style (width and placement). */
  style?: CSSProperties;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<{ left: number; top: number; minWidth: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) {
      buttonRef.current?.focus();
    }
  }, []);

  const choose = useCallback((index: number) => {
    const option = options[index];
    if (option) {
      playSfx(DEFAULT_BUTTON_SOUND);
      if (option.value !== value) {
        onChange(option.value);
      }
    }
    close(true);
  }, [close, onChange, options, value]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const button = buttonRef.current;
    const list = listRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const listHeight = list?.offsetHeight ?? 0;
    const below = rect.bottom + 4;
    const fitsBelow = below + listHeight <= window.innerHeight - 8;
    const listWidth = Math.max(rect.width, list?.offsetWidth ?? 0);
    setPlacement({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - listWidth - 8)),
      top: fitsBelow ? below : Math.max(8, rect.top - 4 - listHeight),
      minWidth: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        close(false);
      }
    };
    // The list stays where it opened; scrolling or resizing closes it.
    const onMove = (event: Event): void => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) {
        return;
      }
      close(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [close, open]);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disabled) {
      return;
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setActiveIndex(selectedIndex);
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="morkahja-panel-button"
        disabled={disabled}
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          playSfx(DEFAULT_BUTTON_SOUND);
          setActiveIndex(selectedIndex);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        ref={buttonRef}
        style={style}
        type="button"
      >
        <span className="morkahja-panel-button-visual" style={buttonVisualStyle}>
          <span style={buttonLabelStyle}>{selected?.label ?? ''}</span>
          <span aria-hidden="true" style={{ ...chevronStyle, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </span>
      </button>
      {open
        ? createPortal(
          <ul
            aria-label={ariaLabel}
            id={listId}
            onKeyDown={onKeyDown}
            ref={listRef}
            role="listbox"
            style={{
              ...listStyle,
              left: placement?.left ?? 0,
              top: placement?.top ?? 0,
              minWidth: placement?.minWidth,
              visibility: placement ? 'visible' : 'hidden',
            }}
          >
            {options.map((option, index) => (
              <li
                aria-selected={index === selectedIndex}
                key={`${option.value}-${index}`}
                onClick={() => choose(index)}
                onPointerEnter={() => setActiveIndex(index)}
                role="option"
                style={{
                  ...optionStyle,
                  ...(index === activeIndex ? optionActiveStyle : {}),
                  ...(index === selectedIndex ? optionSelectedStyle : {}),
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          document.body,
        )
        : null}
    </>
  );
}

export default FramedSelect;
