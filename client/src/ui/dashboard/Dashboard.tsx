import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { menuPreparingClass, useMenuPreparingCheck } from '../transitions/menuReadiness.js';
import type {
  ActivityFeedMenuTarget,
  ActivityFeedJoinRoomActionDto,
  FriendSummaryDto,
} from '@shared/contracts';
import {
  fetchAchievements,
  fetchRecentActivity,
  loadStoredSession,
  type EncounterRoomSnapshotDto,
  type PersistedAvatar,
} from '../../api/http.js';
import { hasUnseenAchievements } from './achievementsAttentionState.js';
import AvatarSelectionPanel from '../avatar/AvatarSelectionPanel.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import ActivityFeedOverlay from './ActivityFeedOverlay.js';
import ExpansionsOverlay from './ExpansionsOverlay.js';
import FriendsOverlay from './FriendsOverlay.js';
import { fetchAvatars } from '../../api/http.js';
import { subscribePlayerChanges } from '../../api/playerChanges.js';
import PlayerProfileOverlay from './PlayerProfileOverlay.js';
import { hasUnreadScribes } from './scribesReadState.js';
import SettingsScreen from '../settings/SettingsScreen.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import { useTooltipRevealGroup } from '../hooks/useTooltipReveal.js';
import { NAV_BUTTON_PRESS_MS, useNavButtonPress } from '../transitions/navButtonPress.js';
import { assetUrl } from '../../assetUrl.js';
import { GameTooltipFrame } from '../game/GameTooltip.js';

