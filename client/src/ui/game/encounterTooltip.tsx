import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { GameTooltipFrame, TooltipDivider } from './GameTooltip.js';

/** Above encounter overlays, party slots, and reward fly animations. */
export const ENCOUNTER_TOOLTIP_Z_INDEX = 1000;

/** Shared encounter tooltip frame — matches SolutionBlock solution tooltips. */
export const encounterTooltipFrameStyle: CSSProperties = {
  position: 'absolute',
  zIndex: ENCOUNTER_TOOLTIP_Z_INDEX,
  width: 220,
  maxWidth: 220,
  overflow: 'visible',
  padding: '10px 13px',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  lineHeight: 1.25,
  textAlign: 'left',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  pointerEvents: 'none',
  boxSizing: 'border-box',
  isolation: 'isolate',
};

export const encounterTooltipTitleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.86rem',
  fontWeight: 700,
  textAlign: 'center',
};

export const encounterTooltipDescriptionStyle: CSSProperties = {
  margin: '0 0 6px',
  whiteSpace: 'pre-wrap',
};

export const encounterTooltipDetailStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-line',
};

function portalPositionForAnchor(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();

  return {
    position: 'fixed',
    left: rect.left + rect.width / 2,
    top: rect.top,
    transform: 'translate(-50%, calc(-100% - 12px))',
    zIndex: ENCOUNTER_TOOLTIP_Z_INDEX,
  };
}

export function EncounterTooltip({
  label,
  description,
  detail,
  positionStyle,
}: {
  label: string;
  description?: string;
  detail?: string;
  positionStyle: CSSProperties;
}) {
  return (
    <div
      role="tooltip"
      style={{
        ...encounterTooltipFrameStyle,
        ...positionStyle,
      }}
    >
      <GameTooltipFrame background="rgba(12, 9, 8, 0.94)" />
      <div
        style={{
          ...encounterTooltipTitleStyle,
          ...(!description && !detail ? { margin: 0 } : {}),
        }}
      >
        {label}
      </div>
      {description || detail ? <TooltipDivider /> : null}
      {description ? (
        <div style={encounterTooltipDescriptionStyle}>{description}</div>
      ) : null}
      {detail ? (
        <div style={encounterTooltipDetailStyle}>{detail}</div>
      ) : null}
    </div>
  );
}

/** How long an anchored tooltip fades in and out. */
const ANCHORED_TOOLTIP_FADE_MS = 200;

/**
 * Renders a tooltip in a top-level portal so it is not clipped by party/encounter
 * stacking. It fades in where it belongs and fades out where it was.
 */
export function AnchoredEncounterTooltip({
  anchorRef,
  visible,
  label,
  description,
  detail,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  visible: boolean;
  label: string;
  description?: string;
  detail?: string;
}) {
  const [positionStyle, setPositionStyle] = useState<CSSProperties | null>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    if (!visible) {
      return undefined;
    }

    function updatePosition(): void {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      setPositionStyle(portalPositionForAnchor(anchor));
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, visible, label, description, detail]);

  // Fade in on the frame after it is placed; on hiding, fade out, then unmount.
  useEffect(() => {
    if (visible) {
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setShown(false));
    const timer = window.setTimeout(() => setPositionStyle(null), ANCHORED_TOOLTIP_FADE_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visible]);

  if (!positionStyle) {
    return null;
  }

  return createPortal(
    <EncounterTooltip
      description={description}
      detail={detail}
      label={label}
      positionStyle={{
        ...positionStyle,
        opacity: visible && shown ? 1 : 0,
        transition: `opacity ${ANCHORED_TOOLTIP_FADE_MS}ms ease`,
      }}
    />,
    document.body,
  );
}
