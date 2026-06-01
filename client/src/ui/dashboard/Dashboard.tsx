import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type {
  ActivityFeedJoinRoomActionDto,
  FriendSummaryDto,
} from '@shared/contracts';
import {
  fetchAchievements,
  fetchRecentActivity,
  loadStoredSession,
  type EncounterSnapshot,
  type PersistedAvatar,
} from '../../api/http.js';
import { hasUnseenAchievements } from './achievementsAttentionState.js';
import AvatarSelectionPanel from '../avatar/AvatarSelectionPanel.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import ActivityFeedOverlay from './ActivityFeedOverlay.js';
import ExpansionsOverlay from './ExpansionsOverlay.js';
import FriendsOverlay from './FriendsOverlay.js';
import { fetchAvatars } from '../../api/http.js';
import PlayerProfileOverlay from './PlayerProfileOverlay.js';
import { hasUnreadScribes } from './scribesReadState.js';
import SettingsScreen from '../settings/SettingsScreen.js';
import { FADE_DURATION_MS, fadeStyle, waitForFade } from '../transitions/fade.js';
import { useTooltipRevealGroup } from '../hooks/useTooltipReveal.js';
import { NAV_BUTTON_PRESS_MS, useNavButtonPress } from '../transitions/navButtonPress.js';

const PLAY_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_play.webp';
const PLAY_PREPARE_WHEEL_ASSET = '/UI/01_WelcomeScreen/LoadingWheel.webp';
const NAV_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_nav_b.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';
const SCRIBES_POLL_MS = 10_000;
const RADIAL_BUTTONS = [
  {
    label: 'News',
    tooltip: 'Scribes',
    src: '/UI/03_DASHBOARD/im_button_news_a.webp',
    x: 48,
    y: -86,
  },
  {
    label: 'Settings',
    tooltip: 'Settings',
    src: '/UI/03_DASHBOARD/im_button_setting_b.webp',
    x: -48,
    y: 83,
  },
  {
    label: 'Social',
    tooltip: 'Friends',
    src: '/UI/03_DASHBOARD/im_button_social_a.webp',
    x: 96,
    y: 0,
  },
  {
    label: 'Profile',
    tooltip: 'Profile',
    src: '/UI/03_DASHBOARD/im_button_credits_b.webp',
    x: -96,
    y: 0,
  },
  {
    label: 'Achievements',
    tooltip: 'Achievements',
    src: '/UI/03_DASHBOARD/im_achievements.webp',
    x: 48,
    y: 83,
  },
  {
    label: 'Expansions',
    tooltip: 'Expansions',
    src: '/UI/03_DASHBOARD/im_button_expansions.webp',
    x: -48,
    y: -86,
  },
] as const;

const NAV_CENTER_HOVER_ID = 'Navigation';

function navRadialTooltipStyle(x: number, y: number): CSSProperties {
  const spokeLength = Math.hypot(x, y) || 1;
  const outward = 38;
  const offsetX = Math.round((x / spokeLength) * outward);
  const offsetY = Math.round((y / spokeLength) * outward);

  return {
    left: `calc(50% + ${offsetX}px)`,
    top: `calc(50% + ${offsetY}px)`,
  };
}

/** Closed-nav dot anchors match radial pop positions (24h clock: 13:00, 17:00). */
const SCRIBES_RADIAL_OFFSET = RADIAL_BUTTONS.find((button) => button.label === 'News')!;
const ACHIEVEMENTS_RADIAL_OFFSET = RADIAL_BUTTONS.find(
  (button) => button.label === 'Achievements',
)!;

/** Extra distance past the radial button anchor (closed nav). */
const NAV_ATTENTION_DOT_OUTSET_PX = 30;
/** Pull closed-nav dots toward the hub (1 = anchor only, lower = closer). */
const NAV_ATTENTION_DOT_RADIUS_SCALE = 0.7;

function radialAttentionDotStyle(x: number, y: number): CSSProperties {
  const spokeLength = Math.hypot(x, y) || 1;
  const radialDistance = (spokeLength + NAV_ATTENTION_DOT_OUTSET_PX) * NAV_ATTENTION_DOT_RADIUS_SCALE;
  const offsetX = Math.round((x / spokeLength) * radialDistance);
  const offsetY = Math.round((y / spokeLength) * radialDistance);

  return {
    left: `calc(50% + ${offsetX}px)`,
    top: `calc(50% + ${offsetY}px)`,
  };
}

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
  position: 'relative',
  transition: 'opacity 420ms ease, transform 420ms ease',
};

const playPrepareWheelStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 'min(18vw, 72px)',
  height: 'min(18vw, 72px)',
  transform: 'translate(-50%, -50%)',
  objectFit: 'contain',
  pointerEvents: 'none',
  animation: 'morkahja-loading-wheel-spin 2s linear infinite',
  filter: 'drop-shadow(0 0 12px rgba(244, 232, 190, 0.42))',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.48))',
};

const navWrapStyle: CSSProperties = {
  position: 'relative',
  width: 'min(22vw, 118px)',
  height: 'min(22vw, 118px)',
  marginTop: 'clamp(18px, 4vh, 42px)',
  display: 'grid',
  placeItems: 'center',
  overflow: 'visible',
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
  achievementsOpen = false,
  avatars = [],
  creationPreset = null,
  creationRevealDelayMs = 0,
  excludedAvatarIds = [],
  hidden = false,
  selectionNotice = null,
  avatarSlotsVisible = false,
  playPreparePending = false,
  onAchievementCheck,
  onAchievementsOpenChange,
  onAvatarSlotsVisibleChange,
  onAvatarSelectionHome,
  onAvatarsChanged,
  onCreationPresetConsumed,
  onEnterGameComplete,
  onEnterHandoffChange,
  onEnterWorldFailed,
  onHandoffLand,
  onAvatarEnter,
  onJoinFriend,
  onJoinRoomFromScribes,
  onPlay,
  onPrepareGame,
  onLogout,
}: {
  achievementsOpen?: boolean;
  avatars?: PersistedAvatar[];
  creationPreset?: PersistedAvatar | null;
  creationRevealDelayMs?: number;
  excludedAvatarIds?: string[];
  hidden?: boolean;
  selectionNotice?: string | null;
  avatarSlotsVisible?: boolean;
  playPreparePending?: boolean;
  onAchievementCheck?: () => void;
  onAchievementsOpenChange?: (open: boolean) => void;
  onAvatarSlotsVisibleChange?: (visible: boolean) => void;
  onAvatarSelectionHome?: () => void;
  onAvatarsChanged?: (avatars: PersistedAvatar[]) => void;
  onCreationPresetConsumed?: () => void;
  onEnterGameComplete?: () => void;
  onEnterHandoffChange?: (snapshot: import('../transitions/avatarEnterTransition.js').AvatarEnterHandoffSnapshot | null) => void;
  onEnterWorldFailed?: () => void;
  onHandoffLand?: () => void;
  onAvatarEnter?: () => void;
  onJoinFriend?: (friend: FriendSummaryDto) => void | Promise<void>;
  onJoinRoomFromScribes?: (action: ActivityFeedJoinRoomActionDto) => void | Promise<void>;
  onPlay?: () => Promise<boolean> | boolean;
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
  const [expansionsOpen, setExpansionsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scribesUnread, setScribesUnread] = useState(false);
  const [achievementsAttention, setAchievementsAttention] = useState(false);
  const { bind: bindNavTooltip, isVisible: isNavTooltipVisible } = useTooltipRevealGroup();
  const session = loadStoredSession();
  const playerId = session?.playerId ?? '';
  const playerName = session?.playerName?.trim() ?? '';
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

  const refreshAchievementsAttention = useCallback(async () => {
    if (!playerId) {
      setAchievementsAttention(false);
      return;
    }

    try {
      const response = await fetchAchievements();
      setAchievementsAttention(hasUnseenAchievements(playerId, response));
    } catch {
      // Keep the previous indicator if achievements cannot be reached.
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
    void refreshAchievementsAttention();

    const pollTimer = window.setInterval(() => {
      void refreshScribesUnread();
      void refreshAchievementsAttention();
    }, SCRIBES_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [refreshAchievementsAttention, refreshScribesUnread, showChrome]);

  useEffect(() => {
    if (!achievementsOpen || !showChrome) {
      return;
    }

    const refreshTimer = window.setTimeout(() => {
      void refreshAchievementsAttention();
    }, 800);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [achievementsOpen, refreshAchievementsAttention, showChrome]);

  async function closeAvatarSelection(): Promise<void> {
    if (!avatarSlotsVisible) {
      return;
    }

    setClickable(false);
    onAvatarSlotsVisibleChange?.(false);
    onAvatarSelectionHome?.();
    await waitForFade();
    setClickable(true);
  }

  async function handlePlayAsHome(): Promise<void> {
    if (!clickable || !avatarSlotsVisible || avatarCreationOpen) {
      return;
    }

    playSfx(DEFAULT_BUTTON_SOUND);
    await closeAvatarSelection();
  }

  async function handlePlay(): Promise<void> {
    if (!clickable || avatarSlotsVisible || playPreparePending) {
      return;
    }

    setClickable(false);
    setNavOpen(false);
    playSfx(DEFAULT_BUTTON_SOUND);

    const ready = await Promise.resolve(onPlay?.() ?? true);

    if (!ready) {
      setClickable(true);
      return;
    }

    onAvatarSlotsVisibleChange?.(true);
    window.setTimeout(() => {
      setClickable(true);
    }, FADE_DURATION_MS);
  }

  const centerNavTooltipHandlers = bindNavTooltip(NAV_CENTER_HOVER_ID, clickable);

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
          @keyframes morkahja-nav-center-button-press {
            0% { transform: translateY(-50%) scale(1); filter: brightness(1); }
            38% { transform: translateY(-50%) scale(0.9); filter: brightness(0.92); }
            72% { transform: translateY(-50%) scale(1.08); filter: brightness(1.22); }
            100% { transform: translateY(-50%) scale(1); filter: brightness(1); }
          }
          @keyframes morkahja-loading-wheel-spin {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}
      </style>
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
              aria-busy={playPreparePending}
              aria-label={
                playPreparePending
                  ? 'Preparing avatars'
                  : avatarSlotsVisible
                    ? 'Close avatar selection'
                    : 'Play'
              }
              className="morkahja-play-button"
              disabled={!clickable || navOpen || avatarCreationOpen || playPreparePending}
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
              <span className="morkahja-play-button-visual">
                <img
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  src={PLAY_BUTTON_ASSET}
                  style={{
                    ...imageStyle,
                    opacity: playPreparePending ? 0.35 : 1,
                    animation: playPreparePending
                      ? undefined
                      : pressAnimation(isNavButtonPressed('Play')),
                  }}
                />
                {playPreparePending ? (
                  <img
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    src={PLAY_PREPARE_WHEEL_ASSET}
                    style={playPrepareWheelStyle}
                  />
                ) : null}
              </span>
            </button>
          </div>
        ) : null}
        {showChrome || enteringGame ? (
          <AvatarSelectionPanel
            avatars={avatars}
            creationPreset={creationPreset}
            creationRevealDelayMs={creationRevealDelayMs}
            excludedAvatarIds={excludedAvatarIds}
            selectionNotice={selectionNotice}
            onAchievementCheck={onAchievementCheck}
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
            const achievementsButtonShake =
              button.label === 'Achievements' &&
              achievementsAttention &&
              !achievementsOpen &&
              navOpen &&
              !isNavButtonPressed('Achievements');
            const showScribesDot =
              button.label === 'News' &&
              scribesUnread &&
              !activityOpen &&
              navOpen;
            const showAchievementsDot =
              button.label === 'Achievements' &&
              achievementsAttention &&
              !achievementsOpen &&
              navOpen;

            const navTooltipEnabled = navOpen && clickable;
            const navTooltipHandlers = bindNavTooltip(button.label, navTooltipEnabled);
            const showTooltip = isNavTooltipVisible(button.label, navTooltipEnabled);

            return (
            <button
              aria-label={
                button.label === 'News' && scribesUnread && !activityOpen
                  ? 'Scribes, new entries'
                  : button.label === 'Achievements' && achievementsAttention && !achievementsOpen
                    ? 'Achievements, new progress'
                    : button.label
              }
              className="morkahja-nav-radial-button"
              disabled={!clickable || !navOpen}
              key={button.label}
              {...navTooltipHandlers}
              onPointerDown={(event) => {
                navTooltipHandlers.onPointerDown?.(event);
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
                  onAchievementsOpenChange?.(true);
                }
                if (button.label === 'Expansions') {
                  setExpansionsOpen(true);
                }
                if (button.label === 'Social') {
                  setFriendsOpen(true);
                }
                if (button.label === 'Profile') {
                  setProfileOpen(true);
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
              {showScribesDot ? (
                <span
                  aria-hidden="true"
                  className="morkahja-nav-attention-dot morkahja-party-slot-dot morkahja-nav-attention-glow-scribes"
                />
              ) : null}
              {showAchievementsDot ? (
                <span
                  aria-hidden="true"
                  className="morkahja-nav-attention-dot morkahja-party-slot-dot morkahja-nav-attention-glow-achievements"
                />
              ) : null}
              <span
                className={`morkahja-nav-tooltip${showTooltip ? ' morkahja-nav-tooltip--visible' : ''}`}
                role="tooltip"
                style={navRadialTooltipStyle(button.x, button.y)}
              >
                {button.tooltip}
              </span>
              <span className="morkahja-nav-radial-button-visual">
                <img
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  src={button.src}
                  style={{
                    ...imageStyle,
                    animation: scribesButtonShake || achievementsButtonShake
                      ? 'morkahja-scribes-button-shake 2.8s ease-in-out infinite'
                      : pressAnimation(isNavButtonPressed(button.label)),
                  }}
                />
              </span>
            </button>
            );
          })}
          <button
            aria-label={
              scribesUnread && !activityOpen
                ? 'Open navigation, unread scribes'
                : achievementsAttention && !achievementsOpen
                  ? 'Open navigation, achievements progress'
                  : navOpen
                    ? 'Close navigation'
                    : 'Open navigation'
            }
            className="morkahja-nav-center-button"
            disabled={!clickable}
            {...centerNavTooltipHandlers}
            onPointerDown={(event) => {
              centerNavTooltipHandlers.onPointerDown?.(event);
              pulseNavButton('Navigation');
            }}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              if (avatarSlotsVisible) {
                void (async () => {
                  await closeAvatarSelection();
                  setNavOpen(true);
                })();
                return;
              }

              setNavOpen((open) => !open);
            }}
            style={{
              ...navButtonStyle,
              cursor: clickable ? 'pointer' : 'default',
              transform: navOpen ? 'scale(0.92)' : 'scale(1)',
            }}
            type="button"
          >
            <span
              className={`morkahja-nav-tooltip morkahja-nav-tooltip--center${
                isNavTooltipVisible(NAV_CENTER_HOVER_ID, clickable)
                  ? ' morkahja-nav-tooltip--visible'
                  : ''
              }`}
              role="tooltip"
            >
              {navOpen ? 'Home' : 'Menu'}
            </span>
            <span className="morkahja-nav-center-button-visual">
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
            </span>
          </button>
          {!navOpen && scribesUnread && !activityOpen ? (
            <span
              aria-hidden="true"
              className="morkahja-nav-radial-attention-dot morkahja-party-slot-dot morkahja-nav-attention-glow-scribes"
              style={radialAttentionDotStyle(
                SCRIBES_RADIAL_OFFSET.x,
                SCRIBES_RADIAL_OFFSET.y,
              )}
            />
          ) : null}
          {!navOpen && achievementsAttention && !achievementsOpen ? (
            <span
              aria-hidden="true"
              className="morkahja-nav-radial-attention-dot morkahja-party-slot-dot morkahja-nav-attention-glow-achievements"
              style={radialAttentionDotStyle(
                ACHIEVEMENTS_RADIAL_OFFSET.x,
                ACHIEVEMENTS_RADIAL_OFFSET.y,
              )}
            />
          ) : null}
        </nav>
      ) : null}
      {showChrome ? (
        <ActivityFeedOverlay
          onClose={() => {
            setActivityOpen(false);
          }}
          onJoinRoom={onJoinRoomFromScribes}
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
          playerId={playerId}
          playerName={playerName}
        />
      ) : null}
      {showChrome ? (
        <ExpansionsOverlay
          onClose={() => {
            setExpansionsOpen(false);
          }}
          onContentUnlocked={onAchievementCheck}
          open={expansionsOpen}
          playerId={playerId}
        />
      ) : null}
      {showChrome ? (
        <FriendsOverlay
          onClose={() => {
            setFriendsOpen(false);
          }}
          onJoinFriend={onJoinFriend}
          open={friendsOpen}
          playerId={playerId}
          playerName={playerName}
        />
      ) : null}
      {showChrome ? (
        <PlayerProfileOverlay
          fallbackPlayerName={playerName}
          onAvatarsChanged={() => {
            void fetchAvatars()
              .then((nextAvatars) => {
                onAvatarsChanged?.(nextAvatars);
              })
              .catch((error: unknown) => {
                console.error('Avatar refresh after title change failed', error);
              });
          }}
          onClose={() => {
            setProfileOpen(false);
          }}
          open={profileOpen}
        />
      ) : null}
    </main>
  );
}

export default Dashboard;
