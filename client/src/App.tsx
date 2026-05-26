import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AchievementProgressDto, RoomHelpInvitationDto } from '@shared/contracts';
import {
  fetchAchievements,
  fetchActiveEncounter,
  fetchAvatar,
  fetchPendingHelpInvitations,
  heartbeatSession,
  loadStoredSession,
  logoutSession,
  clearStoredSession,
  fetchPlayer,
  fetchSession,
  fetchStaticGameDataStatus,
  respondHelpInvite,
  type EncounterSnapshot,
  type PersistedAvatar,
} from './api/http.js';
import { ApiRequestError } from './api/httpErrorMessage.js';
import AchievementsOverlay from './ui/dashboard/AchievementsOverlay.js';
import {
  findNewRankUnlocks,
  pickPrimaryUnlock,
} from './ui/dashboard/achievementUnlockDetection.js';
import { markAchievementsSeen } from './ui/dashboard/achievementsAttentionState.js';
import ScribesAchievementToast from './ui/dashboard/ScribesAchievementToast.js';
import { BackgroundProvider, PersistentBackground } from './ui/background/BackgroundProvider.js';
import { preloadAvatarSelectionAssets } from './ui/avatar/avatarPreload.js';
import {
  loadDeadAvatarIds,
  prepareAvatarSelection,
  refreshAvatarSelectionAfterHome,
  saveDeadAvatarIds,
} from './ui/avatar/avatarSelectionPrepare.js';
import { formatAvatarDisplayName, normalizePersistedAvatar } from './ui/avatar/avatarDisplayName.js';
import GameMessageToast from './ui/game/GameMessageToast.js';
import Dashboard from './ui/dashboard/Dashboard.js';
import AvatarDeathOverlay from './ui/game/AvatarDeathOverlay.js';
import GameEnvironment from './ui/game/GameEnvironment.js';
import AvatarEnterHandoff from './ui/transitions/AvatarEnterHandoff.js';
import type { AvatarEnterHandoffSnapshot } from './ui/transitions/avatarEnterTransition.js';
import { seedDefaultAudioVolumesIfUnset } from './ui/audioVolume.js';
import LoadingScreen from './ui/loading/LoadingScreen.js';
import MusicEngine, { type MusicZone } from './ui/music/MusicEngine.js';
import OnboardingGateway from './ui/onboarding/OnboardingGateway.js';
import { useMobileFullscreen } from './ui/layout/useMobileFullscreen.js';
import { useProtectedImages } from './ui/protectedImage.js';
import { FADE_DURATION_MS } from './ui/transitions/fade.js';

type AppScreen = 'loading' | 'gateway' | 'dashboard' | 'game';

const ACHIEVEMENT_POLL_MS = 10_000;
const HELP_INVITE_POLL_MS = 5_000;

function isAchievementWatchScreen(screen: AppScreen): boolean {
  return screen === 'game' || screen === 'dashboard';
}

function musicZoneForScreen(screen: AppScreen): MusicZone {
  if (screen === 'dashboard') {
    return 'menu';
  }

  if (screen === 'game') {
    return 'ambient';
  }

  return 'silent';
}

function resetEnterHandoffState(
  setGameEnterHandoff: (value: boolean) => void,
  setHandoffLanded: (value: boolean) => void,
  setAvatarEnterHandoff: (value: AvatarEnterHandoffSnapshot | null) => void,
): void {
  setGameEnterHandoff(false);
  setHandoffLanded(false);
  setAvatarEnterHandoff(null);
}

async function loadPlayerForBootstrap(
  session: Awaited<ReturnType<typeof fetchSession>> | null,
): Promise<Awaited<ReturnType<typeof fetchPlayer>>> {
  try {
    return await fetchPlayer(session);
  } catch (error) {
    console.error('Player bootstrap failed', error);
    return { playerId: session?.playerId ?? 'Babuni' };
  }
}

async function loadAvatarForBootstrap(
  player: Awaited<ReturnType<typeof fetchPlayer>> | null,
): Promise<Awaited<ReturnType<typeof fetchAvatar>>> {
  try {
    return await fetchAvatar(player);
  } catch (error) {
    console.error('Avatar bootstrap failed', error);
    return {};
  }
}

