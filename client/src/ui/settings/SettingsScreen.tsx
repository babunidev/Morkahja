import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { PanelButton } from '../common/PanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import {
  downloadRecoveryKey,
  loadIdentityKeypair,
  recoveryKeyFilename,
} from '../../sessionKeys.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AboutUsOverlay from '../dashboard/AboutUsOverlay.js';
import MusicVolumeSlider from './MusicVolumeSlider.js';
import SealOfNorghorSection from './SealOfNorghorSection.js';
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
  maxHeight: 'min(90vh, 720px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  overflow: 'hidden',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  ...protectedOverlayTextStyle,
};

const panelHeaderStyle: CSSProperties = {
  padding: '20px 18px 0',
};

const panelBodyWrapStyle: CSSProperties = {
  position: 'relative',
  minHeight: 0,
};

const panelBodyStyle: CSSProperties = {
  height: '100%',
  maxHeight: '100%',
  overflowY: 'auto',
  padding: '16px 18px 28px',
  boxSizing: 'border-box',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const scrollHintOverlayStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 48,
  display: 'grid',
  placeItems: 'end center',
  paddingBottom: 4,
  pointerEvents: 'none',
  background: 'linear-gradient(to bottom, rgba(12, 7, 5, 0), rgba(12, 7, 5, 0.94))',
};

const scrollHintButtonStyle: CSSProperties = {
  pointerEvents: 'auto',
  margin: 0,
  padding: '2px 14px 6px',
  border: 0,
  background: 'transparent',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '1.25rem',
  lineHeight: 1,
  cursor: 'pointer',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.85)',
  animation: 'morkahja-settings-scroll-hint-bounce 1.6s ease-in-out infinite',
};

const panelFooterStyle: CSSProperties = {
  padding: '12px 18px 16px',
  borderTop: '1px solid rgba(255, 204, 102, 0.28)',
  background: 'rgba(12, 7, 5, 0.98)',
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

const settingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const actionButtonVisualStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 120,
  minHeight: 38,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  textAlign: 'center',
};

const footerButtonVisualStyle: CSSProperties = {
  ...actionButtonVisualStyle,
  width: '100%',
  minWidth: 0,
  minHeight: 42,
  fontSize: '1rem',
  letterSpacing: '0.04em',
};

const fullWidthPanelButtonStyle: CSSProperties = {
  width: '100%',
};

const keyNoticeStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.78)',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  lineHeight: 1.35,
};

const keyNoticeErrorStyle: CSSProperties = {
  ...keyNoticeStyle,
  color: '#ffb4a8',
};