const PLAY_PREPARE_WHEEL_ASSET = assetUrl('/UI/01_WelcomeScreen/LoadingWheel.webp');
const NAV_BUTTON_ASSET = assetUrl('/UI/03_DASHBOARD/im_button_nav_b.webp');
const HOME_BUTTON_ASSET = assetUrl('/UI/03_DASHBOARD/im_button_home.webp');
const RADIAL_BUTTONS = [
  {
    label: 'News',
    tooltip: 'Scribes',
    src: assetUrl('/UI/03_DASHBOARD/im_button_news_a.webp'),
    x: 48,
    y: -86,
  },
  {
    label: 'Settings',
    tooltip: 'Settings',
    src: assetUrl('/UI/03_DASHBOARD/im_button_setting_b.webp'),
    x: -48,
    y: 83,
  },
  {
    label: 'Social',
    tooltip: 'Friends',
    src: assetUrl('/UI/03_DASHBOARD/im_button_social_a.webp'),
    x: 96,
    y: 0,
  },
  {
    label: 'Profile',
    tooltip: 'Profile',
    src: assetUrl('/UI/03_DASHBOARD/im_button_credits_b.webp'),
    x: -96,
    y: 0,
  },
  {
    label: 'Achievements',
    tooltip: 'Achievements',
    src: assetUrl('/UI/03_DASHBOARD/im_achievements.webp'),
    x: 48,
    y: 83,
  },
  {
    label: 'Expansions',
    tooltip: 'Expansions',
    src: assetUrl('/UI/03_DASHBOARD/im_button_expansions.webp'),
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

const prepareWheelStyle: CSSProperties = {
  display: 'block',
  width: 'min(18vw, 72px)',
  height: 'min(18vw, 72px)',
  margin: 'clamp(80px, 20vh, 200px) auto 0',
  objectFit: 'contain',
  animation: 'morkahja-loading-wheel-spin-flat 1.2s linear infinite',
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
  menuRequest,
  onMenuRequestHandled,
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
  onFailedAvatarSelect,
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
  /** Open this menu, e.g. from a message at the top (Babuni, 2026-11-27). */
  menuRequest?: { menu: ActivityFeedMenuTarget; key: number } | null;
  onMenuRequestHandled?: () => void;
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
  onFailedAvatarSelect?: (avatar: PersistedAvatar) => void;
  onHandoffLand?: () => void;
  onAvatarEnter?: () => void;
  onJoinFriend?: (friend: FriendSummaryDto, sourceElement: HTMLElement) => void | Promise<void>;
  onJoinRoomFromScribes?: (
    action: ActivityFeedJoinRoomActionDto,
    sourceElement: HTMLElement,
  ) => void | Promise<void>;
  onPlay?: () => Promise<boolean> | boolean;
  onPrepareGame: (avatar: PersistedAvatar, room: EncounterRoomSnapshotDto) => void;
  onLogout: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [enteringGame, setEnteringGame] = useState(false);
  const [, setAvatarCreationOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expansionsOpen, setExpansionsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [diceShopFromMessage, setDiceShopFromMessage] = useState(false);
  const [soulLinkFromMessage, setSoulLinkFromMessage] = useState(false);
  const [scribesUnread, setScribesUnread] = useState(false);
  const [achievementsAttention, setAchievementsAttention] = useState(false);
  const { bind: bindNavTooltip, isVisible: isNavTooltipVisible } = useTooltipRevealGroup();
  const isMenuPreparing = useMenuPreparingCheck();
  const session = loadStoredSession();
  const playerId = session?.playerId ?? '';
  const playerName = session?.playerName?.trim() ?? '';
  const showChrome = !hidden;
  const { pulse: pulseNavButton, isPressed: isNavButtonPressed, pressAnimation } =
    useNavButtonPress();

  const openMenu = useCallback((menu: ActivityFeedMenuTarget) => {
    setNavOpen(false);
    if (menu === 'soul_link') {
      setSoulLinkFromMessage(true);
      setFriendsOpen(true);
    } else if (menu === 'expansions' || menu === 'dice_shop') {
      setDiceShopFromMessage(menu === 'dice_shop');
      setExpansionsOpen(true);
    } else if (menu === 'settings') {
      setSettingsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (menuRequest) {
      openMenu(menuRequest.menu);
      onMenuRequestHandled?.();
    }
  }, [menuRequest, onMenuRequestHandled, openMenu]);

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

    // Refreshed when the server reports a change (2026-11-27), no longer every 10 s.
    const stopScribes = subscribePlayerChanges(['player', 'feed'], () => {
      void refreshScribesUnread();
    });
    const stopAchievements = subscribePlayerChanges(['player'], () => {
      void refreshAchievementsAttention();
    });

    return () => {
      stopScribes();
      stopAchievements();
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

  // No Play button (Babuni, 2026-11-23): the avatars are the main menu, so
  // they open as soon as the dashboard shows, and again when the round menu
  // closes. Never while it is open: opening it hides the avatars, and bringing
  // them straight back closed the menu by itself (fixed 2026-11-23).
  const autoOpenPendingRef = useRef(false);
  useEffect(() => {
    if (!showChrome || navOpen || avatarSlotsVisible || playPreparePending || autoOpenPendingRef.current) {
      return;
    }
    autoOpenPendingRef.current = true;
    void Promise.resolve(onPlay?.() ?? true)
      .then((ready) => {
        if (ready) {
          onAvatarSlotsVisibleChange?.(true);
        }
      })
      .finally(() => {
        autoOpenPendingRef.current = false;
      });
  }, [showChrome, navOpen, avatarSlotsVisible, playPreparePending, onPlay, onAvatarSlotsVisibleChange]);

  // A tap anywhere else closes the round menu too (Babuni, 2026-11-24), unless
  // one of its panels is open over the screen.
  const navRef = useRef<HTMLElement | null>(null);
  const anyPanelOpen = activityOpen || settingsOpen || expansionsOpen || friendsOpen || profileOpen || achievementsOpen;
  useEffect(() => {
    if (!navOpen || anyPanelOpen || !showChrome) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && navRef.current?.contains(target)) {
        return;
      }
      playSfx(DEFAULT_BUTTON_SOUND);
      setNavOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [navOpen, anyPanelOpen, showChrome]);

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
          @keyframes morkahja-loading-wheel-spin-flat {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes morkahja-loading-wheel-spin {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}
      </style>
      <div style={dashboardColumnStyle}>
        {showChrome && playPreparePending && !avatarSlotsVisible ? (
          <img alt="" aria-hidden="true" draggable={false} src={PLAY_PREPARE_WHEEL_ASSET} style={prepareWheelStyle} />
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
            onFailedAvatarSelect={onFailedAvatarSelect}
            onHandoffLand={onHandoffLand}
            onAvatarEnter={onAvatarEnter}
            onCreationOpenChange={setAvatarCreationOpen}
            onEnteringGameChange={setEnteringGame}
            onPrepareGame={(avatar, room) => {
              onAvatarSlotsVisibleChange?.(false);
              onPrepareGame(avatar, room);
            }}
            visible={avatarSlotsVisible}
          />
        ) : null}
      </div>
      {showChrome ? (
        <nav
          aria-label="Dashboard navigation"
          ref={navRef}
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
              className={`morkahja-nav-radial-button${menuPreparingClass(isMenuPreparing(`nav:${button.label}`))}`}
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
                <GameTooltipFrame background="rgba(12, 8, 6, 0.88)" />
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
                // Open first, so the avatars are not brought straight back.
                setNavOpen(true);
                void closeAvatarSelection();
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
              <GameTooltipFrame background="rgba(12, 8, 6, 0.88)" />
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
          onOpenAchievements={() => {
            setActivityOpen(false);
            onAchievementsOpenChange?.(true);
          }}
          onOpenMenu={(menu) => {
            setActivityOpen(false);
            openMenu(menu);
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
          playerId={playerId}
          playerName={playerName}
        />
      ) : null}
      {showChrome ? (
        <ExpansionsOverlay
          onClose={() => {
            setExpansionsOpen(false);
            setDiceShopFromMessage(false);
          }}
          onContentUnlocked={onAchievementCheck}
          open={expansionsOpen}
          playerId={playerId}
          startWithDiceShop={diceShopFromMessage}
        />
      ) : null}
      {showChrome ? (
        <FriendsOverlay
          onClose={() => {
            setFriendsOpen(false);
            setSoulLinkFromMessage(false);
          }}
          onJoinFriend={onJoinFriend}
          open={friendsOpen}
          playerId={playerId}
          playerName={playerName}
          startWithSoulLink={soulLinkFromMessage}
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
          onContentUnlocked={onAchievementCheck}
          open={profileOpen}
          playerId={playerId}
        />
      ) : null}
    </main>
  );
}

export default Dashboard;
