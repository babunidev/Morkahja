import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

/** Above encounter overlays, party slots, and reward fly animations. */
export const ENCOUNTER_TOOLTIP_Z_INDEX = 1000;

/** Shared encounter tooltip frame — matches SolutionBlock solution tooltips. */
export const encounterTooltipFrameStyle: CSSProperties = {
  position: 'absolute',
  zIndex: ENCOUNTER_TOOLTIP_Z_INDEX,
  width: 220,
  maxWidth: 220,
  maxHeight: 'min(42vh, 200px)',
  overflow: 'auto',
  padding: '7px 10px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.94)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  lineHeight: 1.25,
  textAlign: 'left',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

export const encounterTooltipTitleStyle: CSSProperties = {
  margin: '0 0 4px',
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

export function encounterTooltipAboveCenterStyle(): CSSProperties {
  return {
    left: '50%',
    bottom: '100%',
    transform: 'translate(-50%, -12px)',
  };
}

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
      <div
        style={{
          ...encounterTooltipTitleStyle,
          ...(!description && !detail ? { margin: 0 } : {}),
        }}
      >
        {label}
      </div>
      {description ? (
        <div style={encounterTooltipDescriptionStyle}>{description}</div>
      ) : null}
      {detail ? (
        <div style={encounterTooltipDetailStyle}>{detail}</div>
      ) : null}
    </div>
  );
}

/** Renders a tooltip in a top-level portal so it is not clipped by party/encounter stacking. */
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

  useLayoutEffect(() => {
    if (!visible) {
      setPositionStyle(null);
      return;
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

  if (!visible || !positionStyle) {
    return null;
  }

  return createPortal(
    <EncounterTooltip
      description={description}
      detail={detail}
      label={label}
      positionStyle={positionStyle}
    />,
    document.body,
  );
}