async function loadEncounterForBootstrap(
  avatar: Awaited<ReturnType<typeof fetchAvatar>> | null,
): Promise<Awaited<ReturnType<typeof fetchActiveEncounter>>> {
  try {
    return await fetchActiveEncounter(avatar);
  } catch (error) {
    console.error('Encounter bootstrap failed', error);
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [activeAvatar, setActiveAvatar] = useState<PersistedAvatar | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<EncounterSnapshot | null>(null);
  const [avatarSelectionAvatars, setAvatarSelectionAvatars] = useState<PersistedAvatar[]>([]);
  const [avatarCreationPreset, setAvatarCreationPreset] = useState<PersistedAvatar | null>(null);
  const [excludedAvatarIds, setExcludedAvatarIds] = useState(loadDeadAvatarIds);
  const [avatarSelectionPrepared, setAvatarSelectionPrepared] = useState(false);
  const [avatarSlotsVisible, setAvatarSlotsVisible] = useState(false);
  const [musicFadeOutSignal, setMusicFadeOutSignal] = useState(0);
  const [gameEnterHandoff, setGameEnterHandoff] = useState(false);
  const [avatarEnterHandoff, setAvatarEnterHandoff] =
    useState<AvatarEnterHandoffSnapshot | null>(null);
  const [handoffLanded, setHandoffLanded] = useState(false);
  const [deathOverlayAvatar, setDeathOverlayAvatar] = useState<PersistedAvatar | null>(null);
  const [deathCreationHandoff, setDeathCreationHandoff] = useState(false);
  const [avatarSelectionNotice, setAvatarSelectionNotice] = useState<string | null>(null);
  const [playPreparePending, setPlayPreparePending] = useState(false);
  const [achievementToast, setAchievementToast] = useState<AchievementProgressDto | null>(null);
  const [achievementsOverlayOpen, setAchievementsOverlayOpen] = useState(false);
  const [helpInviteToast, setHelpInviteToast] = useState<RoomHelpInvitationDto | null>(null);
  const [gameEntryKey, setGameEntryKey] = useState(0);
  const achievementsBaselineRef = useRef<AchievementProgressDto[] | null>(null);
  const seenHelpInviteIdsRef = useRef<Set<string>>(new Set());
  const helpInviteAcceptPendingRef = useRef(false);
  const session = loadStoredSession();
  const playerId = session?.playerId ?? '';
  const playerName = session?.playerName ?? '';
  useMobileFullscreen();
  useProtectedImages();

  useEffect(() => {
    seedDefaultAudioVolumesIfUnset();
  }, []);

  const checkAchievementUnlocks = useCallback(async (options?: {
    seedBaseline?: boolean;
  }): Promise<void> => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      return;
    }

    try {
      const response = await fetchAchievements();
      const previous = achievementsBaselineRef.current;

      if (options?.seedBaseline || !previous) {
        achievementsBaselineRef.current = response.achievements;
        return;
      }

      const unlock = pickPrimaryUnlock(findNewRankUnlocks(previous, response.achievements));
      achievementsBaselineRef.current = response.achievements;

      if (unlock) {
        setAchievementToast(unlock.achievement);
      }
    } catch (error) {
      console.error('Achievement unlock check failed', error);
    }
  }, [playerId, screen]);

  useEffect(() => {
    if (!isAchievementWatchScreen(screen)) {
      setAchievementToast(null);
      setAchievementsOverlayOpen(false);
      achievementsBaselineRef.current = null;
      return;
    }

    void checkAchievementUnlocks({ seedBaseline: true });

    const pollTimer = window.setInterval(() => {
      void checkAchievementUnlocks();
    }, ACHIEVEMENT_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [checkAchievementUnlocks, screen]);

  const dismissHelpInviteToast = useCallback((invite: RoomHelpInvitationDto | null) => {
    if (invite) {
      seenHelpInviteIdsRef.current.add(invite.inviteId);
    }
    setHelpInviteToast(null);
  }, []);

  const acceptHelpInvite = useCallback(async (invite: RoomHelpInvitationDto) => {
    if (helpInviteAcceptPendingRef.current) {
      return;
    }

    helpInviteAcceptPendingRef.current = true;
    seenHelpInviteIdsRef.current.add(invite.inviteId);
    setHelpInviteToast(null);

    try {
      const response = await respondHelpInvite(invite.inviteId);
      const joinedRoom = response.room;
      if (!joinedRoom) {
        return;
      }

      const localParticipant = joinedRoom.participants.find((participant) => participant.isLocal);
      if (!localParticipant?.avatar) {
        return;
      }

      setActiveAvatar(normalizePersistedAvatar(localParticipant.avatar));
      setActiveEncounter(joinedRoom.activeEncounter);
      setGameEntryKey((current) => current + 1);
      resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
      setAvatarSlotsVisible(false);
      setScreen('game');
    } catch (error) {
      console.error('Help invite accept failed', error);
    } finally {
      helpInviteAcceptPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      setHelpInviteToast(null);
      return;
    }

    async function pollHelpInvites(): Promise<void> {
      if (helpInviteToast || helpInviteAcceptPendingRef.current) {
        return;
      }

      try {
        const response = await fetchPendingHelpInvitations();
        const now = Date.now();
        const nextInvite = response.invitations.find(
          (invitation) => (
            !seenHelpInviteIdsRef.current.has(invitation.inviteId)
            && invitation.expiresAt > now
          ),
        );

        if (nextInvite) {
          setHelpInviteToast(nextInvite);
        }
      } catch (error) {
        console.error('Help invite poll failed', error);
      }
    }

    void pollHelpInvites();

    const pollTimer = window.setInterval(() => {
      void pollHelpInvites();
    }, HELP_INVITE_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [helpInviteToast, playerId, screen]);

  const loadingHooks = useMemo(
    () => ({
      loadSession: fetchSession,
      loadAvatarSelection: async () => {
        try {
          return await prepareAvatarSelection();
        } catch (error) {
          console.error('Avatar selection prepare during loading failed', error);
          return null;
        }
      },
      loadPlayer: loadPlayerForBootstrap,
      loadAvatar: loadAvatarForBootstrap,
      loadEncounter: loadEncounterForBootstrap,
      syncState: async () => {
        await fetchStaticGameDataStatus();
      },
    }),
    [],
  );

  async function ensureAvatarSelectionPrepared(): Promise<boolean> {
    if (avatarSelectionPrepared) {
      return true;
    }

    setPlayPreparePending(true);

    try {
      const avatars = await prepareAvatarSelection();
      setAvatarSelectionAvatars(avatars);
      setAvatarSelectionPrepared(true);
      return true;
    } catch (error) {
      console.error('Avatar selection prepare failed', error);
      setAvatarSelectionPrepared(false);
      return false;
    } finally {
      setPlayPreparePending(false);
    }
  }

  async function syncAvatarSelectionAfterHomeState(): Promise<void> {
    const { avatars, purge } = await refreshAvatarSelectionAfterHome();
    setAvatarSelectionAvatars(avatars);
    setExcludedAvatarIds(purge.failedIds);
    setAvatarSelectionPrepared(true);
    setAvatarSelectionNotice(
      purge.failedIds.length > 0
        ? 'Could not remove fallen avatar; try Home again.'
        : null,
    );
  }

  async function applyAvatarSelectionFromHome(): Promise<void> {
    try {
      await syncAvatarSelectionAfterHomeState();
    } catch (error) {
      console.error('Avatar selection refresh after home failed', error);
      setAvatarSelectionPrepared(false);
      setAvatarSelectionNotice(null);
    }
  }

  useEffect(() => {
    if (screen === 'loading' || screen === 'gateway') {
      return undefined;
    }

    let transientFailures = 0;
    const interval = window.setInterval(() => {
      void heartbeatSession().then(() => {
        transientFailures = 0;
      }).catch((error: unknown) => {
        console.error('Session heartbeat failed', error);
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          clearStoredSession();
          setActiveAvatar(null);
          setActiveEncounter(null);
          setScreen('gateway');
          return;
        }

        transientFailures += 1;
        if (transientFailures < 3) {
          return;
        }

        clearStoredSession();
        setActiveAvatar(null);
        setActiveEncounter(null);
        setScreen('gateway');
      });
    }, 45_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [screen]);

  return (
    <BackgroundProvider>
      <PersistentBackground />
      <MusicEngine
        ambientRace={screen === 'game' ? activeAvatar?.race : null}
        ambientRole={screen === 'game' ? activeAvatar?.role : null}
        fadeOutSignal={musicFadeOutSignal}
        zone={musicZoneForScreen(screen)}
      >
        {screen === 'loading' ? (
          <LoadingScreen
            hooks={loadingHooks}
            onError={(error) => {
              console.error('Loading bootstrap failed', error);
            }}
            onReady={(_route, context) => {
              const selection = context.avatarSelection as PersistedAvatar[] | null;

              if (selection) {
                setAvatarSelectionAvatars(selection);
                setAvatarSelectionPrepared(true);
              } else {
                setAvatarSelectionPrepared(false);
              }

              setScreen(loadStoredSession()?.accessToken ? 'dashboard' : 'gateway');
            }}
          />
        ) : null}
        {screen === 'gateway' ? (
          <OnboardingGateway
            onSessionReady={() => {
              setAvatarSlotsVisible(false);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);

              void (async () => {
                try {
                  const avatars = await prepareAvatarSelection();
                  setAvatarSelectionAvatars(avatars);
                  setAvatarSelectionPrepared(true);
                } catch (error) {
                  console.error('Avatar selection prepare after login failed', error);
                  setAvatarSelectionAvatars([]);
                  setAvatarSelectionPrepared(false);
                } finally {
                  setScreen('dashboard');
                }
              })();
            }}
          />
        ) : null}
        {screen === 'dashboard' || gameEnterHandoff ? (
          <Dashboard
            achievementsOpen={achievementsOverlayOpen}
            avatars={avatarSelectionAvatars}
            avatarSlotsVisible={avatarSlotsVisible}
            onAchievementCheck={() => {
              void checkAchievementUnlocks();
            }}
            onAchievementsOpenChange={setAchievementsOverlayOpen}
            creationPreset={avatarCreationPreset}
            creationRevealDelayMs={deathCreationHandoff ? FADE_DURATION_MS : 0}
            excludedAvatarIds={excludedAvatarIds}
            hidden={gameEnterHandoff}
            selectionNotice={avatarSelectionNotice}
            onAvatarSlotsVisibleChange={setAvatarSlotsVisible}
            onAvatarsChanged={(avatars) => {
              setAvatarSelectionAvatars(avatars);
              setActiveAvatar((current) => {
                if (!current) {
                  return current;
                }

                const updated = avatars.find((avatar) => avatar.id === current.id);
                return updated ?? current;
              });
              void preloadAvatarSelectionAssets(avatars).catch((error: unknown) => {
                console.error('Avatar selection preload after change failed', error);
              });
            }}
            onAvatarSelectionHome={() => {
              void applyAvatarSelectionFromHome();
            }}
            onCreationPresetConsumed={() => {
              setAvatarCreationPreset(null);
              setDeathCreationHandoff(false);
            }}
            onEnterGameComplete={() => {
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setAvatarSlotsVisible(false);
            }}
            onEnterHandoffChange={setAvatarEnterHandoff}
            onEnterWorldFailed={() => {
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
            }}
            onHandoffLand={() => {
              setHandoffLanded(true);
            }}
            playPreparePending={playPreparePending}
            onPlay={ensureAvatarSelectionPrepared}
            onAvatarEnter={() => {
              setMusicFadeOutSignal((signal) => signal + 1);
            }}
            onPrepareGame={(avatar, encounter) => {
              setActiveAvatar(avatar);
              setActiveEncounter(encounter);
              setHandoffLanded(false);
              setGameEnterHandoff(true);
              setScreen('game');
            }}
            onLogout={() => {
              void logoutSession()
                .catch((error: unknown) => {
                  console.error('Logout failed', error);
                  clearStoredSession();
                })
                .finally(() => {
                  setAvatarSelectionAvatars([]);
                  setAvatarSelectionPrepared(false);
                  setAvatarSlotsVisible(false);
                  setActiveAvatar(null);
                  setActiveEncounter(null);
                  setScreen('gateway');
                });
            }}
          />
        ) : null}
        {screen === 'game' && activeAvatar && activeEncounter ? (
          <GameEnvironment
            key={gameEntryKey}
            deathPending={deathOverlayAvatar !== null}
            deferReveal={gameEnterHandoff && !handoffLanded}
            hideAvatarPortraitForHandoff={gameEnterHandoff && !handoffLanded}
            initialAvatar={activeAvatar}
            initialEncounter={activeEncounter}
            onHome={() => {
              setActiveAvatar(null);
              setActiveEncounter(null);
              setAvatarSlotsVisible(false);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              void applyAvatarSelectionFromHome();
            }}
            onAchievementCheck={() => {
              void checkAchievementUnlocks();
            }}
            onAvatarDeath={(presetAvatar) => {
              setExcludedAvatarIds((currentIds) => {
                const nextIds = currentIds.includes(presetAvatar.id)
                  ? currentIds
                  : [...currentIds, presetAvatar.id];
                saveDeadAvatarIds(nextIds);
                return nextIds;
              });
              setAvatarSelectionAvatars((currentAvatars) => (
                currentAvatars.filter((avatar) => avatar.id !== presetAvatar.id)
              ));
              setDeathOverlayAvatar(presetAvatar);
            }}
          />
        ) : null}
        {deathOverlayAvatar ? (
          <AvatarDeathOverlay
            avatarName={formatAvatarDisplayName(deathOverlayAvatar)}
            onHandoffComplete={() => {
              setDeathOverlayAvatar(null);
            }}
            onHandoffStart={async () => {
              const preset = deathOverlayAvatar;
              if (!preset) {
                return;
              }

              try {
                await syncAvatarSelectionAfterHomeState();
              } catch (error) {
                console.error('Death overlay home prepare failed', error);
                setAvatarSelectionPrepared(false);
                setAvatarSelectionNotice('Could not refresh avatars; try Home again.');
                throw error;
              }

              setDeathCreationHandoff(true);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              setAvatarSlotsVisible(true);
              setAvatarCreationPreset(null);
              window.requestAnimationFrame(() => {
                setAvatarCreationPreset(preset);
              });
            }}
            open
          />
        ) : null}
        {avatarEnterHandoff ? (
          <AvatarEnterHandoff
            avatar={avatarEnterHandoff.avatar}
            bounds={avatarEnterHandoff.bounds}
            fading={avatarEnterHandoff.fading}
            glowAtCenter={avatarEnterHandoff.phase === 'at-center'}
            moveDurationMs={avatarEnterHandoff.moveDurationMs}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && achievementToast ? (
          <ScribesAchievementToast
            achievement={achievementToast}
            onDismiss={() => {
              setAchievementToast(null);
            }}
            onOpenAchievements={() => {
              setAchievementsOverlayOpen(true);
            }}
            playerName={playerName}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && helpInviteToast ? (
          <GameMessageToast
            label="Call for help"
            message={`${helpInviteToast.fromPlayerName} calls for help. Tap to join.`}
            onClick={() => {
              void acceptHelpInvite(helpInviteToast);
            }}
            onDismiss={() => {
              dismissHelpInviteToast(helpInviteToast);
            }}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && achievementsOverlayOpen && playerId ? (
          <AchievementsOverlay
            onClose={() => {
              setAchievementsOverlayOpen(false);
            }}
            onProgressChange={() => {
              void checkAchievementUnlocks();
            }}
            onSnapshotViewed={(snapshot) => {
              markAchievementsSeen(playerId, snapshot);
              achievementsBaselineRef.current = snapshot.achievements;
            }}
            open
            playerId={playerId}
          />
        ) : null}
      </MusicEngine>
    </BackgroundProvider>
  );
}
