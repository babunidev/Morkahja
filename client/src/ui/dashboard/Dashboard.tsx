import { useEffect, useState, type CSSProperties } from 'react';
import { LEVEL_UP_SOUND, playSfx } from '../sfx.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';

const PLAY_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_play.webp';
const LOADING_WHEEL_ASSET = '/UI/01_WelcomeScreen/LoadingWheel.webp';
const PLAY_ANIMATION_MS = 3000;

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
};

const buttonStyle: CSSProperties = {
  width: 'min(58vw, 360px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  pointerEvents: 'auto',
};

const buttonAnimatingStyle: CSSProperties = {
  animation: 'morkahja-play-grow 3000ms ease-in-out forwards',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.48))',
};

const preloadWheelStyle: CSSProperties = {
  position: 'fixed',
  top: 'max(18px, calc(env(safe-area-inset-top) + 14px))',
  right: 'max(18px, calc(env(safe-area-inset-right) + 14px))',
  zIndex: 4,
  width: 'clamp(34px, 7vw, 58px)',
  height: 'clamp(34px, 7vw, 58px)',
  objectFit: 'contain',
  animation: 'morkahja-dashboard-preload-spin 1.2s linear infinite',
  filter: 'drop-shadow(0 0 10px rgba(244, 232, 190, 0.42))',
  pointerEvents: 'none',
};

export function Dashboard({
  isPreparingAvatars = false,
  onPlay,
}: {
  isPreparingAvatars?: boolean;
  onPlay: () => Promise<void> | void;
}) {
  const [visible, setVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const [playAnimating, setPlayAnimating] = useState(false);

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);
    const enableTimer = window.setTimeout(async () => {
      await waitForFade();
      setClickable(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(enableTimer);
    };
  }, []);

  async function handlePlay(): Promise<void> {
    if (!clickable) {
      return;
    }

    setClickable(false);
    playSfx(LEVEL_UP_SOUND);
    setPlayAnimating(true);
    await new Promise((resolve) => {
      window.setTimeout(resolve, PLAY_ANIMATION_MS);
    });
    await onPlay();
    setVisible(false);
    await waitForFade();
  }

  return (
    <main aria-label="Dashboard" style={{ ...screenStyle, ...fadeStyle(visible) }}>
      <style>
        {`
          @keyframes morkahja-dashboard-preload-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes morkahja-play-grow {
            0% { transform: scale(1); filter: brightness(1); }
            24% { transform: scale(1.07); filter: brightness(1.1); }
            34% { transform: scale(1.04); filter: brightness(1.06); }
            56% { transform: scale(1.14); filter: brightness(1.18); }
            66% { transform: scale(1.09); filter: brightness(1.12); }
            88% { transform: scale(1.22); filter: brightness(1.3); }
            100% { transform: scale(1.22); filter: brightness(1.34); }
          }
        `}
      </style>
      {isPreparingAvatars ? (
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={LOADING_WHEEL_ASSET}
          style={preloadWheelStyle}
        />
      ) : null}
      <button
        aria-label="Play"
        disabled={!clickable}
        onClick={() => {
          void handlePlay();
        }}
        style={{
          ...buttonStyle,
          ...(playAnimating ? buttonAnimatingStyle : {}),
          cursor: clickable && !playAnimating ? 'pointer' : 'default',
        }}
        type="button"
      >
        <img alt="" aria-hidden="true" draggable={false} src={PLAY_BUTTON_ASSET} style={imageStyle} />
      </button>
    </main>
  );
}

export default Dashboard;
