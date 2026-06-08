import { useEffect, useState, type CSSProperties } from 'react';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 12,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
  ...protectedOverlayTextStyle,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.35rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
  lineHeight: 1.2,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.9)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  textAlign: 'center',
};

const fileNameStyle: CSSProperties = {
  display: 'block',
  margin: '10px 0',
  color: '#ffcc66',
  fontWeight: 700,
  wordBreak: 'break-word',
};

export function RecoveryKeyInfoOverlay({
  onClose,
  open,
  recoveryFileName,
}: {
  onClose: () => void;
  open: boolean;
  recoveryFileName: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Recovery key information"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="recovery-key-info-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="recovery-key-info-title" style={titleStyle}>
            Recovery Key
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="recovery-key-info-close" />
        </header>
        <p style={bodyStyle}>
          Creating your journey will automatically download your recovery file.
          <span style={fileNameStyle}>{recoveryFileName || 'your-name.key'}</span>
          Keep it somewhere safe. Losing this file means permanent loss of access to your
          account and avatars.
        </p>
      </section>
    </div>
  );
}

export default RecoveryKeyInfoOverlay;
