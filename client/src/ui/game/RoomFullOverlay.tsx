import { useEffect, useState, type CSSProperties } from 'react';
import PanelButton from '../common/PanelButton.js';
import { protectedOverlayTextStyle } from '../protectedImage.js';

const OVERLAY_FADE_MS = 280;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.78)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 440px)',
  display: 'grid',
  gap: 18,
  padding: '22px 20px 18px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.96)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
  ...protectedOverlayTextStyle,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.25rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.98rem',
  lineHeight: 1.45,
};

const actionsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const actionButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255, 204, 102, 0.62)',
  background: 'rgba(24, 14, 10, 0.92)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  lineHeight: 1.3,
};

const primaryActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  borderColor: 'rgba(255, 204, 102, 0.85)',
  color: '#ffcc66',
};

interface RoomFullOverlayProps {
  avatarName: string;
  continuePending?: boolean;
  onContinueJourney: () => void;
  onGoToDashboard: () => void;
}

export default function RoomFullOverlay({
  avatarName,
  continuePending = false,
  onContinueJourney,
  onGoToDashboard,
}: RoomFullOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      aria-labelledby="room-full-title"
      aria-modal="true"
      role="dialog"
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <div style={panelStyle}>
        <h2 id="room-full-title" style={titleStyle}>
          Room full
        </h2>
        <p style={messageStyle}>
          This room is already full. Choose how you would like to continue.
        </p>
        <div style={actionsStyle}>
          <PanelButton
            disabled={continuePending}
            onClick={onContinueJourney}
            pressKey="room-full-continue"
            visualStyle={primaryActionButtonStyle}
          >
            Continue {avatarName}&apos;s journey
          </PanelButton>
          <PanelButton
            disabled={continuePending}
            onClick={onGoToDashboard}
            pressKey="room-full-dashboard"
            visualStyle={actionButtonStyle}
          >
            Go to Dashboard
          </PanelButton>
        </div>
      </div>
    </div>
  );
}