export function SettingsScreen({
  onClose,
  onLogout,
  open,
  playerId = '',
  playerName = '',
}: {
  onClose: () => void;
  onLogout: () => void;
  open: boolean;
  playerId?: string;
  playerName?: string;
}) {
  const displayName = playerName.trim();
  const recoveryFileName = recoveryKeyFilename(displayName);
  const [visible, setVisible] = useState(false);
  const [aboutUsOpen, setAboutUsOpen] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const canDownloadKey = playerId.length > 0 && loadIdentityKeypair(playerId) !== null;

  const updateScrollHint = useCallback(() => {
    const element = scrollBodyRef.current;

    if (!element) {
      setShowScrollHint(false);
      return;
    }

    const hasOverflow = element.scrollHeight > element.clientHeight + 4;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 16;
    setShowScrollHint(hasOverflow && !nearBottom);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setAboutUsOpen(false);
      setKeyMessage(null);
      setShowScrollHint(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !visible) {
      return;
    }

    const element = scrollBodyRef.current;

    if (!element) {
      return;
    }

    updateScrollHint();
    const resizeObserver = new ResizeObserver(() => {
      updateScrollHint();
    });

    resizeObserver.observe(element);

    const contentElement = scrollContentRef.current;

    if (contentElement) {
      resizeObserver.observe(contentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [open, visible, keyMessage, updateScrollHint]);

  function scrollSettingsDown(): void {
    const element = scrollBodyRef.current;

    if (!element) {
      return;
    }

    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    element.scrollBy({
      top: Math.min(200, Math.max(remaining, 0)),
      behavior: 'smooth',
    });
  }

  if (!open) {
    return null;
  }

  function handleDownloadKey(): void {
    playSfx(DEFAULT_BUTTON_SOUND);
    setKeyMessage(null);

    if (!playerId) {
      setKeyMessage('Sign in to download your recovery key.');
      return;
    }

    const keypair = loadIdentityKeypair(playerId);

    if (!keypair) {
      setKeyMessage(
        `No recovery key is stored on this device. Restore your journey with your Morkahja recovery key once to enable downloads here.`,
      );
      return;
    }

    if (!displayName) {
      setKeyMessage('Player name is required to name your recovery key file.');
      return;
    }

    downloadRecoveryKey(keypair, displayName);
    setKeyMessage(`Downloaded ${recoveryFileName}. Store it somewhere safe.`);
  }

  return (
    <div
      aria-label="Settings"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
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
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <style>
          {`[data-settings-scroll]::-webkit-scrollbar { display: none; }
@keyframes morkahja-settings-scroll-hint-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}`}
        </style>
        <header style={{ ...headerStyle, ...panelHeaderStyle }}>
          <div style={titleGroupStyle}>
            <h2 id="settings-overlay-title" style={titleStyle}>SETTINGS</h2>
            {displayName ? (
              <p aria-label={`Player name: ${displayName}`} style={playerNameStyle}>
                {displayName}
              </p>
            ) : null}
          </div>
          <ClosePanelButton onClose={onClose} pressKey="settings-close" />
        </header>
        <div style={panelBodyWrapStyle}>
          <div
            data-settings-scroll=""
            onScroll={updateScrollHint}
            ref={scrollBodyRef}
            style={panelBodyStyle}
          >
            <div ref={scrollContentRef} style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <SealOfNorghorSection open={open} />
              <MusicVolumeSlider />
              <SfxVolumeSlider />
              <div style={settingRowStyle}>
                <span>Recovery key</span>
                <PanelButton
                  onClick={handleDownloadKey}
                  pressKey="settings-download-key"
                  visualStyle={actionButtonVisualStyle}
                >
                  Download key
                </PanelButton>
              </div>
              {keyMessage ? (
                <p style={keyMessage.startsWith('Downloaded') ? keyNoticeStyle : keyNoticeErrorStyle}>
                  {keyMessage}
                </p>
              ) : !canDownloadKey ? (
                <p style={keyNoticeStyle}>
                  Use Restore Journey with your existing {recoveryFileName || 'Morkahja recovery key'} on this device to save a copy here.
                </p>
              ) : (
                <p style={keyNoticeStyle}>
                  Saves as {recoveryFileName}.
                </p>
              )}
              <div style={settingRowStyle}>
                <span>Logout</span>
                <PanelButton
                  onClick={() => {
                    playSfx(DEFAULT_BUTTON_SOUND);
                    onLogout();
                  }}
                  pressKey="settings-logout"
                  visualStyle={actionButtonVisualStyle}
                >
                  End Session
                </PanelButton>
              </div>
            </div>
          </div>
          {showScrollHint ? (
            <div aria-hidden="true" style={scrollHintOverlayStyle}>
              <button
                aria-label="Scroll down for more settings"
                onClick={() => {
                  scrollSettingsDown();
                }}
                style={scrollHintButtonStyle}
                type="button"
              >
                ▼
              </button>
            </div>
          ) : null}
        </div>
        <footer style={panelFooterStyle}>
          <PanelButton
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              setAboutUsOpen(true);
            }}
            pressKey="settings-about-us"
            style={fullWidthPanelButtonStyle}
            visualStyle={footerButtonVisualStyle}
          >
            About Us
          </PanelButton>
        </footer>
      </section>
      <AboutUsOverlay
        onClose={() => {
          setAboutUsOpen(false);
        }}
        open={aboutUsOpen}
      />
    </div>
  );
}

export default SettingsScreen;
