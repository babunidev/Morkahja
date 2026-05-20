import { useEffect, useState, type CSSProperties } from 'react';
import { DEFAULT_BUTTON_SOUND, LEVEL_UP_SOUND, playSfx } from '../sfx.js';
import ActivityFeedOverlay from './ActivityFeedOverlay.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import { NAV_BUTTON_PRESS_MS, useNavButtonPress } from '../transitions/navButtonPress.js';

const PLAY_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_play.webp';
const NAV_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_nav_b.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';
const LOADING_WHEEL_ASSET = '/UI/01_WelcomeScreen/LoadingWheel.webp';
const PLAY_ANIMATION_MS = 3000;
const RADIAL_BUTTONS = [
  {
    label: 'News',
    src: '/UI/03_DASHBOARD/im_button_news_a.webp',
    x: 48,
    y: -86,
  },
  {
    label: 'Settings',
    src: '/UI/03_DASHBOARD/im_button_setting_b.webp',
    x: -48,
    y: -86,
  },
  {
    label: 'Social',
    src: '/UI/03_DASHBOARD/im_button_social_a.webp',
    x: 96,
    y: 0,
  },
  {
    label: 'Credits',
    src: '/UI/03_DASHBOARD/im_button_credits_b.webp',
    x: -96,
    y: 0,
  },
] as const;

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
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

const playWrapStyle: CSSProperties = {
  transition: 'opacity 420ms ease, transform 420ms ease',
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

const navWrapStyle: CSSProperties = {
  position: 'relative',
  width: 'min(22vw, 118px)',
  height: 'min(22vw, 118px)',
  marginTop: 'clamp(18px, 4vh, 42px)',
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'auto',
};

const navButtonStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  transition: 'opacity 420ms ease, transform 420ms ease',
  zIndex: 2,
};

const navButtonImageStyle: CSSProperties = {
  ...imageStyle,
  position: 'absolute',
  left: 0,
  top: '50%',
  transition: 'opacity 420ms ease, transform 420ms ease',
};

const radialButtonStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 'min(17vw, 86px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  transition: 'opacity 420ms ease, transform 420ms ease',
  zIndex: 1,
};

export function Dashboard({
  isPreparingAvatars = false,
  onPlay,
  onPlayPressed,
  onSettings,
}: {
  isPreparingAvatars?: boolean;
  onPlay: () => Promise<void> | void;
  onPlayPressed?: () => void;
  onSettings: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const [playAnimating, setPlayAnimating] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const { pulse: pulseNavButton, isPressed: isNavButtonPressed, pressAnimation } =
    useNavButtonPress();

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
    onPlayPressed?.();
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
          @keyframes morkahja-nav-center-button-press {
            0% { transform: translateY(-50%) scale(1); filter: brightness(1); }
            38% { transform: translateY(-50%) scale(0.9); filter: brightness(0.92); }
            72% { transform: translateY(-50%) scale(1.08); filter: brightness(1.22); }
            100% { transform: translateY(-50%) scale(1); filter: brightness(1); }
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
      <div
        style={{
          ...playWrapStyle,
          opacity: navOpen ? 0 : 1,
          transform: navOpen ? 'translateY(-10px) scale(0.96)' : 'translateY(0) scale(1)',
          pointerEvents: navOpen ? 'none' : 'auto',
        }}
      >
        <button
          aria-label="Play"
          disabled={!clickable || navOpen}
          onClick={() => {
            void handlePlay();
          }}
          style={{
            ...buttonStyle,
            ...(playAnimating ? buttonAnimatingStyle : {}),
            cursor: clickable && !playAnimating && !navOpen ? 'pointer' : 'default',
          }}
          type="button"
        >
          <img alt="" aria-hidden="true" draggable={false} src={PLAY_BUTTON_ASSET} style={imageStyle} />
        </button>
      </div>
      <nav aria-label="Dashboard navigation" style={navWrapStyle}>
        {RADIAL_BUTTONS.map((button) => (
          <button
            aria-label={button.label}
            disabled={!clickable || !navOpen}
            key={button.label}
            onPointerDown={() => {
              pulseNavButton(button.label);
            }}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              if (button.label === 'News') {
                setActivityOpen(true);
              }
              if (button.label === 'Settings') {
                onSettings();
              }
            }}
            style={{
              ...radialButtonStyle,
              opacity: navOpen ? 1 : 0,
              pointerEvents: navOpen ? 'auto' : 'none',
              transform: navOpen
                ? `translate(calc(-50% + ${button.x}px), calc(-50% + ${button.y}px)) scale(1)`
                : 'translate(-50%, -50%) scale(0.35)',
            }}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              draggable={false}
              src={button.src}
              style={{
                ...imageStyle,
                animation: pressAnimation(isNavButtonPressed(button.label)),
              }}
            />
          </button>
        ))}
        <button
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          disabled={!clickable}
          onPointerDown={() => {
            pulseNavButton('Navigation');
          }}
          onClick={() => {
            playSfx(DEFAULT_BUTTON_SOUND);
            setNavOpen((open) => !open);
          }}
          style={{
            ...navButtonStyle,
            cursor: clickable ? 'pointer' : 'default',
            transform: navOpen ? 'scale(0.92)' : 'scale(1)',
          }}
          type="button"
        >
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={NAV_BUTTON_ASSET}
            style={{
              ...navButtonImageStyle,
              animation:
                isNavButtonPressed('Navigation')
                  ? `morkahja-nav-center-button-press ${NAV_BUTTON_PRESS_MS}ms ease-out`
                  : undefined,
              opacity: navOpen ? 0 : 1,
              transform: navOpen ? 'translateY(-50%) scale(0.82)' : 'translateY(-50%) scale(1)',
            }}
          />
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={HOME_BUTTON_ASSET}
            style={{
              ...navButtonImageStyle,
              animation:
                isNavButtonPressed('Navigation')
                  ? `morkahja-nav-center-button-press ${NAV_BUTTON_PRESS_MS}ms ease-out`
                  : undefined,
              opacity: navOpen ? 1 : 0,
              transform: navOpen ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(0.82)',
            }}
          />
        </button>
      </nav>
      <ActivityFeedOverlay
        onClose={() => {
          setActivityOpen(false);
        }}
        open={activityOpen}
      />
    </main>
  );
}

export default Dashboard;
