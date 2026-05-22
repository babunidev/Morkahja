import { useEffect, useState, type CSSProperties } from 'react';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import MusicVolumeSlider from './MusicVolumeSlider.js';
import SfxVolumeSlider from './SfxVolumeSlider.js';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 6,
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
  gap: 16,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleGroupStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.45rem 0.65rem',
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const playerNameStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '1.05rem',
  fontWeight: 400,
  fontFamily: 'Georgia, serif',
  letterSpacing: '0.02em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 'min(52vw, 220px)',
};

const closeButtonStyle: CSSProperties = {
  minWidth: 72,
  minHeight: 34,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const settingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const actionButtonStyle: CSSProperties = {
  minWidth: 120,
  minHeight: 38,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
};

export function SettingsScreen({
  onClose,
  onLogout,
  open,
  playerName = '',
}: {
  onClose: () => void;
  onLogout: () => void;
  open: boolean;
  playerName?: string;
}) {
  const displayName = playerName.trim();
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
      aria-label="Settings"
      onClick={onClose}
      role="presentation"
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="settings-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <div style={titleGroupStyle}>
            <h2 id="settings-overlay-title" style={titleStyle}>SETTINGS</h2>
            {displayName ? (
              <p aria-label={`Player name: ${displayName}`} style={playerNameStyle}>
                {displayName}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onClose();
            }}
            style={closeButtonStyle}
            type="button"
          >
            Close
          </button>
        </header>
        <MusicVolumeSlider />
        <SfxVolumeSlider />
        <div style={settingRowStyle}>
          <span>Logout</span>
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onLogout();
            }}
            style={actionButtonStyle}
            type="button"
          >
            End Session
          </button>
        </div>
      </section>
    </div>
  );
}

export default SettingsScreen;
