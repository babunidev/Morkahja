import { useEffect, useState, type CSSProperties } from 'react';
import { FADE_DURATION_MS, waitForFade } from '../transitions/fade.js';
import {
  NAV_BUTTON_PRESS_MS,
  useNavButtonPress,
} from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';

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
  width: 'min(92vw, 420px)',
  display: 'grid',
  gap: 20,
  padding: '24px 20px 20px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.35rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.92)',
  fontSize: '1.02rem',
  lineHeight: 1.5,
};

const hopeStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.94rem',
  lineHeight: 1.55,
  fontStyle: 'italic',
};

const homeButtonStyle: CSSProperties = {
  margin: '0 auto',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  width: 'min(58vw, 200px)',
};

const homeImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5))',
};

export function AvatarDeathOverlay({
  avatarName,
  onHandoffStart,
  onHandoffComplete,
  open,
}: {
  avatarName: string;
  onHandoffStart: () => void | Promise<void>;
  onHandoffComplete: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [homePending, setHomePending] = useState(false);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setExiting(false);
      setHomePending(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  async function handleHome(): Promise<void> {
    if (homePending || exiting) {
      return;
    }

    setHomePending(true);
    pulse('death-home');
    playSfx(DEFAULT_BUTTON_SOUND);
    await new Promise((resolve) => {
      window.setTimeout(resolve, NAV_BUTTON_PRESS_MS);
    });

    try {
      await onHandoffStart();
    } catch (error) {
      console.error('Death overlay home failed', error);
      setHomePending(false);
      return;
    }

    setExiting(true);
    await waitForFade();
    onHandoffComplete();
    setHomePending(false);
  }

  if (!open) {
    return null;
  }

  const showOverlay = visible && !exiting;

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
      >
        <h2 id="avatar-death-title" style={titleStyle}>Your journey has ended.</h2>
        <p style={messageStyle}>
          {avatarName} didn&apos;t get the blessing of the gods.
        </p>
        <p style={hopeStyle}>
          Return home when you are ready — you may begin the road again as the same
          soul, or shape a new avatar and walk a different path.
        </p>
        <button
          aria-disabled={homePending}
          aria-label="Return home"
          disabled={homePending}
          onClick={() => {
            void handleHome();
          }}
          onPointerDown={() => {
            if (!homePending) {
              pulse('death-home');
            }
          }}
          style={{
            ...homeButtonStyle,
            cursor: homePending ? 'default' : 'pointer',
          }}
          type="button"
        >
          <img
            alt="Home"
            draggable={false}
            src={HOME_BUTTON_ASSET}
            style={{
              ...homeImageStyle,
              animation: pressAnimation(isPressed('death-home')),
            }}
          />
        </button>
      </section>
    </div>
  );
}

export default AvatarDeathOverlay;
