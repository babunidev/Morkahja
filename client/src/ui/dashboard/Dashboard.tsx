import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { fetchRecentActivity, loadStoredSession, type EncounterSnapshot, type PersistedAvatar } from '../../api/http.js';
import AvatarSelectionPanel from '../avatar/AvatarSelectionPanel.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AchievementsOverlay from './AchievementsOverlay.js';
import ActivityFeedOverlay from './ActivityFeedOverlay.js';
import { hasUnreadScribes } from './scribesReadState.js';
import SettingsScreen from '../settings/SettingsScreen.js';
import { FADE_DURATION_MS, fadeStyle, waitForFade } from '../transitions/fade.js';
import { NAV_BUTTON_PRESS_MS, useNavButtonPress } from '../transitions/navButtonPress.js';

const PLAY_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_play.webp';
const NAV_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_nav_b.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';
const LOADING_WHEEL_ASSET = '/UI/01_WelcomeScreen/LoadingWheel.webp';
const SCRIBES_POLL_MS = 10_000;
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
  {
    label: 'Achievements',
    src: '/UI/03_DASHBOARD/im_achievements.webp',
    x: 48,
    y: 83,
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

const dashboardColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
};

const buttonStyle: CSSProperties = {
  width: 'min(58vw, 360px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  pointerEvents: 'auto',
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
  transition: 'opacity 420ms ease, transform 420ms ease',
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
  avatars = [],
  creationPreset = null,
  excludedAvatarIds = [],
  hidden = false,
  isPreparingAvatars = false,
  avatarSlotsVisible = false,
  onAvatarSlotsVisibleChange,
  onAvatarsChanged,
  onCreationPresetConsumed,
  onEnterGameComplete,
  onEnterHandoffChange,
  onEnterWorldFailed,
  onHandoffLand,
  onAvatarEnter,
  onPlay,
  onPrepareGame,
  onLogout,
}: {
  avatars?: PersistedAvatar[];
  creationPreset?: PersistedAvatar | null;
  excludedAvatarIds?: string[];
  hidden?: boolean;
  isPreparingAvatars?: boolean;
  avatarSlotsVisible?: boolean;
  onAvatarSlotsVisibleChange?: (visible: boolean) => void;
  onAvatarsChanged?: (avatars: PersistedAvatar[]) => void;
  onCreationPresetConsumed?: () => void;
  onEnterGameComplete?: () => void;
  onEnterHandoffChange?: (snapshot: import('../transitions/avatarEnterTransition.js').AvatarEnterHandoffSnapshot | null) => void;
  onEnterWorldFailed?: () => void;
  onHandoffLand?: () => void;
  onAvatarEnter?: () => void;
  onPlay: () => Promise<void> | void;
  onPrepareGame: (avatar: PersistedAvatar, encounter: EncounterSnapshot) => void;
  onLogout: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [enteringGame, setEnteringGame] = useState(false);
  const [avatarCreationOpen, setAvatarCreationOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [scribesUnread, setScribesUnread] = useState(false);
  const playerId = loadStoredSession()?.playerId ?? '';
  const showChrome = !hidden;
  const { pulse: pulseNavButton, isPressed: isNavButtonPressed, pressAnimation } =
    useNavButtonPress();

  const refreshScribesUnread = useCallback(async () => {
    if (!playerId) {
      setScribesUnread(false);
      return;
    }

    try {
      const response = await fetchRecentActivity();
      setScribesUnread(hasUnreadScribes(playerId, response.entries));
    } catch {
      // Keep the previous indicator if the feed cannot be reached.
    }
  }, [playerId]);

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

  useEffect(() => {
    if (!avatarSlotsVisible) {
      return;
    }

    setNavOpen(false);
  }, [avatarSlotsVisible]);

  useEffect(() => {
    if (!showChrome) {
      return;
    }

    void refreshScribesUnread();

    const pollTimer = window.setInterval(() => {
      void refreshScribesUnread();
    }, SCRIBES_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [refreshScribesUnread, showChrome]);

  async function handlePlayAsHome(): Promise<void> {
    if (!clickable || !avatarSlotsVisible || avatarCreationOpen) {
      return;
    }

    playSfx(DEFAULT_BUTTON_SOUND);
    setClickable(false);
    onAvatarSlotsVisibleChange?.(false);
    await waitForFade();
    setClickable(true);
  }

  async function handlePlay(): Promise<void> {
    if (!clickable || avatarSlotsVisible) {
      return;
    }

    setClickable(false);
    setNavOpen(false);
    playSfx(DEFAULT_BUTTON_SOUND);

    await Promise.resolve(onPlay?.());

    onAvatarSlotsVisibleChange?.(true);
    window.setTimeout(() => {
      setClickable(true);
    }, FADE_DURATION_MS);
  }

  return (
    <main
      aria-hidden={hidden}
      aria-label="Dashboard"
      style={{
        ...screenStyle,
        ...fadeStyle(visible),
        pointerEvents: hidden ? 'none' : 'none',
      }}
    >
      <style>
        {`
          @keyframes morkahja-dashboard-preload-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes morkahja-nav-center-button-press {
            0% { transform: translateY(-50%) scale(1); filter: brightness(1); }
            38% { transform: translateY(-50%) scale(0.9); filter: brightness(0.92); }
            72% { transform: translateY(-50%) scale(1.08); filter: brightness(1.22); }
            100% { transform: translateY(-50%) scale(1); filter: brightness(1); }
          }
        `}
      </style>
      {isPreparingAvatars && showChrome ? (
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={LOADING_WHEEL_ASSET}
          style={preloadWheelStyle}
        />
      ) : null}
      <div style={dashboardColumnStyle}>
        {showChrome ? (
          <div
            style={{
              ...playWrapStyle,
              opacity: navOpen || avatarCreationOpen ? 0 : 1,
              transform: navOpen || avatarCreationOpen
                ? 'translateY(-10px) scale(0.96)'
                : 'translateY(0) scale(1)',
              pointerEvents: navOpen || avatarCreationOpen ? 'none' : 'auto',
            }}
          >
            <button
              aria-label={avatarSlotsVisible ? 'Close avatar selection' : 'Play'}
              disabled={!clickable || navOpen || avatarCreationOpen}
              onClick={() => {
                if (avatarSlotsVisible) {
                  void handlePlayAsHome();
                  return;
                }

                void handlePlay();
              }}
              onPointerDown={() => {
                pulseNavButton('Play');
              }}
              style={{
                ...buttonStyle,
                cursor: clickable && !navOpen ? 'pointer' : 'default',
              }}
              type="button"
            >
              <img
                alt=""
                aria-hidden="true"
                draggable={false}
                src={PLAY_BUTTON_ASSET}
                style={{
                  ...imageStyle,
                  animation: pressAnimation(isNavButtonPressed('Play')),
                }}
              />
            </button>
          </div>
        ) : null}
        {showChrome || enteringGame ? (
          <AvatarSelectionPanel
            avatars={avatars}
            creationPreset={creationPreset}
            excludedAvatarIds={excludedAvatarIds}
            onAvatarsChanged={onAvatarsChanged}
            onCreationPresetConsumed={onCreationPresetConsumed}
            onEnterGameComplete={() => {
              onEnterGameComplete?.();
            }}
            onEnterHandoffChange={onEnterHandoffChange}
            onEnterWorldFailed={onEnterWorldFailed}
            onHandoffLand={onHandoffLand}
            onAvatarEnter={onAvatarEnter}
            onCreationOpenChange={setAvatarCreationOpen}
            onEnteringGameChange={setEnteringGame}
            onPrepareGame={(avatar, encounter) => {
              onAvatarSlotsVisibleChange?.(false);
              onPrepareGame(avatar, encounter);
            }}
            visible={avatarSlotsVisible}
          />
        ) : null}
      </div>
      {showChrome ? (
        <nav
          aria-label="Dashboard navigation"
          style={navWrapStyle}
        >
          {RADIAL_BUTTONS.map((button) => {
            const scribesButtonShake =
              button.label === 'News' &&
              scribesUnread &&
              !activityOpen &&
              navOpen &&
              !isNavButtonPressed('News');

            return (
            <button
              aria-label={
                button.label === 'News' && scribesUnread && !activityOpen
                  ? 'Scribes, new entries'
                  : button.label
              }
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
                  setSettingsOpen(true);
                }
                if (button.label === 'Achievements') {
                  setAchievementsOpen(true);
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
                  animation: scribesButtonShake
                    ? 'morkahja-scribes-button-shake 2.8s ease-in-out infinite'
                    : pressAnimation(isNavButtonPressed(button.label)),
                }}
              />
            </button>
            );
          })}
          <button
            aria-label={
              scribesUnread && !activityOpen
                ? 'Open navigation, unread scribes'
                : navOpen
                  ? 'Close navigation'
                  : 'Open navigation'
            }
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
            {scribesUnread && !activityOpen ? (
              <span aria-hidden="true" className="morkahja-scribes-unread-dot morkahja-party-slot-dot" />
            ) : null}
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
      ) : null}
      {showChrome ? (
        <ActivityFeedOverlay
          onClose={() => {
            setActivityOpen(false);
          }}
          onReadStateChange={() => {
            void refreshScribesUnread();
          }}
          open={activityOpen}
          playerId={playerId}
        />
      ) : null}
      {showChrome ? (
        <SettingsScreen
          onClose={() => {
            setSettingsOpen(false);
          }}
          onLogout={onLogout}
          open={settingsOpen}
        />
      ) : null}
      {showChrome ? (
        <AchievementsOverlay
          onClose={() => {
            setAchievementsOpen(false);
          }}
          open={achievementsOpen}
        />
      ) : null}
    </main>
  );
}

export default Dashboard;
