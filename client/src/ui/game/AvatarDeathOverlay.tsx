import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PanelButton } from '../common/PanelButton.js';
import { overlayCloseButtonVisualStyle } from '../common/ClosePanelButton.js';
import { FADE_DURATION_MS, waitForFade } from '../transitions/fade.js';
import { NAV_BUTTON_PRESS_MS } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import {
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../protectedImage.js';

const DEATH_OVERLAY_ASSET = '/UI/09_GAME/im_overlay_death.webp';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.82)',
  transition: `opacity ${FADE_DURATION_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(92vw, 480px)',
  minHeight: 'min(72vh, 520px)',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  borderRadius: 14,
  pointerEvents: 'auto',
};

const deathArtStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
};

const panelContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  display: 'grid',
  gap: 18,
  padding: 'clamp(28px, 8vh, 56px) clamp(20px, 5vw, 32px) clamp(24px, 6vh, 40px)',
  boxSizing: 'border-box',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: 'clamp(1.2rem, 4.5vw, 1.45rem)',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
  textShadow: '0 3px 12px rgba(0, 0, 0, 0.9)',
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.94)',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.05rem)',
  lineHeight: 1.5,
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.88)',
};

const hopeStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.8)',
  fontSize: 'clamp(0.88rem, 3.2vw, 0.96rem)',
  lineHeight: 1.55,
  fontStyle: 'italic',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.88)',
};

const actionsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  width: '100%',
  marginTop: 8,
};

const actionButtonVisualStyle: CSSProperties = {
  ...overlayCloseButtonVisualStyle,
  width: '100%',
  minHeight: 40,
  padding: '8px 10px',
  fontSize: '0.92rem',
  lineHeight: 1.2,
};

type DeathAction = 'same-soul' | 'new-avatar';

export function AvatarDeathOverlay({
  avatarName,
  onHandoffComplete,
  onNewAvatar,
  onOptionsVisible,
  onSameSoul,
  open,
}: {
  avatarName: string;
  onHandoffComplete: () => void;
  onNewAvatar: () => void | Promise<void>;
  /** Fires once when Same Soul / New Avatar are shown (after fade-in). */
  onOptionsVisible?: () => void | Promise<void>;
  onSameSoul: () => void | Promise<void>;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [pendingAction, setPendingAction] = useState<DeathAction | null>(null);
  const optionsVisibleNotifiedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setExiting(false);
      setPendingAction(null);
      optionsVisibleNotifiedRef.current = false;
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
    if (!open || !visible || exiting || optionsVisibleNotifiedRef.current || !onOptionsVisible) {
      return;
    }

    let cancelled = false;
    const notify = (): void => {
      if (cancelled || optionsVisibleNotifiedRef.current) {
        return;
      }
      optionsVisibleNotifiedRef.current = true;
      void Promise.resolve(onOptionsVisible()).catch((error) => {
        console.error('Death overlay onOptionsVisible failed', error);
      });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(notify);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [exiting, onOptionsVisible, open, visible]);

  async function handleAction(action: DeathAction, handler: () => void | Promise<void>): Promise<void> {
    if (pendingAction !== null || exiting) {
      return;
    }

    setPendingAction(action);
    playSfx(DEFAULT_BUTTON_SOUND);
    await new Promise((resolve) => {
      window.setTimeout(resolve, NAV_BUTTON_PRESS_MS);
    });

    try {
      await handler();
    } catch (error) {
      console.error(`Death overlay ${action} failed`, error);
      setPendingAction(null);
      return;
    }

    setExiting(true);
    await waitForFade();
    onHandoffComplete();
    setPendingAction(null);
  }

  if (!open) {
    return null;
  }

  const showOverlay = visible && !exiting;
  const actionsDisabled = pendingAction !== null;

  return (
    <div
      aria-label="Avatar death"
      role="presentation"
      style={{
        ...backdropStyle,
        opacity: showOverlay ? 1 : 0,
        pointerEvents: showOverlay ? 'auto' : 'none',
      }}
    >
      <section
        aria-labelledby="avatar-death-title"
        style={panelStyle}
        {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      >
        <img
          alt=""
          aria-hidden="true"
          {...protectedImageProps}
          src={DEATH_OVERLAY_ASSET}
          style={deathArtStyle}
        />
        <div style={panelContentStyle}>
          <h2 id="avatar-death-title" style={titleStyle}>Your journey has ended.</h2>
          <p style={messageStyle}>
            {avatarName} didn&apos;t get the blessing of the gods.
          </p>
          <p style={hopeStyle}>
            Return as the same soul with a fresh start, or shape a new avatar and walk
            a different path.
          </p>
          <div style={actionsRowStyle}>
            <PanelButton
              aria-disabled={actionsDisabled}
              disabled={actionsDisabled}
              onClick={() => {
                void handleAction('same-soul', onSameSoul);
              }}
              pressKey="death-same-soul"
              visualStyle={actionButtonVisualStyle}
            >
              Same Soul
            </PanelButton>
            <PanelButton
              aria-disabled={actionsDisabled}
              disabled={actionsDisabled}
              onClick={() => {
                void handleAction('new-avatar', onNewAvatar);
              }}
              pressKey="death-new-avatar"
              visualStyle={actionButtonVisualStyle}
            >
              New Avatar
            </PanelButton>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AvatarDeathOverlay;
